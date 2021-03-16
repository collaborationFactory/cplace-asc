/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import {CReplacePlugin} from './CReplacePlugin';
import * as webpack from 'webpack';
import {Configuration, ExternalsElement} from 'webpack';
import {isFromLibrary} from '../model/utils';
import {cgreen, debug, formatDuration, isDebugEnabled} from '../utils';
import * as fs from 'fs';
import * as copyFiles from 'copyfiles';
import {AbstractTypescriptCompiler} from './AbstractTypescriptCompiler';
import {CplaceTSConfigGenerator} from "../model/CplaceTSConfigGenerator";
import {NPMResolver} from "../model/NPMResolver";
import spawn = require("cross-spawn");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

export class CplaceTypescriptCompiler extends AbstractTypescriptCompiler {
    public static readonly DEST_DIR = 'generated_js';
    private static readonly ENTRY = 'app.js';
    private static readonly JAVASCRIPT_TO_BE_COMPRESSED_PATH = 'javaScriptIncludesToBeCompressed.txt'
    private static readonly STATIC_IMPORT_EXTENSIONS = 'html|htm';

    private static readonly DEFAULT_EXTERNALS = {
        d3: 'd3',
        moment: 'moment',
        underscore: '_',
        draggable: 'Draggable'
    };

    constructor(pluginName: string,
                dependencyPaths: string[],
                assetsPath: string,
                mainRepoDir: string,
                isProduction: boolean) {
        super(pluginName, dependencyPaths, assetsPath, mainRepoDir, isProduction, 'ts', CplaceTypescriptCompiler.DEST_DIR);
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
        await this.buildPluginVendors();
    }

