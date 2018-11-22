/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import { ICompiler } from '../types';
import * as path from 'path';
import { CReplacePlugin } from './CReplacePlugin';
import { isFromLibrary } from '../lib/utils';
import { ChildProcess, spawnSync } from 'child_process';
import * as webpack from 'webpack';

export class TypescriptCompiler implements ICompiler {
    private static readonly entry = 'app.js';
    private static readonly destDir = 'generated_js';
    private readonly externals = [{
        d3: 'd3',
        moment: 'moment',
        underscore: '_'
    }, (context: string, request: string, callback: Function) => {
        if (isFromLibrary(request)) {
            const newRequest = request.substr(1).replace('cf.cplace.', '');
            return callback(null, newRequest);
        }
        callback();
    }];

    constructor(public readonly  pluginName: string, private readonly assetsPath: string) {
    }

    async compile() {
        try {
            console.log('starting...', this.pluginName);
            this._compile();
            await this._bundle();
            // console.log('finished bundling');
        } catch (e) {
            console.log(e);
        }
        return 'done';
    }

    private _compile() {
        // console.log('Compiling typescript...');
        spawnSync('npx', ['tsc'], {
            cwd: path.resolve(this.assetsPath, 'ts'),
            stdio: [process.stdin, process.stdout, process.stderr]
        });
    }

    private _bundle() {
        return new Promise((resolve) => {
            console.log('bundling');
            // @ts-ignore
            webpack(this.getWebpackConfig(), (err, stats) => {
                if (err || stats.hasErrors()) {
                    console.log('Webpack error...', this.pluginName, err, stats.toString({
                        chunks: true,
                        error: true,
                        warnings: true
                    }));
                    // console.log('webpack error', this.pluginName);
                }
                resolve();
            });
        });
    }

    private getWebpackConfig() {
        return {
            context: path.resolve(this.assetsPath, TypescriptCompiler.destDir),
            devtool: 'source-map',
            entry: {
                tsc: './' + TypescriptCompiler.entry
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
                            entry: TypescriptCompiler.entry
                        }
                    }]
                }]
            },
            output: {
                filename: '[name].js',
                path: path.resolve(this.assetsPath, TypescriptCompiler.destDir),
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
}
