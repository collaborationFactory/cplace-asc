import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as less from 'less';

import {ICompiler} from './interfaces';
import {cgreen, GREEN_CHECK} from '../utils';

export class LessCompiler implements ICompiler {
    private static readonly LESS_SOURCES_DIR = 'less';
    private static readonly LESS_OUTPUT_DIR = 'generated_css';

    private readonly pathToLessSources: string;
    private readonly pathToEntryFile: string = '';

    constructor(private readonly pluginName: string, private readonly assetsPath: string) {
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

    async compile(): Promise<void> {
        const filename = path.basename(this.pathToEntryFile, '.less');
        const entryFile = path.join(this.assetsPath, LessCompiler.LESS_SOURCES_DIR, `${filename}.less`);
        const outputFile = path.join(this.assetsPath, LessCompiler.LESS_OUTPUT_DIR, `${filename}.css`);
        const sourceMapFile = path.join(this.assetsPath, LessCompiler.LESS_OUTPUT_DIR, `${filename}.map`);

        const writeFile = promisify(fs.writeFile);

        console.log(`⟲ [${this.pluginName}] starting LESS compilation...`);
        return new Promise<void>((resolve) => {
            less
                .render(fs.readFileSync(entryFile, 'utf8'), {
                    filename: path.resolve(entryFile)
                })
                .catch((err) => {
                    throw Error(`[${this.pluginName}] LESS compilation failed...`)
                })
                .then((output: any) => {
                    console.log(cgreen`⇢`, `[${this.pluginName}] LESS compiled, writing output...`);

                    return Promise
                        .all([
                            writeFile(outputFile, output.css, 'utf8'),
                            writeFile(sourceMapFile, output.map, 'utf8')
                        ])
                        .then(() => {
                            console.log(GREEN_CHECK, `[${this.pluginName}] LESS finished`);
                            resolve();
                        })
                        .catch((err) => {
                            throw Error(`[${this.pluginName}] Failed to write LESS output`);
                        });
                });
        });
    }
}
