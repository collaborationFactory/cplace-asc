/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from "path";
import * as fs from "fs";
import {existsSync} from "fs";
import * as crypto from "crypto";
import * as spawn from 'cross-spawn';
import * as chokidar from "chokidar";
import {FSWatcher} from "chokidar";
import {Scheduler} from "../executor";
import {cerr, cgreen, cred, debug, sleepBusy} from "../utils";
import {PackageVersion} from "./PackageVersion";
import rimraf = require("rimraf");
import Timeout = NodeJS.Timeout;
import { execSync } from "child_process";

export class NPMResolver {
    private static readonly PACKAGE_LOCK_HASH = 'package-lock.hash';
    private static readonly PACKAGE_LOCK_JSON = 'package-lock.json';
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
     * Installs plugin dependencies and create hash
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     */
    public static installPluginDependenciesAndCreateHash(pluginName: string, assetsPath: string): boolean {
        if (fs.existsSync(NPMResolver.getPluginHashFilePath(assetsPath))) {
            const packageLockUpdated = NPMResolver.packageLockWasUpdated(NPMResolver.getPluginHashFilePath(assetsPath), NPMResolver.getPluginPackageLockPath(assetsPath), pluginName);
            if (packageLockUpdated) {
                console.log(cgreen`⇢`, `[${pluginName}] (NPM) package-lock.json was updated...`);
            }
            const hasNodeModules = NPMResolver.getPluginNodeModulesPath(assetsPath);
            if (!hasNodeModules || packageLockUpdated) {
                return NPMResolver.installPluginDependencies(pluginName, assetsPath);
            }
            return false;
        } else {
            return NPMResolver.installPluginDependencies(pluginName, assetsPath);
        }
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
     * Installs plugin dependencies
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     * @private
     */
    private static installPluginDependencies(pluginName: string, assetsPath: string): boolean {
        console.log(`⟲ [${pluginName}] (NPM) installing dependencies...`);
        const res = spawn.sync('npm', ['install', '--cwd', assetsPath, '--prefix', assetsPath, '--no-save']);
        if (res.status !== 0) {
            debug(`[${pluginName}] (NPM) installing dependencies failed with error ${res.stdout}`);
            throw Error(`[${pluginName}] (NPM) installing dependencies failed!`);
        }
        console.log(cgreen`✓`, `[${pluginName}] (NPM) dependencies successfully installed`);
        NPMResolver.createPluginHashFile(assetsPath);
        NPMResolver.removePluginSymlinks(pluginName, assetsPath);
        return true;
    }

    /**
     * Removes symlinks inside plugin node_modules folder
     * @param pluginName Plugin name
     * @param assetsPath Assets folder path
     * @private
     */
    private static removePluginSymlinks(pluginName: string, assetsPath: string): void {
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            console.log(`⟲ [${pluginName}] (NPM) removing symlinks...`);
            const nodeModulesPath = path.resolve(assetsPath, 'node_modules');
            fs.readdirSync(nodeModulesPath).forEach(dir => {
                const dirPath = path.resolve(nodeModulesPath, dir);
                if (fs.lstatSync(dirPath).isSymbolicLink()) {
                    rimraf.sync(dirPath);
                }
            });
            console.log(cgreen`✓`, `[${pluginName}] (NPM) symlinks removed`);
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
     * Gets plugin hash file path
     * @param assetsPath
     * @private
     */
    private static getPluginHashFilePath(assetsPath: string): string {
        return path.join(assetsPath, NPMResolver.NODE_MODULES, NPMResolver.PACKAGE_LOCK_HASH);
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
            NPMResolver.getHash4PackageLock(NPMResolver.getPluginPackageLockPath(assetsPath)),
            {encoding: 'utf8'}
        );
    }

    /**
     * Checks if package-lock.json was updated
     * @param hashFilePath Hash file path
     * @param packageLockPath package-lock.json path
     * @param pluginName Provided plugin name
     * @private
     */
    private static packageLockWasUpdated(hashFilePath: string, packageLockPath: string, pluginName?: string): boolean {
        const oldHash = fs.readFileSync(hashFilePath, {encoding: 'utf8'});
        if (oldHash === NPMResolver.getHash4PackageLock(packageLockPath)) {
            const pluginLog = pluginName ? `[${pluginName}] ` : '';
            console.log(cgreen`✓`, `${pluginLog}(NPM) node_modules are up to date`);
            return false;
        }
        return true;
    }

    private static shouldResolveNpmModules(): boolean {
        return PackageVersion.get().major !== 1;
    }

    public async resolve(): Promise<void> {
        this.initRegistry();
        this.checkAndInstall();

        if (this.watch) {
            this.registerWatchers();
        }

        return Promise.resolve();
    }

    public stop(): void {
        this.watchers.forEach(watcher => {
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
                console.error(cerr`(NPM) error while watching package-lock.json: ${e}`);
                packageJsonWatcher.close();
            });

        // nodeModulesWatcher
        const glob = Scheduler.convertToUnixPath(`${this.getNodeModulesPath()}`);
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
                    console.log(cerr`(NPM) node_modules folder has been removed - restart cplace-asc`);
                    process.exit();
                } else {
                    this.checkAndInstall();
                }
            }, 500);
        };
        nodeModulesWatcher
            .on('ready', () => ready = true)
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
            if (existsSync(path.join(NPMResolver.NODE_MODULES, 'webdriverio'))) {
                console.log(cgreen`⇢`, "Deleting the node_modules folder...");
                rimraf.sync(path.join(NPMResolver.NODE_MODULES));

                // Fun on Windows! rmdirSync can return before the folder is actually deleted completely.
                debug("Deleted, try to recreate...");
                let delCount = 0;
                while (true) {
                    if (delCount > 20) {
                        throw "Waited too long for the node_modules folder to be deleted. Giving up.";
                    }
                    try {
                        fs.mkdirSync(NPMResolver.NODE_MODULES);
                    } catch (e) {
                        debug(e);
                        debug("Wait a little...");
                        sleepBusy(1000);
                        delCount++;
                        continue;
                    }
                    debug("Delete again...");
                    rimraf.sync(path.join(NPMResolver.NODE_MODULES));
                    break;
                }
            }
            if (!existsSync(NPMResolver.NODE_MODULES)) {
                console.log(cgreen`⇢`, "Checkout the node_modules from Git");
                spawn.sync('git', ['checkout', '--', NPMResolver.NODE_MODULES], {
                    stdio: [process.stdin, process.stdout, process.stderr],
                    cwd: this.mainRepo
                });
            }
            console.log(cgreen`⇢`, `(NPM) package.json:v1.0.0 -> node_modules checked in`);
            return;
        } else {
            console.log(cgreen`⇢`, `(NPM) package.json:>v2.0.0 -> checking for npm install`);
        }

        if (this.hasNoNodeModules()) {
            console.log(cgreen`⇢`, `(NPM) node_modules don't exist...`);
            this.doNpmInstallAndCreateHash();
        } else {
            if (fs.existsSync(this.hashFilePath)) {
                if (NPMResolver.packageLockWasUpdated(this.hashFilePath, this.getPackageLockPath())) {
                    console.log(cgreen`⇢`, `(NPM) package-lock.json was updated...`);
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
            cwd: this.mainRepo
        });
        if (result.status !== 0) {
            console.log(cred`✗`, `(NPM) npm install ran into: ${result.error} and failed`);
            throw Error(`✗ (NPM) npm install failed...`);
        }
        console.log(cgreen`⇢`, `(NPM) npm install successful`);
        this.createHashFile();
    }

    private createHashFile() {
        fs.writeFileSync(this.hashFilePath, NPMResolver.getHash4PackageLock(this.getPackageLockPath()), {encoding: 'utf8'});
    }

    private hasNoNodeModules(): boolean {
        const nodeModulesPath = this.getNodeModulesPath();
        if (fs.existsSync(nodeModulesPath)) {
            const directories = fs.readdirSync(nodeModulesPath)
                .filter((name) => fs.statSync(path.join(nodeModulesPath, name)).isDirectory());
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
        return path.resolve(this.mainRepo, NPMResolver.NODE_MODULES, NPMResolver.PACKAGE_LOCK_HASH);
    }

    private getNodeModulesPath(): string {
        return path.resolve(this.mainRepo, NPMResolver.NODE_MODULES);
    }

    private getPackageLockPath(): string {
        return path.resolve(this.mainRepo, NPMResolver.PACKAGE_LOCK_JSON);
    }

    private initRegistry(): void {
        console.info("⟲ Initialising cplace jfrog registry for NPM");
        const registry = '//cplace.jfrog.io/artifactory/api/npm/cplace-npm-local/';
        
        const npmConfig: string = execSync('npm config ls -l').toString();
        const npmrcPath: string | undefined = (npmConfig.match(/userconfig *= *".*"/gi) || [])[0];
        const cleanNpmrcPath: string = npmrcPath.replace(/userconfig *= */, '').replace(/"/gi, '').replace(/\\\\/g, '\\');

        if (!cleanNpmrcPath) {
            console.error(cred`✗`, 'No user npmrc found');
            return;
        }
        if(process.env.ENV_CPLACE_ARTIFACTORY_ACTOR && process.env.ENV_CPLACE_ARTIFACTORY_TOKEN) {
            console.info("⟲ Configuring npm jfrog registry via environment variables");
            if (!this.isJFrogConfigured(registry, cleanNpmrcPath)) {
                this.writeNPMRC(registry, cleanNpmrcPath, Buffer.from(`${process.env.ENV_CPLACE_ARTIFACTORY_ACTOR}:${process.env.ENV_CPLACE_ARTIFACTORY_TOKEN}`).toString('base64'), process.env.ENV_CPLACE_ARTIFACTORY_ACTOR);
            } else {
                console.info(cgreen`✓`, 'cplace npmrc configuration for jfrog already found');
            }
        } else {
            const gradleProps: string = (execSync(path.join(this.mainRepo, 'gradlew properties')) || '').toString();

            if (!gradleProps) {
                console.error(cred`✗`, 'Gradle Properties not found');
            } else {
                const token: string | undefined = (gradleProps.match(/repo\.cplace\.apiToken: *([a-z0-9]+)/gi) || [])[0];
                const user: string | undefined = (gradleProps.match(/repo\.cplace\.apiTokenUser: *([a-z0-9@\-_\.]+)/gi) || [])[0];
                if (token && user) {
                    const cleanToken: string = token.replace(/repo\.cplace\.apiToken: */, '');
                    const cleanUser: string = user.replace(/repo\.cplace\.apiTokenUser: */, '');
                    if (!this.isJFrogConfigured(registry, cleanNpmrcPath)) {
                        this.writeNPMRC(registry, cleanNpmrcPath, Buffer.from(`${cleanUser}:${cleanToken}`).toString('base64'), cleanUser);
                    } else {
                        console.info(cgreen`✓`, 'cplace npmrc configuration for jfrog already found');
                    }
                } else {
                    console.error(cred`✗`, 'jfrog credentials for Gradle not found or configured correctly:', 'https://docs.cplace.io/dev-docs/cplace-architecture/platform-component/build-system/java-artifact-based-builds/#creating-an-api-token-on-cplacejfrogio');
                }
            }
        }
    }

    private isJFrogConfigured(registry: string, npmrcPath: string): boolean {
        debug(`Checking for npmrc at ${npmrcPath}`);
        if(!fs.existsSync(npmrcPath)) {
            return false
        }
        const currentNpmrcConfig: string = fs.readFileSync(npmrcPath, {encoding: 'utf-8'}).toString();
        return currentNpmrcConfig.includes(registry);
    }

    private writeNPMRC(registry, npmrcPath, auth, user) {
        console.info("⟲ Writing npm config to:", npmrcPath);
        let npmrc = `@cplace-next:registry=https:${registry} \n`;
        npmrc = npmrc + `${registry}:_auth=${auth} \n`;
        npmrc = npmrc + `${registry}:always-auth=true \n`;
        npmrc = npmrc + `${registry}:email=${user}`;
        console.log(cgreen`✓`, 'Configured cplace jfrog to .npmrc: ', npmrcPath);
        fs.appendFileSync(npmrcPath, npmrc, {encoding: 'utf-8'});
    };

}
