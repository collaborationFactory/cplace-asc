/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as spawn from 'cross-spawn';
import * as chokidar from "chokidar";
import {FSWatcher} from "chokidar";
import {Scheduler} from "../executor";
import {cerr, cgreen, cred} from "../utils";
import Timeout = NodeJS.Timeout;

export class NPMResolver {
    private static readonly PACKAGE_LOCK_HASH = 'package-lock.hash';
    private static readonly PACKAGE_LOCK_JSON = 'package-lock.json';
    private static readonly PACKAGE_JSON = 'package.json';
    private static readonly NODE_MODULES = 'node_modules';
    private mainRepo: string;
    private readonly hashFilePath: string;
    private watchers: FSWatcher[];

    constructor(mainRepo: string, private watch: boolean) {
        this.mainRepo = mainRepo;
        this.hashFilePath = this.getHashFilePath();
        this.watchers = [];
    }

    public async resolve(): Promise<void> {
        if (!fs.existsSync(this.getPackagePath())) {
            console.warn(cred`!`, `[NPM] package.json file not found, skipping resolution...`);
            return Promise.resolve();
        }

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
        return this.getPackageVersion() !== '1.0.0';
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
                console.error(cerr`[NPM] error while watching package-lock.json: ${e}`);
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
                    console.log(cerr`[NPM] node_modules folder has been removed - restart cplace-asc`);
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
                console.error(cerr`[NPM] node_modules watcher failed: ${e}`);
                nodeModulesWatcher.close();
            });
    }

    private checkAndInstall() {
        if (!this.shouldResolveNpmModules()) {
            console.log(cgreen`⇢`, `[NPM] package.json:v1.0.0 -> node_modules checked in`);
            return;
        } else {
            console.log(cgreen`⇢`, `[NPM] package.json:>v2.0.0 -> checking for npm install`);
        }

        if (this.hasNoNodeModules()) {
            console.log(cgreen`⇢`, `[NPM] node_modules don't exist...`);
            this.doNpmInstallAndCreateHash();
        } else {
            if (fs.existsSync(this.hashFilePath)) {
                if (this.packageLockWasUpdated()) {
                    console.log(cgreen`⇢`, `[NPM] package-lock.json was updated...`);
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
            console.log(cgreen`✓`, `[NPM] node_modules are up to date`);
            return false;
        }
        return true;
    }

    private doNpmInstallAndCreateHash() {
        console.log(`⟲ [NPM] executing npm install`);
        const result = spawn.sync('npm', ['install'], {
            stdio: [process.stdin, process.stdout, process.stderr],
            cwd: this.mainRepo
        });
        if (result.status !== 0) {
            console.log(cred`✗`, `[NPM] npm install ran into: ${result.error} and failed`);
            throw Error(`✗ [NPM] npm install failed...`);
        }
        console.log(cgreen`⇢`, `[NPM] npm install successful`);
        this.createHashFile();
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

    private getPackageVersion(): string {
        const packagePath = this.getPackagePath();
        if (!fs.existsSync(packagePath)) {
            console.error(cerr`[NPM] Could not find package.json in repo ${this.mainRepo} - aborting...`);
            throw Error(cerr`[NPM] Could not find package.json in repo ${this.mainRepo} - aborting...`);
        } else {
            const packageJson_String = fs.readFileSync(packagePath, 'utf8');
            const packageJson = JSON.parse(packageJson_String);
            return packageJson.version
        }

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

    private getPackagePath(): string {
        return path.resolve(this.mainRepo, NPMResolver.PACKAGE_JSON);
    }
}
