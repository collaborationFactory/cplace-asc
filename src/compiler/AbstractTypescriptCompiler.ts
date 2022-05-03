/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as crypto from 'crypto';
import * as spawn from 'cross-spawn';
import { CompilationResult, ICompiler } from './interfaces';
import {
    cgreen,
    debug,
    formatDuration,
    GREEN_CHECK,
    isDebugEnabled,
} from '../utils';
import * as fs from 'fs';
import * as glob from 'glob';

export abstract class AbstractTypescriptCompiler implements ICompiler {
    private static readonly HASH_FILE = 'typings.hash';

    protected constructor(
        protected readonly pluginName: string,
        protected readonly dependencyPaths: string[],
        protected readonly assetsPath: string,
        protected readonly mainRepoDir: string,
        protected readonly isProduction: boolean,
        protected readonly srcFolderName: string,
        protected readonly outputDirName: string
    ) {}

    async compile(): Promise<CompilationResult> {
        const start = new Date().getTime();
        console.log(
            `⟲ [${
                this.pluginName
            }] starting ${this.getJobName()} compilation...`
        );
        this.runTsc();
        let end = new Date().getTime();
        console.log(
            cgreen`⇢`,
            `[${
                this.pluginName
            }] ${this.getJobName()} compiled, starting bundling... (${formatDuration(
                end - start
            )})`
        );
        await this.doPostProcessing();
        end = new Date().getTime();
        console.log(
            GREEN_CHECK,
            `[${
                this.pluginName
            }] ${this.getJobName()} finished (${formatDuration(end - start)})`
        );

        try {
            const oldHash = this.readCompilationHash();
            const newHash = await this.computeAndUpdateCompilationHash();
            debug(
                `(TypescriptCompiler - ${this.getJobName()}) [${
                    this.pluginName
                }] Old hash: ${oldHash} - New hash: ${newHash}`
            );
            if (newHash && oldHash === newHash) {
                console.log(
                    cgreen`⇢`,
                    `[${this.pluginName}] TypeScript API did not change, no recompilation of dependants required`
                );
                return CompilationResult.UNCHANGED;
            }
        } catch (e) {
            debug(
                `(TypescriptCompiler - ${this.getJobName()}) [${
                    this.pluginName
                }] Failed to get and compute hashes: ${e}`
            );
        }
        return CompilationResult.CHANGED;
    }

    protected abstract getJobName(): string;

    protected async doPostProcessing(): Promise<void> {}

    private runTsc(): void {
        const tsAssetsPath = path.resolve(this.assetsPath, this.srcFolderName);
        const tscExecutable = this.getTscExecutable();
        let args = ['--project', tsAssetsPath];
        if (isDebugEnabled()) {
            args.push('--extendedDiagnostics');
        }
        debug(
            `(TypescriptCompiler) [${
                this.pluginName
            }] executing command '${tscExecutable} ${args.join(' ')}'`
        );
        const result = spawn.sync(tscExecutable, args, {
            stdio: [process.stdin, process.stdout, process.stderr],
        });

        debug(
            `(TypescriptCompiler) [${this.pluginName}] tsc return code: ${result.status}`
        );
        if (result.status !== 0) {
            throw Error(
                `[${this.pluginName}] TypeScript compilation failed...`
            );
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
        return path.resolve(
            this.assetsPath,
            this.outputDirName,
            AbstractTypescriptCompiler.HASH_FILE
        );
    }

    private readCompilationHash(): string | null {
        const hashPath = this.getHashFilePath();
        if (fs.existsSync(hashPath)) {
            return fs.readFileSync(hashPath, { encoding: 'utf8' });
        } else {
            return null;
        }
    }

    private computeAndUpdateCompilationHash(): Promise<string> {
        const generatedJsPath = path.resolve(
            this.assetsPath,
            this.outputDirName
        );
        const hashPath = this.getHashFilePath();

        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            glob(`${generatedJsPath}/**/*.d.ts`, {}, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }

                files.forEach((f) => {
                    const data = fs.readFileSync(f);
                    hash.update(data);
                });

                const newHash = hash.digest('hex');
                try {
                    fs.writeFileSync(hashPath, newHash, { encoding: 'utf8' });
                    resolve(newHash);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
