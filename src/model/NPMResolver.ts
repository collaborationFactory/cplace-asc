/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as process from 'process';
import * as fs from 'fs';
import * as spawn from 'cross-spawn';
import * as crypto from 'crypto';
import { cgreen, cwarn, debug } from '../utils';
import { RegistryInitializer } from './RegistryInitializer';

export class NPMResolver {
    private static readonly PACKAGE_JSON = 'package.json';
    private static readonly PACKAGE_LOCK_HASH = 'package-lock.hash';
    private static readonly PACKAGE_LOCK_JSON = 'package-lock.json';
    private static readonly NODE_MODULES = 'node_modules';

    private readonly mainRepo: string;

    constructor(mainRepo: string) {
        this.mainRepo = mainRepo;
    }

    /**
     * Installs plugin dependencies and create hash
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     * @param isProduction True if cplace-asc runs in production mode
     */
    public static installPluginDependenciesAndCreateHash(
        pluginName: string,
        assetsPath: string,
        isProduction: boolean
    ): boolean {
        if (fs.existsSync(NPMResolver.getPluginHashFilePath(assetsPath))) {
            const packageLockUpdated = NPMResolver.packageLockWasUpdated(
                NPMResolver.getPluginHashFilePath(assetsPath),
                NPMResolver.getPluginPackageLockPath(assetsPath),
                pluginName
            );
            if (packageLockUpdated) {
                console.log(
                    cgreen`⇢`,
                    `[${pluginName}] (NPM) package-lock.json was updated...`
                );
            }
            const hasNodeModules =
                NPMResolver.getPluginNodeModulesPath(assetsPath);
            if (!hasNodeModules || packageLockUpdated) {
                return NPMResolver.installPluginDependencies(
                    pluginName,
                    assetsPath,
                    isProduction
                );
            }
            return false;
        } else {
            return NPMResolver.installPluginDependencies(
                pluginName,
                assetsPath,
                isProduction
            );
        }
    }

    /**
     * Installs plugin dependencies
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     * @param isProduction True if cplace-asc runs in production mode
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

        console.log(`⟲ [${pluginName}] (NPM) installing dependencies...`);
        let res;
        if (isProduction) {
            console.log(`⟲ [${pluginName}] (NPM) running: npm ci`);
            res = spawn.sync('npm', ['ci', '--legacy-peer-deps'], {
                encoding: 'utf-8',
            });
        } else {
            console.log(`⟲ [${pluginName}] (NPM) running: npm install`);
            res = spawn.sync('npm', ['install', '--legacy-peer-deps'], {
                encoding: 'utf-8',
            });
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
        NPMResolver.createPluginHashFile(assetsPath);
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
     * Gets package-lock.json hash
     * @param packageLockPath package-lock.json path
     * @private
     */
    private static getHash4PackageLock(packageLockPath: string): string {
        const hash = crypto.createHash('sha256');
        const data = fs.readFileSync(packageLockPath);
        hash.update(data);
        return hash.digest('hex');
    }

    /**
     * Gets plugin hash file path
     * @param assetsPath
     * @private
     */
    private static getPluginHashFilePath(assetsPath: string): string {
        return path.join(
            assetsPath,
            NPMResolver.NODE_MODULES,
            NPMResolver.PACKAGE_LOCK_HASH
        );
    }

    /**
     * Gets plugin package-lock.json path
     * @param assetsPath Assets path
     * @private
     */
    private static getPluginPackageLockPath(assetsPath: string): string {
        return path.resolve(assetsPath, NPMResolver.PACKAGE_LOCK_JSON);
    }

    /**
     * Creates plugin hash file
     * @param assetsPath Assets path
     * @private
     */
    private static createPluginHashFile(assetsPath: string): void {
        fs.writeFileSync(
            NPMResolver.getPluginHashFilePath(assetsPath),
            NPMResolver.getHash4PackageLock(
                NPMResolver.getPluginPackageLockPath(assetsPath)
            ),
            { encoding: 'utf8' }
        );
    }

    /**
     * Checks if package-lock.json was updated
     * @param hashFilePath Hash file path
     * @param packageLockPath package-lock.json path
     * @param pluginName Provided plugin name
     * @private
     */
    private static packageLockWasUpdated(
        hashFilePath: string,
        packageLockPath: string,
        pluginName?: string
    ): boolean {
        const oldHash = fs.readFileSync(hashFilePath, { encoding: 'utf8' });
        if (oldHash === NPMResolver.getHash4PackageLock(packageLockPath)) {
            const pluginLog = pluginName ? `[${pluginName}] ` : '';
            console.log(
                cgreen`✓`,
                `${pluginLog}(NPM) node_modules are up to date`
            );
            return false;
        }
        return true;
    }

    public init(): void {
        const registryInitializer = new RegistryInitializer();
        registryInitializer.initRegistry();
    }
}
