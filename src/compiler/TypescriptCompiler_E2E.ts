/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as crypto from 'crypto';
import * as spawn from 'cross-spawn';
import {CompilationResult, ICompiler} from './interfaces';
import {cgreen, debug, formatDuration, GREEN_CHECK, isDebugEnabled} from '../utils';
import * as fs from 'fs';
import * as glob from 'glob';

export class TypescriptCompiler_E2E implements ICompiler {
    private static readonly DEST_DIR = 'generated_e2e';
    private static readonly HASH_FILE = 'typings.hash';

    constructor(private readonly pluginName: string,
                private readonly assetsPath: string,
                private readonly mainRepoDir: string) {
    }

    public static getJavaScriptOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, this.DEST_DIR);
    }

    async compile(): Promise<CompilationResult> {
        const start = new Date().getTime();
        console.log(`⟲ [${this.pluginName}] starting TypeScript E2E compilation...`);
        this.runTsc();
        let end = new Date().getTime();
        console.log(GREEN_CHECK, `[${this.pluginName}] TypeScript finished (${formatDuration(end - start)})`);

        try {
            const oldHash = this.readCompilationHash();
            const newHash = await this.computeAndUpdateCompilationHash();
            debug(`(TypescriptCompiler) [${this.pluginName}] Old hash: ${oldHash} - New hash: ${newHash}`);
            if (newHash && oldHash === newHash) {
                console.log(cgreen`⇢`, `[${this.pluginName}] TypeScript API did not change, no recompilation of dependants required`);
                return CompilationResult.UNCHANGED;
            }
        } catch (e) {
            debug(`(TypescriptCompiler) [${this.pluginName}] Failed to get and compute hashes: ${e}`);
        }
        return CompilationResult.CHANGED;
    }

    private runTsc(): void {
        const tsAssetsPath = path.resolve(this.assetsPath, 'e2e');
        const tscExecutable = this.getTscExecutable();
        let args = ['--project', tsAssetsPath];
        if (isDebugEnabled()) {
            args.push('--extendedDiagnostics');
        }
        debug(`(TypescriptCompiler) [${this.pluginName}] executing command '${tscExecutable} ${args.join(' ')}'`);
        const result = spawn.sync(tscExecutable, args, {
            stdio: [process.stdin, process.stdout, process.stderr]
        });

        debug(`(TypescriptCompiler) [${this.pluginName}] tsc return code: ${result.status}`);
        if (result.status !== 0) {
            throw Error(`[${this.pluginName}] TypeScript compilation failed...`);
        }
    }

    private getTscExecutable(): string {
        return path.resolve(
            this.mainRepoDir,
            'node_modules',
            'typescript',
            'bin',
            'tsc'
        );
    }

    private getHashFilePath(): string {
        return path.resolve(this.assetsPath, TypescriptCompiler_E2E.DEST_DIR, TypescriptCompiler_E2E.HASH_FILE);
    }

    private readCompilationHash(): string | null {
        const hashPath = this.getHashFilePath();
        if (fs.existsSync(hashPath)) {
            return fs.readFileSync(hashPath, {encoding: 'utf8'});
        } else {
            return null;
        }
    }

    private computeAndUpdateCompilationHash(): Promise<string> {
        const generatedJsPath = path.resolve(this.assetsPath, TypescriptCompiler_E2E.DEST_DIR);
        const hashPath = this.getHashFilePath();

        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            glob(`${generatedJsPath}/**/*.d.ts`, {}, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }

                files.forEach(f => {
                    const data = fs.readFileSync(f);
                    hash.update(data);
                });

                const newHash = hash.digest('hex');
                try {
                    fs.writeFileSync(hashPath, newHash, {encoding: 'utf8'});
                    resolve(newHash);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
