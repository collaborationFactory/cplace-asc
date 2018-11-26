import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import * as less from 'less';

import {LessEntryFile} from '../types';
import {ICompiler} from './interfaces';


export class LessCompiler implements ICompiler {
    private static readonly srcDir = 'less';
    private static readonly destDir = 'generated_css';

    private readonly entry: LessEntryFile;

    constructor(public readonly pluginName: string, private readonly assetsPath: string) {
        if (fs.existsSync(path.join(this.assetsPath, LessCompiler.srcDir, 'plugin.less'))) {
            this.entry = 'plugin';
        } else {
            this.entry = 'cplace';
        }

    }

    async compile() {
        const entryFile = path.join(this.assetsPath, LessCompiler.srcDir, `${this.entry}.less`);
        const outputFile = path.join(this.assetsPath, LessCompiler.destDir, `${this.entry}.css`);
        const sourceMapFile = path.join(this.assetsPath, LessCompiler.destDir, `${this.entry}.map`);

        const writeFile = promisify(fs.writeFile);

        return new Promise((resolve) => {
            less.render(fs.readFileSync(entryFile, 'utf8'), {
                filename: path.resolve(entryFile)
            })
                .then((output: any) => {
                    Promise.all([
                        writeFile(outputFile, output.css),
                        writeFile(sourceMapFile, output.map)
                    ])
                        .then(() => resolve())
                        .catch((err) => console.log('Failed to write compile less to disk', err));
                })
                .catch((err) => console.log('Failed to compile less', err));
        });
    }
}