    private runWebpack() {
        return new Promise((resolve, reject) => {
            // remove previously generated webpack bundle if exists (so it does not append)
            const bundleFile = path.resolve(this.assetsPath, CplaceTypescriptCompiler.DEST_DIR, 'tsc.js');
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
            context: path.resolve(this.assetsPath, CplaceTypescriptCompiler.DEST_DIR),
            entry: {
                tsc: './' + CplaceTypescriptCompiler.ENTRY
            },
            externals: this.populateWebpackExternals(),
            mode: 'development',
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: [{
                            loader: path.resolve(__filename, '../contextInjectorLoader.js'),
                            options: {
                                entry: CplaceTypescriptCompiler.ENTRY
                            }
                        }]
                    },
                    {
                        test: new RegExp(`\.(${CplaceTypescriptCompiler.STATIC_IMPORT_EXTENSIONS})$`),
                        use: [{
                            loader: path.resolve(__filename, '../../../node_modules/raw-loader')
                        }]
                    }
                ]
            },
            output: {
                filename: '[name].js',
                path: path.resolve(this.assetsPath, CplaceTypescriptCompiler.DEST_DIR),
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

    private populateWebpackExternals(): ExternalsElement[] {
        const pluginDir = path.dirname(this.assetsPath);
        const extraTypes = CplaceTSConfigGenerator.getExtraTypes(pluginDir, this.dependencyPaths);

        return [{
            ...CplaceTypescriptCompiler.DEFAULT_EXTERNALS,
            ...(extraTypes ? extraTypes.externals : {})
        }, this.resolveWebpackExternal.bind(this)];
    }

    private resolveWebpackExternal(context: string, request: string, callback: Function) {
        if (isFromLibrary(request)) {
            const newRequest = request.substr(1);
            return callback(null, newRequest);
        }
        callback();
    }

    private async copyStaticFiles(): Promise<void> {
        const tsAssetsPath = path.resolve(this.assetsPath, 'ts');
        const srcGlob = `${tsAssetsPath}/**/*.+(${CplaceTypescriptCompiler.STATIC_IMPORT_EXTENSIONS})`;
        const dest = path.resolve(this.assetsPath, CplaceTypescriptCompiler.DEST_DIR) + path.sep;
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

    /**
     * Creates plugin vendors
     * @private
     */
    private async buildPluginVendors(): Promise<any> {
        if (!fs.existsSync(path.join(this.assetsPath, 'package.json'))) {
            return Promise.resolve(true);
        }
        console.log(`⟲ [${this.pluginName}] Building vendors...`);
        const startTime = new Date().getTime();
        return new Promise(async (resolve, reject) => {
            NPMResolver.installPluginDependenciesAndCreateHash(this.pluginName, this.assetsPath);
            this.tscPluginIndex();
            await this.bundlePluginDependencies();
            await this.writeToJavaScriptToBeCompressed(this.assetsPath);
            const endTime = new Date().getTime();
            console.log(cgreen`✓`, `[${this.pluginName}] Vendors built (${formatDuration(endTime - startTime)})`);
            resolve(true);
        });
    }

    /**
     * Compiles plugin index.ts
     * @private
     */
    private tscPluginIndex(): void {
        const tsc = path.resolve(__dirname, '../../', 'node_modules/.bin/tsc');
        const index = path.join(this.assetsPath, 'index.ts');
        if (!fs.existsSync(index)) {
            throw Error(`✗ [${this.pluginName}] index.ts not found!`);
        }
        const res = spawn.sync(tsc, [path.join(this.assetsPath, 'index.ts')]);
        if (res.status !== 0) {
            throw Error(`✗ [${this.pluginName}] index.ts TS compilation failed!`);
        }
    }

    /**
     * Gets plugin webpack config
     * @private
     */
    private getPluginWebpackConfig(): Configuration {
        return {
            mode: 'production',
            entry: path.resolve(this.assetsPath, 'index.js'),
            output: {
                path: path.resolve(this.assetsPath, 'generated_js'),
                filename: 'vendor.js'
            },
            resolve: {
                modules: ['node_modules']
            },
            optimization: {
                minimize: true
            },
            devtool: false,
            plugins: [
                new MiniCssExtractPlugin({
                    filename: path.resolve(this.assetsPath, 'generated_css/vendor.css')
                })
            ],
            module: {
                rules: [
                    {
                        test: /\.(css|less|scss|sass)$/i,
                        use: [
                            MiniCssExtractPlugin.loader,
                            'css-loader',
                            'less-loader',
                            'sass-loader'
                        ]
                    }
                ]
            }
        }
    }

    /**
     * Bundles plugin dependencies
     * @private
     */
    private bundlePluginDependencies(): Promise<any> {
        const startTime = new Date().getTime();
        console.log(`⟲ [${this.pluginName}] Starting dependencies bundling...`);
        return new Promise<any>((resolve, reject) => {
            const config = this.getPluginWebpackConfig();
            webpack(config, (err, stats) => {
                if (err) {
                    reject(`✗ ${err.message}`);
                } else if (stats.hasErrors()) {
                    throw Error(`✗ ${stats.toString()}`);
                } else {
                    const endTime = new Date().getTime();
                    console.log(cgreen`✓`, `[${this.pluginName}] Dependencies bundled (${formatDuration(endTime - startTime)})`);
                    resolve();
                }
            });
        });
    }

    /**
     * Writes vendor.js import to javaScriptIncludesToBeCompressed.txt
     * @param assetsPath Provided assets path
     * @private
     */
    private writeToJavaScriptToBeCompressed(assetsPath: string): Promise<any> {

        return new Promise<any>((resolve, reject) => {
            const javaScriptToBeCompressedPath = path.join(assetsPath, CplaceTypescriptCompiler.JAVASCRIPT_TO_BE_COMPRESSED_PATH);

            fs.readFile(javaScriptToBeCompressedPath, 'utf8', (err, buff) => {

                if (err) {
                    throw Error(`✗ Error reading ${javaScriptToBeCompressedPath}`);
                }

                const pathToInclude = `/${CplaceTypescriptCompiler.DEST_DIR}/vendor.js`;
                if (buff.includes(pathToInclude)) {
                    // removes included path if already exists
                    const includedPaths = buff.split('\n');
                    const index = includedPaths.indexOf(pathToInclude);
                    includedPaths.splice(index, 1);
                    buff = includedPaths.join('\n');
                }

                const content = buff + `\n${pathToInclude}`;

                fs.writeFile(javaScriptToBeCompressedPath, content, (e) => {
                    if (e) {
                        throw Error(`✗ Error writing ${pathToInclude} to ${javaScriptToBeCompressedPath}`);
                    }
                    resolve(true);
                });
            });
        });
    }
}
