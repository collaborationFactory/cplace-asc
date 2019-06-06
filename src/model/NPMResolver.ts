/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as spawn from 'cross-spawn';

export class NPMResolver {
    private static readonly PACKAGE_LOCK_HASH = 'package-lock.hash';
    private static readonly PACKAGE_LOCK_JSON = 'package-lock.json';
    private static readonly PACKAGE_JSON = 'package.json';
    private static readonly NODE_MODULES = 'node_modules';
    private mainRepo: string;
    private hasHashFile: boolean;
    private readonly hashFilePath: string;

    constructor(mainRepo: string) {
        this.mainRepo = mainRepo;
        if (this.getPackageVersion() === '2.0.0') {
            console.log(`(NPM) package.json version is 2.0.0 -> checking if npm install is needed`);
            if (this.hasNoNodeModules()) {
                console.log(`(NPM) There seems to be no installed Node Modules`);
                this.doNpmInstall();
            } else {
                this.hashFilePath = this.getHashFilePath();
                this.hasHashFile = fs.existsSync(this.hashFilePath);
                if (this.hasHashFile) {
                    if (this.packageLockWasUpdated()) {
                        console.log(`(NPM) package-lock.json was updated`);
                        this.doNpmInstall();
                    }
                } else {
                    this.createHashFile();
                    this.doNpmInstall();
                }
            }
        }
        console.log(`(NPM) package.json version is 1.0.0 -> no npm install needed`);
        this.hashFilePath = '';
        this.hasHashFile = false;
    }

    private packageLockWasUpdated(): boolean {
        const oldHash = fs.readFileSync(this.hashFilePath, {encoding: 'utf8'});
        if (oldHash === this.getHash4PackageLock()) {
            console.log(`(NPM) node_modules are up to date`);
            return false;
        }
        return true;
    }

    private doNpmInstall() {
        console.log(`(NPM) executing 'npm install'`);
        const result = spawn.sync('npm', ['install'], {
            stdio: [process.stdin, process.stdout, process.stderr]
        });
        if (result.status !== 0) {
            console.log(`(NPM) npm install ran into: ${result.error} and failed`);
            throw Error(`(NPM) npm install failed...`);
        }
        console.log(`(NPM) npm install return code: ${result.status}`);
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
        if (fs.existsSync(packagePath)) {
            const packageJson_String = fs.readFileSync(packagePath, 'utf8');
            const packageJson = JSON.parse(packageJson_String);
            return packageJson.version
        }
        throw Error(`(NPM) Package-JSON is not provided, please add it`);
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
