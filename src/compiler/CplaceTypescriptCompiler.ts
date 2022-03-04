/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as webpack from 'webpack';
import {Configuration} from 'webpack';
import {isFromLibrary} from '../model/utils';
import {debug, isDebugEnabled} from '../utils';
import * as fs from 'fs';
import * as copyFiles from 'copyfiles';
import {AbstractTypescriptCompiler} from './AbstractTypescriptCompiler';
import {CplaceTSConfigGenerator} from "../model/CplaceTSConfigGenerator";

export class CplaceTypescriptCompiler extends AbstractTypescriptCompiler {
    public static readonly DEST_DIR = 'generated_js';
    private static readonly ENTRY = 'app.js';
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
                isProduction: boolean,
                esTargetVersion: string) {
        super(pluginName, dependencyPaths, assetsPath, mainRepoDir, isProduction, esTargetVersion,'ts', CplaceTypescriptCompiler.DEST_DIR);
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
            const bundleFile = path.resolve(this.assetsPath, CplaceTypescriptCompiler.DEST_DIR, 'tsc.js');
            if (fs.existsSync(bundleFile)) {
                fs.unlinkSync(bundleFile);
            }

            // @ts-ignore
            webpack(this.getWebpackConfig(), (err, stats) => {
                if (err) {
                    debug(err);
                    reject(err);
                } else if (stats?.hasErrors()) {
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
                        type: 'asset/source'
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
            resolve: {
                extensions: ['.ts', '.js']
            },
            target: ['web', this.getEcmaScriptTargetVersion()]
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

    private populateWebpackExternals(): ({ [key: string]: string } | ExternalItemFunction)[] {
        const pluginDir = path.dirname(this.assetsPath);
        const extraTypes = CplaceTSConfigGenerator.getExtraTypes(pluginDir, this.dependencyPaths);

        return [{
            ...CplaceTypescriptCompiler.DEFAULT_EXTERNALS,
            ...(extraTypes ? extraTypes.externals : {})
        }, CplaceTypescriptCompiler.resolveWebpackExternal.bind(this)];
    }

    private static resolveWebpackExternal(data: ExternalItemFunctionData, callback: ExternalItemCallback): void {
        if (typeof data.request === 'string' && isFromLibrary(data.request)) {
            return callback(undefined, CplaceTypescriptCompiler.replaceCplacePluginIdentifier(data.request));
        }
        return callback();
    }

    private static replaceCplacePluginIdentifier(request: string): string {
        return request.replace(/(^@)([a-zA-Z0-9.]+)(\/.+)/gi, (match, at, folder, path) => {
            const resolver = folder.replace(/\./g, '_');
            const module = `.${path}.js`;
            return `window['$${resolver}']('${module}')`;
        });
    }

    private getEcmaScriptTargetVersion(): string {
        const tsconfigJson = fs.readFileSync(path.join(this.mainRepoDir, 'tsconfig.base.json'), 'utf8');
        if (tsconfigJson) {
            const target = JSON.parse(tsconfigJson)?.compilerOptions?.target;
            if (target) {
                debug(`Webpack EcmaScript target version: ${target}`);
                return target;
            }
        }
        const defaultTarget = 'es5';
        debug(`No EcmaScript target version found. Using ${defaultTarget}`);
        return defaultTarget;
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
}


interface ExternalItemFunctionData {
    context?: string;
    request?: ExternalItemRequest;
}

type ExternalItemRequest = string | boolean | string[] | { [index: string]: any };

type ExternalItemCallback = (err?: Error, result?: ExternalItemRequest) => void;

type ExternalItemFunction = (data: ExternalItemFunctionData, callback: ExternalItemCallback) => void;
