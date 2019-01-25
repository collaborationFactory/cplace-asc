import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as less from 'less';

import {ICompiler} from './interfaces';
import {cerr, cgreen, formatDuration, GREEN_CHECK} from '../utils';
import {CompressCssCompiler} from './CompressCssCompiler';
import Options = Less.Options;

export class LessCompiler implements ICompiler {
    private static readonly LESS_SOURCES_DIR = 'less';

    private readonly pathToLessSources: string;
    private readonly pathToEntryFile: string = '';

    constructor(private readonly pluginName: string,
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

    compile(): Promise<void> {
        const filename = path.basename(this.pathToEntryFile, '.less');
        const entryFile = path.join(this.assetsPath, LessCompiler.LESS_SOURCES_DIR, `${filename}.less`);
        const lessOutputDir = CompressCssCompiler.getCssOutputDir(this.assetsPath);
        const outputFile = path.join(lessOutputDir, `${filename}.css`);
        const sourceMapFile = path.join(lessOutputDir, `${filename}.css.map`);

        const writeFile = promisify(fs.writeFile);

        const start = new Date().getTime();
        console.log(`⟲ [${this.pluginName}] starting LESS compilation...`);
        return new Promise<void>((resolve, reject) => {
            const lesscOptions: Options = {
                filename: path.resolve(entryFile)
            };
            if (!this.isProduction) {
                lesscOptions.sourceMap = {
                    sourceMapBasepath: path.join(this.assetsPath, LessCompiler.LESS_SOURCES_DIR),
                    sourceMapRootpath: `../${LessCompiler.LESS_SOURCES_DIR}/`,
                    sourceMapURL: `${filename}.css.map`
                };
            }
            less
                .render(fs.readFileSync(entryFile, 'utf8'), lesscOptions)
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
                            resolve();
                        })
                        .catch((err) => {
                            console.error(cerr`${err}`);
                            throw Error(`[${this.pluginName}] Failed to write LESS output`);
                        });
                })
                .catch((e) => reject(e));
        });
    }
}
