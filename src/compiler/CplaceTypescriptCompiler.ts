/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import { CReplacePlugin } from './CReplacePlugin';
import * as webpack from 'webpack';
import { Configuration, ExternalsElement } from 'webpack';
import { isFromLibrary } from '../model/utils';
import { debug, isDebugEnabled } from '../utils';
import * as fs from 'fs';
import * as copyFiles from 'copyfiles';
import { AbstractTypescriptCompiler } from './AbstractTypescriptCompiler';
import { CplaceTSConfigGenerator } from '../model/CplaceTSConfigGenerator';

export class CplaceTypescriptCompiler extends AbstractTypescriptCompiler {
    public static readonly DEST_DIR = 'generated_js';
    private static readonly ENTRY = 'app.js';
    private static readonly STATIC_IMPORT_EXTENSIONS = 'html|htm';

    private static readonly DEFAULT_EXTERNALS = {
        d3: 'd3',
        moment: 'moment',
        underscore: '_',
        draggable: 'Draggable',
    };

    constructor(
        pluginName: string,
        dependencyPaths: string[],
        assetsPath: string,
        mainRepoDir: string,
        isProduction: boolean
    ) {
        super(
            pluginName,
            dependencyPaths,
            assetsPath,
            mainRepoDir,
            isProduction,
            'ts',
            CplaceTypescriptCompiler.DEST_DIR
        );
    }

    public static getJavaScriptOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, this.DEST_DIR);
    }

    protected getJobName(): string {
        return 'cplace TypeScript (UI)';
    }

    protected async doPostProcessing(): Promise<void> {
        await this.copyStaticFiles();
        await this.runWebpack();
    }

    private runWebpack() {
        return new Promise((resolve, reject) => {
            // remove previously generated webpack bundle if exists (so it does not append)
            const bundleFile = path.resolve(
                this.assetsPath,
                CplaceTypescriptCompiler.DEST_DIR,
                'tsc.js'
            );
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
            context: path.resolve(
                this.assetsPath,
                CplaceTypescriptCompiler.DEST_DIR
            ),
            entry: {
                tsc: './' + CplaceTypescriptCompiler.ENTRY,
            },
            externals: this.populateWebpackExternals(),
            mode: 'development',
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: [
                            {
                                loader: path.resolve(
                                    __filename,
                                    '../contextInjectorLoader.js'
                                ),
                                options: {
                                    entry: CplaceTypescriptCompiler.ENTRY,
                                },
                            },
                        ],
                    },
                    {
                        test: new RegExp(
                            `\.(${CplaceTypescriptCompiler.STATIC_IMPORT_EXTENSIONS})$`
                        ),
                        use: [
                            {
                                loader: path.resolve(
                                    __filename,
                                    '../../../node_modules/raw-loader'
                                ),
                            },
                        ],
                    },
                ],
            },
            output: {
                filename: '[name].js',
                path: path.resolve(
                    this.assetsPath,
                    CplaceTypescriptCompiler.DEST_DIR
                ),
                pathinfo: true,
                /**
                 * The plugin will be exported as a webpackContext with exported name in the app.ts.
                 * This gives us the capability to (globally) resolve all given module.
                 * @link https://webpack.js.org/guides/dependency-management/#require-context
                 * @link https://webpack.js.org/configuration/output/
                 */
                library: '$' + this.pluginName.replace(/\./g, '_'),
                libraryExport: 'default',
            },
            plugins: [
                new CReplacePlugin(),
                new webpack.IgnorePlugin({
                    resourceRegExp: /(index\.js|vendor\.js)$/,
                    contextRegExp: new RegExp(`\.*(${this.pluginName}).*`)
                })
            ],
            resolve: {
                extensions: ['.ts', '.js'],
            },
        };

        if (!this.isProduction) {
            config.devtool = 'source-map';
            // @ts-ignore
            config.module.rules.push({
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: path.resolve(
                            __filename,
                            '../../../node_modules/source-map-loader'
                        ),
                    },
                ],
                enforce: 'pre',
            });
        }

        return config;
    }

    private populateWebpackExternals(): ExternalsElement[] {
        const pluginDir = path.dirname(this.assetsPath);
        const extraTypes = CplaceTSConfigGenerator.getExtraTypes(
            pluginDir,
            this.dependencyPaths
        );

        return [
            {
                ...CplaceTypescriptCompiler.DEFAULT_EXTERNALS,
                ...(extraTypes ? extraTypes.externals : {}),
            },
            this.resolveWebpackExternal.bind(this),
        ];
    }

    private resolveWebpackExternal(
        context: string,
        request: string,
        callback: Function
    ) {
        if (isFromLibrary(request)) {
            const newRequest = request.substr(1);
            return callback(null, newRequest);
        }
        callback();
    }

    private async copyStaticFiles(): Promise<void> {
        const tsAssetsPath = path.resolve(this.assetsPath, 'ts');
        const srcGlob = `${tsAssetsPath}/**/*.+(${CplaceTypescriptCompiler.STATIC_IMPORT_EXTENSIONS})`;
        const dest =
            path.resolve(this.assetsPath, CplaceTypescriptCompiler.DEST_DIR) +
            path.sep;
        const upLength = tsAssetsPath.split(path.sep).length;
        const options = {
            up: upLength,
            verbose: isDebugEnabled(),
        };

        debug(
            `(TypescriptCompiler) [${this.pluginName}] copying static files...`
        );
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
