import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as less from 'less';
import * as os from 'os';

import {CompilationResult, ICompiler} from './interfaces';
import {cerr, cgreen, cwarn, formatDuration, GREEN_CHECK} from '../utils';
import {CompressCssCompiler} from './CompressCssCompiler';
import Options = Less.Options;
import {lessPlugins} from "../model/LessPlugins";

export class LessCompiler implements ICompiler {
    private static readonly LESS_SOURCES_DIR = 'less';

    private readonly pathToLessSources: string;
    private readonly pathToEntryFile: string = '';

    constructor(private readonly pluginName: string,
                private readonly dependencyPaths: string[],
                private readonly assetsPath: string,
                private readonly mainRepoDir: string,
                private readonly isProduction: boolean) {
        this.pathToLessSources = path.join(this.assetsPath, LessCompiler.LESS_SOURCES_DIR);

        for (const name of ['plugin', 'cplace']) {
            const pathToEntryFile = path.join(this.pathToLessSources, `${name}.less`);
            if (fs.existsSync(pathToEntryFile)) {
                this.pathToEntryFile = pathToEntryFile;
                break;
            }
        }
        if (!this.pathToEntryFile) {
            throw Error(`[${this.pluginName}] cannot determine path to LESS entry file`);
        }
    }

    compile(): Promise<CompilationResult> {
        const filename = path.basename(this.pathToEntryFile, '.less');
        const entryFile = path.join(this.assetsPath, LessCompiler.LESS_SOURCES_DIR, `${filename}.less`);
        const lessOutputDir = CompressCssCompiler.getCssOutputDir(this.assetsPath);
        const outputFile = path.join(lessOutputDir, `${filename}.css`);
        const sourceMapFile = path.join(lessOutputDir, `${filename}.css.map`);

        const writeFile = promisify(fs.writeFile);

        const start = new Date().getTime();
        console.log(`⟲ [${this.pluginName}] starting LESS compilation...`);
        return new Promise<CompilationResult>((resolve, reject) => {
            const lesscOptions: Options = {
                filename: path.resolve(entryFile),
                plugins: lessPlugins(this.pluginName)
            };
            if (!this.isProduction) {
                lesscOptions.sourceMap = {
                    sourceMapBasepath: path.join(this.assetsPath, LessCompiler.LESS_SOURCES_DIR),
                    sourceMapRootpath: `../${LessCompiler.LESS_SOURCES_DIR}/`,
                    sourceMapURL: `${filename}.css.map`
                };
            }
            
            let lessContent = fs.readFileSync(entryFile, 'utf8');
            this.appendGlobalCSSVariables(lessContent, lesscOptions)
                .then((preParsedLessContent) => {
                    less
                    .render(preParsedLessContent, lesscOptions)
                    .catch((err) => {
                        console.error(cerr`${err}`);
                        throw Error(`[${this.pluginName}] LESS compilation failed`);
                    })
                    .then((output: any) => {

                        let end = new Date().getTime();
                        console.log(cgreen`⇢`, `[${this.pluginName}] LESS compiled, writing output... (${formatDuration(end - start)})`);

                        if (!fs.existsSync(lessOutputDir)) {
                            fs.mkdirSync(lessOutputDir);
                        }

                        const promises = [
                            writeFile(outputFile, output.css, 'utf8')
                        ];
                        if (!this.isProduction) {
                            promises.push(writeFile(sourceMapFile, output.map, 'utf8'));
                        }

                        return Promise
                            .all(promises)
                            .then(() => {
                                let end = new Date().getTime();
                                console.log(GREEN_CHECK, `[${this.pluginName}] LESS finished (${formatDuration(end - start)})`);
                                resolve(CompilationResult.CHANGED);
                            })
                            .catch((err) => {
                                console.error(cerr`${err}`);
                                throw Error(`[${this.pluginName}] Failed to write LESS output`);
                            });
                    })
                    .catch((e) => reject(e));
                })
                .catch((e) => reject(e));
        });
            
    }

    private appendGlobalCSSVariables(lessContent: string, lesscOptions: Options): Promise<string> {
        const content = lessContent;
        return new Promise((res) => {
            less['parse'](content, lesscOptions, (err, root, _imports, _options) => {
                if (err) {
                    throw Error('Unable to pre-parse global css variables')
                } else {
                    res(this.parseLESSVariablesToCSS(content, root._variables));
                }
            });
        })
    }

    private parseLESSVariablesToCSS(lessContent: string, lessVariables: {[key: string]: any} = {}): string {
        let newContent = lessContent;
        const lessVars = Object.keys(lessVariables || {});

        if (lessVars.length) {
            const variables: string[] = lessVars.map((it: string) => {
                const key = it.replace('@', '');
                return `--${key}:${it};`;
            });

            newContent = `
                ${newContent}
                
                :root {
                    ${variables.join(os.EOL)}
                }
            `;
        }

        return newContent;
    }
}
