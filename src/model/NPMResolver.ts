/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as process from 'process';
import * as fs from 'fs';
import { existsSync } from 'fs';
import * as crypto from 'crypto';
import * as spawn from 'cross-spawn';
import * as chokidar from 'chokidar';
import { FSWatcher } from 'chokidar';
import { Scheduler } from '../executor';
import { cerr, cgreen, cred, cwarn, debug, sleepBusy } from '../utils';
import { PackageVersion } from './PackageVersion';
import * as rimraf from 'rimraf';
import Timeout = NodeJS.Timeout;
import { RegistryInitializer } from './RegistryInitializer';

export class NPMResolver {
    private static readonly PACKAGE_LOCK_HASH = 'package-lock.hash';
    private static readonly PACKAGE_LOCK_JSON = 'package-lock.json';
    private static readonly PACKAGE_JSON = 'package.json';
    private static readonly NODE_MODULES = 'node_modules';

    private readonly mainRepo: string;
    private readonly hashFilePath: string;
    private watchers: FSWatcher[];

    constructor(mainRepo: string, private watch: boolean) {
        this.mainRepo = mainRepo;
        this.hashFilePath = this.getHashFilePath();
        this.watchers = [];
    }

    /**
     * Installs plugin dependencies
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     * @private
     */
    public static installPluginDependencies(
        pluginName: string,
        assetsPath: string
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
        debug(
            `[${pluginName}] (NPM) running: npm install --force --package-lock false`
        );
        const res = spawn.sync('npm', [
            'install',
            '--force',
            '--package-lock',
            'false',
        ]);
        if (res.status !== 0) {
            debug(
                `[${pluginName}] (NPM) installing dependencies failed with error ${res.stderr}`
            );
            throw Error(
                `[${pluginName}] (NPM) installing dependencies failed!`
            );
        }
        console.log(
            cgreen`✓`,
            `[${pluginName}] (NPM) dependencies successfully installed`
        );
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
                        rimraf.sync(dirPath);
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

    private static shouldResolveNpmModules(): boolean {
        return PackageVersion.get().major !== 1;
    }

    public async resolve(): Promise<void> {
        const registryInitializer = new RegistryInitializer();
        registryInitializer.initRegistry();
        this.checkAndInstall();

        if (this.watch) {
            this.registerWatchers();
        }

        return Promise.resolve();
    }

    public stop(): void {
        this.watchers.forEach((watcher) => {
            watcher.close();
        });
    }

    private registerWatchers() {
        // packageLockWatcher
        const packageJsonWatcher = chokidar.watch([this.getPackageLockPath()]);
        this.watchers.push(packageJsonWatcher);
        packageJsonWatcher
            .on('change', () => {
                this.checkAndInstall();
            })
            .on('error', (e) => {
                console.error(
                    cerr`(NPM) error while watching package-lock.json: ${e}`
                );
                packageJsonWatcher.close();
            });

        // nodeModulesWatcher
        const glob = Scheduler.convertToUnixPath(
            `${this.getNodeModulesPath()}`
        );
        const nodeModulesWatcher = chokidar.watch(glob);
        this.watchers.push(nodeModulesWatcher);
        let ready: boolean = false;
        let debounce: Timeout;

        const handleEvent = () => {
            if (!ready) {
                return;
            }
            debounce && clearTimeout(debounce);
            debounce = setTimeout(() => {
                if (!fs.existsSync(this.getNodeModulesPath())) {
                    console.log(
                        cerr`(NPM) node_modules folder has been removed - restart cplace-asc`
                    );
                    process.exit();
                } else {
                    this.checkAndInstall();
                }
            }, 500);
        };
        nodeModulesWatcher
            .on('ready', () => (ready = true))
            .on('unlink', handleEvent)
            .on('unlinkDir', handleEvent)
            .on('error', (e) => {
                console.error(cerr`(NPM) node_modules watcher failed: ${e}`);
                nodeModulesWatcher.close();
            });
    }

    private checkAndInstall() {
        if (!NPMResolver.shouldResolveNpmModules()) {
            // clean up the checked-in node_modules if required
            if (
                existsSync(path.join(NPMResolver.NODE_MODULES, 'webdriverio'))
            ) {
                console.log(cgreen`⇢`, 'Deleting the node_modules folder...');
                rimraf.sync(path.join(NPMResolver.NODE_MODULES));

                // Fun on Windows! rmdirSync can return before the folder is actually deleted completely.
                debug('Deleted, try to recreate...');
                let delCount = 0;
                while (true) {
                    if (delCount > 20) {
                        throw 'Waited too long for the node_modules folder to be deleted. Giving up.';
                    }
                    try {
                        fs.mkdirSync(NPMResolver.NODE_MODULES);
                    } catch (e) {
                        debug(e);
                        debug('Wait a little...');
                        sleepBusy(1000);
                        delCount++;
                        continue;
                    }
                    debug('Delete again...');
                    rimraf.sync(path.join(NPMResolver.NODE_MODULES));
                    break;
                }
            }
            if (!existsSync(NPMResolver.NODE_MODULES)) {
                console.log(cgreen`⇢`, 'Checkout the node_modules from Git');
                spawn.sync(
                    'git',
                    ['checkout', '--', NPMResolver.NODE_MODULES],
                    {
                        stdio: [process.stdin, process.stdout, process.stderr],
                        cwd: this.mainRepo,
                    }
                );
            }
            console.log(
                cgreen`⇢`,
                `(NPM) package.json:v1.0.0 -> node_modules checked in`
            );
            return;
        } else {
            console.log(
                cgreen`⇢`,
                `(NPM) package.json:>v2.0.0 -> checking for npm install`
            );
        }

        if (this.hasNoNodeModules()) {
            console.log(cgreen`⇢`, `(NPM) node_modules don't exist...`);
            this.doNpmInstallAndCreateHash();
        } else {
            if (fs.existsSync(this.hashFilePath)) {
                if (
                    NPMResolver.packageLockWasUpdated(
                        this.hashFilePath,
                        this.getPackageLockPath()
                    )
                ) {
                    console.log(
                        cgreen`⇢`,
                        `(NPM) package-lock.json was updated...`
                    );
                    this.doNpmInstallAndCreateHash();
                }
            } else {
                this.doNpmInstallAndCreateHash();
            }
        }
    }

    private doNpmInstallAndCreateHash() {
        console.log(`⟲ (NPM) executing npm install`);
        const result = spawn.sync('npm', ['install'], {
            stdio: [process.stdin, process.stdout, process.stderr],
            cwd: this.mainRepo,
        });
        if (result.status !== 0) {
            console.log(
                cred`✗`,
                `(NPM) npm install ran into: ${result.error} and failed`
            );
            throw Error(`✗ (NPM) npm install failed...`);
        }
        console.log(cgreen`⇢`, `(NPM) npm install successful`);
        this.createHashFile();
    }

    private createHashFile() {
        fs.writeFileSync(
            this.hashFilePath,
            NPMResolver.getHash4PackageLock(this.getPackageLockPath()),
            { encoding: 'utf8' }
        );
    }

    private hasNoNodeModules(): boolean {
        const nodeModulesPath = this.getNodeModulesPath();
        if (fs.existsSync(nodeModulesPath)) {
            const directories = fs
                .readdirSync(nodeModulesPath)
                .filter((name) =>
                    fs.statSync(path.join(nodeModulesPath, name)).isDirectory()
                );
            if (directories.length === 0) {
                return true;
            }
        } else {
            fs.mkdirSync(this.getNodeModulesPath());
            return true;
        }
        return false;
    }

    private getHashFilePath(): string {
        return path.resolve(
            this.mainRepo,
            NPMResolver.NODE_MODULES,
            NPMResolver.PACKAGE_LOCK_HASH
        );
    }

    private getNodeModulesPath(): string {
        return path.resolve(this.mainRepo, NPMResolver.NODE_MODULES);
    }

    private getPackageLockPath(): string {
        return path.resolve(this.mainRepo, NPMResolver.PACKAGE_LOCK_JSON);
    }
}
