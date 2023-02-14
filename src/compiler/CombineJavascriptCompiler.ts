import * as path from 'path';

import { CompilationResult, ICompiler } from './interfaces';
import { cerr, cgreen, debug, formatDuration, GREEN_CHECK } from '../utils';
import * as fs from 'fs';
import * as webpack from 'webpack';
import { Configuration } from 'webpack';
import * as TerserPlugin from 'terser-webpack-plugin';
import {
    getCplaceAscNodeModulesPath,
    getProjectNodeModulesPath,
} from '../model/utils';

export class CombineJavascriptCompiler implements ICompiler {
    public static readonly OUTPUT_DIR = '_generated_';
    public static readonly ENTRY_FILE_NAME =
        'javaScriptIncludesToBeCompressed.txt';
    public static readonly OUTPUT_FILE_NAME = 'compressed.js';

    public static readonly INCLUDE_COMMENT = '#';

    private readonly pathToEntryFile: string = '';

    constructor(
        private readonly pluginName: string,
        private readonly dependencyPaths: string[],
        private readonly assetsPath: string,
        private readonly mainRepoDir: string,
        private readonly isProduction: boolean
    ) {
        this.pathToEntryFile = path.join(
            this.assetsPath,
            CombineJavascriptCompiler.ENTRY_FILE_NAME
        );
    }

    compile(): Promise<CompilationResult> {
        return new Promise<CompilationResult>((resolve, reject) => {
            const generatedDir = CombineJavascriptCompiler.getOutputDir(
                this.assetsPath
            );
            const outputFile = path.join(
                generatedDir,
                CombineJavascriptCompiler.OUTPUT_FILE_NAME
            );

            if (!fs.existsSync(this.pathToEntryFile)) {
                this.cleanOutput(outputFile);
                return resolve(CompilationResult.CHANGED);
            }

            if (!fs.existsSync(generatedDir)) {
                fs.mkdirSync(generatedDir);
            }

            const start = new Date().getTime();
            console.log(
                `⟲ [${this.pluginName}] starting to combine javascript...`
            );

            const sourcesToCombine: string[] =
                this.getCombineJavascriptSources();
            if (sourcesToCombine.length == 0) {
                console.log(
                    cgreen`⇢`,
                    `[${this.pluginName}] No javascript specified to combine.`
                );
                return resolve(CompilationResult.UNCHANGED);
            }

            this.combineJavascript(sourcesToCombine)
                .then(() => {
                    let end = new Date().getTime();
                    console.log(
                        GREEN_CHECK,
                        `[${
                            this.pluginName
                        }] Combining javascript finished (${formatDuration(
                            end - start
                        )})`
                    );
                    return resolve(CompilationResult.CHANGED);
                })
                .catch((err) => {
                    console.error(cerr`${err}`);
                    reject(`[${this.pluginName}] Failed to combine javascript`);
                });
        }).catch((err) => {
            throw Error(err);
        });
    }

    public static getOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, CombineJavascriptCompiler.OUTPUT_DIR);
    }

    private combineJavascript(sourcesToCombine: string[]) {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            webpack(
                this.getCombineJavascriptWebpackConfig(sourcesToCombine),
                (err, stats) => {
                    if (stats && stats.hasErrors()) {
                        reject(stats.toString());
                    } else if (err) {
                        reject(err);
                    } else {
                        resolve(
                            `(CombineJavascriptCompiler) [${this.pluginName}] JavaScript successfully bundled!`
                        );
                    }
                }
            );
        });
    }

    private getCombineJavascriptWebpackConfig(
        sourcesToCombine: string[]
    ): Configuration {
        return {
            mode: 'production',
            context: path.resolve(this.assetsPath),
            externals: {
                jquery: 'jQuery',
            },
            resolveLoader: {
                modules: [
                    getProjectNodeModulesPath(),
                    getCplaceAscNodeModulesPath(),
                ],
            },
            entry: {
                compressed: sourcesToCombine,
            },
            module: {
                rules: [
                    {
                        // Load everything with script-loader since all libraries are needed as gloabls in cplace.
                        // Webpack's minimization/uglifying does not work with script-loader as the whole script is wrapped as is.
                        // For that reason, an uglify-loader first uglifies the input script (using UglifyJsPlugin with default options)
                        // and then loads it with script-loader
                        test: /\.js$/,
                        use: ['script-loader', 'uglify-loader'],
                    },
                ],
            },
            optimization: {
                minimize: true,
                minimizer: [
                    new TerserPlugin({
                        minify: TerserPlugin.terserMinify,
                        parallel: true,
                        extractComments: true,
                        terserOptions: {
                            format: {
                                comments: false,
                            },
                        },
                    }),
                ],
            },
            output: {
                filename: '[name].js',
                path: CombineJavascriptCompiler.getOutputDir(this.assetsPath),
            },
        };
    }

    private getCombineJavascriptSources(): string[] {
        const result: string[] = [];

        const includesFile = fs.readFileSync(this.pathToEntryFile, 'utf8');
        let includePaths = includesFile.replace(/\r/g, '').split('\n');
        includePaths.forEach((includeLine) => {
            // skip empty lines and lines beggining with '#'
            if (
                includeLine.trim().length > 0 &&
                !includeLine
                    .trim()
                    .startsWith(CombineJavascriptCompiler.INCLUDE_COMMENT)
            ) {
                if (includeLine.endsWith('*')) {
                    // read all files from a potential folder and add them to combine
                    const lineWithoutAsterix = includeLine
                        .trim()
                        .substring(0, includeLine.length - 2);
                    const resolvedFolder = path.resolve(
                        this.assetsPath,
                        '.' + lineWithoutAsterix
                    );
                    if (
                        fs.existsSync(resolvedFolder) &&
                        fs.lstatSync(resolvedFolder).isDirectory()
                    ) {
                        fs.readdirSync(resolvedFolder).forEach((file) => {
                            const absolutePath = path.join(
                                resolvedFolder,
                                file
                            );
                            if (fs.lstatSync(absolutePath).isFile()) {
                                const relativePath = path.relative(
                                    this.assetsPath,
                                    absolutePath
                                );
                                result.push(`.${path.sep}${relativePath}`);
                            }
                        });
                    }
                } else {
                    const resolvedFile = path.resolve(
                        this.assetsPath,
                        '.' + includeLine
                    );
                    const relativePath = path.relative(
                        this.assetsPath,
                        resolvedFile
                    );
                    result.push(`.${path.sep}${relativePath}`);
                }
            }
        });

        debug(
            `(CombineJavascriptCompiler) [${this.pluginName}] will combine following files: \n ${result}`
        );
        return result;
    }

    private cleanOutput(outputFile: string): void {
        fs.rmSync(outputFile, { recursive: true, force: true });
        fs.rmSync(outputFile.concat('.map'), { recursive: true, force: true });
    }
}
