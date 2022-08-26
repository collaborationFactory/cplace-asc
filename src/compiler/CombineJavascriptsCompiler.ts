import * as path from 'path';

import { CompilationResult, ICompiler } from './interfaces';
import { cerr, debug, formatDuration, GREEN_CHECK } from '../utils';
import * as fs from 'fs';
import rimraf = require('rimraf');
import * as webpack from 'webpack';
import { Configuration } from 'webpack';

export class CombineJavascriptsCompiler implements ICompiler {
    public static readonly OUTPUT_DIR = '_generated_';
    public static readonly ENTRY_FILE_NAME = 'javaScriptIncludesToBeCompressed.txt';
    public static readonly OUTPUT_FILE_NAME = 'compressed.js';

    public static readonly INCLUDE_COMMENT = "#";

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
            CombineJavascriptsCompiler.ENTRY_FILE_NAME
        );
    }

    compile(): Promise<CompilationResult> {
        return new Promise<CompilationResult>((resolve) => {
            const generatedDir = CombineJavascriptsCompiler.getOutputDir(this.assetsPath);
            const outputFile = path.join(
                generatedDir,
                CombineJavascriptsCompiler.OUTPUT_FILE_NAME
            );

            if (!fs.existsSync(this.pathToEntryFile)) {
                this.cleanOutput(outputFile);
                return resolve(CompilationResult.CHANGED);
            }

            if (!fs.existsSync(generatedDir)) {
                fs.mkdirSync(generatedDir);
            }

            const start = new Date().getTime();
            console.log(`⟲ [${this.pluginName}] starting to combine javascripts...`);

            this.combineJavascripts().then(() => {
                let end = new Date().getTime();
                console.log(
                    GREEN_CHECK,
                    `[${
                        this.pluginName
                    }] Combining javascripts finished (${formatDuration(end - start)})`
                );
                return resolve(CompilationResult.CHANGED);
            })
            .catch((err) => {
                console.error(cerr`${err}`);
                throw Error(
                    `[${this.pluginName}] Failed to combine javascripts`
                );
            });
        });
    }

    public static getOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, CombineJavascriptsCompiler.OUTPUT_DIR);
    }

    private combineJavascripts() {
        return new Promise((resolve, reject) => {
            // @ts-ignore
            webpack(this.getCombineJavascriptWebpackConfig(), (err, stats) => {
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

    private getCombineJavascriptWebpackConfig(): Configuration {
        const config: Configuration = {
            context: path.resolve(
                this.assetsPath
            ),
            externals: {
                jquery: 'jQuery'
            },
            resolveLoader: {
                modules: [path.resolve(__dirname, '../../', 'node_modules')],
            },
            entry: {
                compressed: this.getCombineJavascriptSources()
            },
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        use: [ 'script-loader' ]
                    }
                ]
            },
            output: {
                filename: '[name].js',
                path: CombineJavascriptsCompiler.getOutputDir(this.assetsPath)
            },
        };

        return config;
    }

    private getCombineJavascriptSources(): string[] {
        const result: string[] = [];

        const includesFile = fs.readFileSync(this.pathToEntryFile, 'utf8');
        let includePaths = includesFile.replace(/\r/g, '').split('\n');
        includePaths.forEach((includeLine) => {
            // skip empty lines and lines beggining with '#'
            if (includeLine.trim().length > 0 && !includeLine.trim().startsWith(CombineJavascriptsCompiler.INCLUDE_COMMENT)) {    
                if (includeLine.endsWith('*')) {
                    // read all files from a potential folder and add them to combine
                    const lineWithoutAsterix = includeLine.trim().substring(0, includeLine.length - 2);
                    const resolvedFolder = path.resolve(this.assetsPath, '.' + lineWithoutAsterix);    
                    if (fs.existsSync(resolvedFolder) && fs.lstatSync(resolvedFolder).isDirectory() ) {
                        fs.readdirSync(resolvedFolder).forEach((file) => {

                            const absolutePath = path.join(resolvedFolder, file)
                            if (fs.lstatSync(absolutePath).isFile()) {
                                const relativePath = path.relative(this.assetsPath, absolutePath);
                                result.push('.\\' + relativePath);
                            }
                        });
                    }
                } else {
                    const resolvedFile = path.resolve(this.assetsPath, '.' + includeLine);
                    const relativePath = path.relative(this.assetsPath, resolvedFile);
                    result.push('.\\' + relativePath);
                }
            }
        })

        debug(`(CombineJavascriptsCompiler) [${this.pluginName}] will combine following files: \n ${result}`);
        return result;
    }

    private cleanOutput(outputFile: string): void {
        rimraf.sync(outputFile);
        rimraf.sync(outputFile.concat('.map'));
    }
}
