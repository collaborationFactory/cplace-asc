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
import {cgreen, debug, formatDuration, GREEN_CHECK, isDebugEnabled} from '../utils';
import * as fs from 'fs';
import * as copyFiles from 'copyfiles';

export class TypescriptCompiler implements ICompiler {
    private static readonly ENTRY = 'app.js';
    private static readonly DEST_DIR = 'generated_js';
    private static readonly STATIC_IMPORT_EXTENSIONS = 'html|htm';

    private readonly externals: ExternalsElement[] = [{
        d3: 'd3',
        moment: 'moment',
        underscore: '_',
        draggable: 'Draggable'
    }, this.resolveWebpackExternal.bind(this)];

    constructor(private readonly pluginName: string,
                private readonly assetsPath: string,
                private readonly mainRepoDir: string,
                private readonly isProduction: boolean) {
    }

    public static getJavaScriptOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, this.DEST_DIR);
    }

    async compile(): Promise<void> {
        const start = new Date().getTime();
        console.log(`⟲ [${this.pluginName}] starting TypeScript compilation...`);
        this.runTsc();
        await this.copyStaticFiles();
        let end = new Date().getTime();
        console.log(cgreen`⇢`, `[${this.pluginName}] TypeScript compiled, starting bundling... (${formatDuration(end - start)})`);
        await this.runWebpack();
        end = new Date().getTime();
        console.log(GREEN_CHECK, `[${this.pluginName}] TypeScript finished (${formatDuration(end - start)})`);
    }

    private runTsc(): void {
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
            // remove previously generated webpack bundle if exists (so it does not append)
            const bundleFile = path.resolve(this.assetsPath, TypescriptCompiler.DEST_DIR, 'tsc.js');
            if (fs.existsSync(bundleFile)) {
                fs.unlinkSync(bundleFile);
            }

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
        const config: Configuration = {
            context: path.resolve(this.assetsPath, TypescriptCompiler.DEST_DIR),
            entry: {
                tsc: './' + TypescriptCompiler.ENTRY
            },
            externals: this.externals,
            mode: 'development',
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: [{
                            loader: path.resolve(__filename, '../contextInjectorLoader.js'),
                            options: {
                                entry: TypescriptCompiler.ENTRY
                            }
                        }]
                    },
                    {
                        test: new RegExp(`\.(${TypescriptCompiler.STATIC_IMPORT_EXTENSIONS})$`),
                        use: [{
                            loader: path.resolve(__filename, '../../../node_modules/raw-loader')
                        }]
                    }
                ]
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

        if (!this.isProduction) {
            config.devtool = 'source-map';
            // @ts-ignore
            config.module.rules.push({
                test: /\.js$/,
                exclude: /node_modules/,
                use: [{
                    loader: path.resolve(__filename, '../../../node_modules/source-map-loader')
                }],
                enforce: 'pre'
            });
        }

        return config;
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

    private async copyStaticFiles(): Promise<void> {
        const tsAssetsPath = path.resolve(this.assetsPath, 'ts');
        const srcGlob = `${tsAssetsPath}/**/*.+(${TypescriptCompiler.STATIC_IMPORT_EXTENSIONS})`;
        const dest = path.resolve(this.assetsPath, TypescriptCompiler.DEST_DIR) + path.sep;
        const upLength = tsAssetsPath.split(path.sep).length;
        const options = {
            up: upLength,
            verbose: isDebugEnabled()
        };

        debug(`(TypescriptCompiler) [${this.pluginName}] copying static files...`);
        return new Promise((resolve, reject) => {
            copyFiles([srcGlob, dest], options, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }
}
