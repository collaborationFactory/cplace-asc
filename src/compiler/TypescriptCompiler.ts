/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import {CReplacePlugin} from './CReplacePlugin';
import * as spawn from 'cross-spawn';
import * as webpack from 'webpack';
import {Configuration, ExternalsElement} from 'webpack';
import {ICompiler} from './interfaces';
import {isFromLibrary} from '../model/utils';
import {cgreen, debug, GREEN_CHECK, isDebugEnabled} from '../utils';

export class TypescriptCompiler implements ICompiler {
    private static readonly ENTRY = 'app.js';
    private static readonly DEST_DIR = 'generated_js';

    private readonly externals: ExternalsElement[] = [{
        d3: 'd3',
        moment: 'moment',
        underscore: '_',
        draggable: 'Draggable'
    }, this.resolveWebpackExternal.bind(this)];

    constructor(private readonly pluginName: string, private readonly assetsPath: string, private readonly mainRepoDir: string) {
    }

    public static getJavaScriptOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, this.DEST_DIR);
    }

    async compile(): Promise<void> {
        console.log(`⟲ [${this.pluginName}] starting TypeScript compilation...`);
        this.runTsc();
        console.log(cgreen`⇢`, `[${this.pluginName}] TypeScript compiled, starting bundling...`);
        await this.runWebpack();
        console.log(GREEN_CHECK, `[${this.pluginName}] TypeScript finished`);
    }

    private runTsc() {
        const tsAssetsPath = path.resolve(this.assetsPath, 'ts');
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

    private runWebpack() {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            webpack(this.getWebpackConfig(), (err, stats) => {
                if (err) {
                    reject(err);
                } else if (stats.hasErrors()) {
                    throw Error(stats.toString());
                } else {
                    resolve();
                }
            });
        });
    }

    private getWebpackConfig(): Configuration {
        return {
            context: path.resolve(this.assetsPath, TypescriptCompiler.DEST_DIR),
            devtool: 'source-map',
            entry: {
                tsc: './' + TypescriptCompiler.ENTRY
            },
            externals: this.externals,
            mode: 'development',
            module: {
                rules: [{
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: [{
                        loader: path.resolve(__filename, '../contextInjectorLoader.js'),
                        options: {
                            entry: TypescriptCompiler.ENTRY
                        }
                    }]
                }]
            },
            output: {
                filename: '[name].js',
                path: path.resolve(this.assetsPath, TypescriptCompiler.DEST_DIR),
                pathinfo: true,
                /**
                 * The plugin will be exported as a webpackContext with exported name in the app.ts.
                 * This gives us the capability to (globally) resolve all given module.
                 * @link https://webpack.js.org/guides/dependency-management/#require-context
                 * @link https://webpack.js.org/configuration/output/
                 */
                library: '$' + this.pluginName.replace(/\./g, '_'),
                libraryExport: 'default'
            },
            plugins: [
                new CReplacePlugin()
            ],
            resolve: {
                extensions: ['.ts', '.js']
            }
        };
    }

    private resolveWebpackExternal(context: string, request: string, callback: Function) {
        if (isFromLibrary(request)) {
            const newRequest = request.substr(1);
            return callback(null, newRequest);
        }
        callback();
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
}
