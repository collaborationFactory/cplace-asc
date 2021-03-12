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
import {SpawnSyncReturns} from "child_process";

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

    public static installPluginDependencies(pluginName: string, assetsPath: string): SpawnSyncReturns<Buffer> {
        console.log(`⟲ (NPM) installing dependencies for ${pluginName}`);
        const res = spawn.sync('npm', ['install', `--prefix ${assetsPath}`], {
            stdio: ['pipe', 'pipe', process.stderr]
        });
        if (res.status !== 0) {
            throw Error(`✗ (NPM) installing dependencies for ${pluginName} failed...`);
        }
        return res;
    }

    public async resolve(): Promise<void> {
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

    private shouldResolveNpmModules(): boolean {
        return PackageVersion.get().major !== 1;
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
        if (!this.shouldResolveNpmModules()) {
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
                if (this.packageLockWasUpdated()) {
                    console.log(cgreen`⇢`, `(NPM) package-lock.json was updated...`);
                    this.doNpmInstallAndCreateHash();
                }
            } else {
                this.doNpmInstallAndCreateHash();
            }
        }
    }

    private packageLockWasUpdated(): boolean {
        const oldHash = fs.readFileSync(this.hashFilePath, {encoding: 'utf8'});
        if (oldHash === this.getHash4PackageLock()) {
            console.log(cgreen`✓`, `(NPM) node_modules are up to date`);
            return false;
        }
        return true;
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

    private writeToJavaScriptIncludesToBeCompressedTextFile(pluginName: string): void {
        const javaScriptIncludesToBeCompressedTextFilePath = `${this.mainRepo}/${pluginName}/assets/javaScriptIncludesToBeCompressed.txt`;

        fs.readFile(javaScriptIncludesToBeCompressedTextFilePath, 'utf8', (err, buff) => {

            const pathToInclude = `/generated_js/vendor.js`;
            if (buff.includes(pathToInclude)) {
                // removes included path if already exists
                const includedPaths = buff.split('\n');
                const index = includedPaths.indexOf(pathToInclude);
                includedPaths.splice(index, 1);
                buff = includedPaths.join('\n');
            }

            const content = buff + `\n${pathToInclude}`;

            fs.writeFile(javaScriptIncludesToBeCompressedTextFilePath, content, (e) => {
                if (e) {
                    console.log(`Error writing ${pathToInclude} to ${javaScriptIncludesToBeCompressedTextFilePath}`)
                } else {
                    console.log(`Path ${pathToInclude} written to ${javaScriptIncludesToBeCompressedTextFilePath}`);
                }
            });

        });
    }

    private getHash4PackageLock(): string {
        const hash = crypto.createHash('sha256');
        const data = fs.readFileSync(this.getPackageLockPath());
        hash.update(data);
        return hash.digest('hex');
    }

    private createHashFile() {
        fs.writeFileSync(this.hashFilePath, this.getHash4PackageLock(), {encoding: 'utf8'});
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
}
