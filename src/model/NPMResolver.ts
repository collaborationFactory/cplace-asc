/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as process from 'process';
import * as fs from 'fs';
import * as spawn from 'cross-spawn';
import { cgreen, cwarn, debug } from '../utils';
import { RegistryInitializer } from './RegistryInitializer';

export class NPMResolver {
    private static readonly PACKAGE_JSON = 'package.json';
    private static readonly NODE_MODULES = 'node_modules';

    private readonly mainRepo: string;

    constructor(mainRepo: string) {
        this.mainRepo = mainRepo;
    }

    /**
     * Installs plugin dependencies
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     * @private
     */
    public static installPluginDependencies(
        pluginName: string,
        assetsPath: string,
        isProduction: boolean
    ): boolean {
        if (!fs.existsSync(NPMResolver.getPluginPackageJsonPath(assetsPath))) {
            console.log(
                cwarn`[${pluginName}] (NPM) package.json does not exists.`
            );
            return false;
        }

        NPMResolver.warnNonExactPluginDependenciesVersions(
            pluginName,
            NPMResolver.getPluginPackageJsonPath(assetsPath)
        );
        const oldCwd = process.cwd();
        process.chdir(assetsPath);

        const nodeModulesFolder = NPMResolver.getNodeModulesPath(assetsPath);
        if (fs.existsSync(nodeModulesFolder)) {
            console.log(
                `⟲ [${pluginName}] (NPM) removing node_modules folder...`
            );
            fs.rmSync(nodeModulesFolder, {
                recursive: true,
                force: true,
            });
        } else {
            console.log(
                `⟲ [${pluginName}] (NPM) node_modules folder does not exist...`,
                nodeModulesFolder
            );
        }
        console.log(`⟲ [${pluginName}] (NPM) installing dependencies...`);
        let res;
        if (isProduction) {
            console.log(`⟲ [${pluginName}] (NPM) running: npm ci`);
            res = spawn.sync('npm', ['ci'], { encoding: 'utf-8' });
        } else {
            console.log(
                `⟲ [${pluginName}] (NPM) running: npm install --force --package-lock false`
            );
            res = spawn.sync(
                'npm',
                ['install', '--force', '--package-lock', 'false'],
                { encoding: 'utf-8' }
            );
        }

        if (res.status !== 0) {
            throw Error(
                `[${pluginName}] (NPM) installing dependencies failed! \n\n${res.stderr}`
            );
            process.exit(1);
        }
        console.log(
            cgreen`✓`,
            `[${pluginName}] (NPM) dependencies successfully installed`
        );
        debug(`⟲ [${pluginName}] (NPM) installation details \n\n${res.stdout}`);
        NPMResolver.removePluginSymlinks(pluginName, assetsPath);
        process.chdir(oldCwd);
        return true;
    }

    /**
     * Gets plugin node_modules path
     * @param assetsPath Assets path
     * @private
     */
    public static getPluginNodeModulesPath(assetsPath: string): string {
        return path.resolve(assetsPath, NPMResolver.NODE_MODULES);
    }

    /**
     * Plugin dependencies should have exact versions. This method will log if there are any dependencies with non-exact
     * version
     * @param pluginName Name of a cplace plugin
     * @param packageJsonPath package.json path
     * @private
     */
    private static warnNonExactPluginDependenciesVersions(
        pluginName: string,
        packageJsonPath: string
    ): void {
        const nonExactVersions =
            NPMResolver.getNonExactPluginDependenciesVersions(
                pluginName,
                packageJsonPath
            );
        if (nonExactVersions.length) {
            console.log(
                cwarn`⇢ [${pluginName}] (NPM) The following dependencies should have strict versions:`,
                cwarn`\n\n${nonExactVersions.join('\r\n')}\n\n`,
                cwarn`To avoid potential malfunctions, please install dependencies the following way:\n`,
                cwarn`npm install yourdependency --save-exact\n`
            );
        }
    }

    /**
     * Gets all non-exact versions from the plugin package.json
     * @param pluginName Name of a cplace plugin
     * @param packageJsonPath package.json path
     * @private
     */
    private static getNonExactPluginDependenciesVersions(
        pluginName: string,
        packageJsonPath: string
    ): string[] {
        const packageJsonString = fs.readFileSync(packageJsonPath, {
            encoding: 'utf8',
        });
        let packageJson;
        try {
            packageJson = JSON.parse(packageJsonString);
        } catch (e) {
            debug(`[${pluginName}] (NPM) can't parse ${packageJsonPath}`);
            return [];
        }
        const dependencies = packageJson.dependencies;
        if (!dependencies) {
            return [];
        }
        const rangeCharacters = ['^', '~', '>', '<', 'x', '*', '||'];
        return Object.keys(dependencies).reduce(
            (acc: string[], dependency: string) => {
                const version: string = dependencies[dependency];
                const hasRangeCharacter = rangeCharacters.some(
                    (rangeCharacter) => version.includes(rangeCharacter)
                );
                if (hasRangeCharacter) {
                    acc.push(dependency.concat(':').concat(version));
                }
                return acc;
            },
            []
        );
    }

    /**
     * Removes symlinks inside plugin node_modules folder
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     * @private
     */
    private static removePluginSymlinks(
        pluginName: string,
        assetsPath: string
    ): void {
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            const nodeModulesPath = path.resolve(assetsPath, 'node_modules');
            if (fs.existsSync(nodeModulesPath)) {
                console.log(`⟲ [${pluginName}] (NPM) removing symlinks...`);
                fs.readdirSync(nodeModulesPath).forEach((dir) => {
                    const dirPath = path.resolve(nodeModulesPath, dir);
                    if (fs.lstatSync(dirPath).isSymbolicLink()) {
                        fs.rmSync(dirPath, { recursive: true, force: true });
                    }
                });
                console.log(
                    cgreen`✓`,
                    `[${pluginName}] (NPM) symlinks removed`
                );
            }
        }
    }

    /**
     * Gets plugin package-lock.json path
     * @param assetsPath Assets path
     * @private
     */
    private static getPluginPackageJsonPath(assetsPath: string): string {
        return path.resolve(assetsPath, NPMResolver.PACKAGE_JSON);
    }

    /**
     * Gets plugin node_modules path
     * @param assetsPath Assets path
     * @private
     */
    private static getNodeModulesPath(assetsPath: string): string {
        return path.resolve(assetsPath, NPMResolver.NODE_MODULES);
    }

    public init(): void {
        const registryInitializer = new RegistryInitializer();
        registryInitializer.initRegistry();
    }
}
