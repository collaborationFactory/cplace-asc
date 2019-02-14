import * as path from 'path';

import {ICompiler} from './interfaces';
import {debug, formatDuration, GREEN_CHECK} from '../utils';
import * as spawn from 'cross-spawn';
import * as fs from 'fs';

export class CompressCssCompiler implements ICompiler {
    public static readonly CSS_SOURCES_DIR = 'css';
    public static readonly CSS_OUTPUT_DIR = 'generated_css';

    public static readonly ENTRY_FILE_NAME = 'imports.css';
    public static readonly OUTPUT_FILE_NAME = 'compressed.css';

    private readonly pathToCssSources: string;
    private readonly pathToEntryFile: string = '';

    constructor(private readonly pluginName: string,
                private readonly assetsPath: string,
                private readonly mainRepoDir: string,
                private readonly isProduction: boolean) {
        this.pathToCssSources = path.join(this.assetsPath, CompressCssCompiler.CSS_SOURCES_DIR);
        this.pathToEntryFile = path.join(this.pathToCssSources, CompressCssCompiler.ENTRY_FILE_NAME);
    }

    public static getCssOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, this.CSS_OUTPUT_DIR);
    }

    compile(): Promise<void> {
        const generatedCssDir = CompressCssCompiler.getCssOutputDir(this.assetsPath);
        const outputFile = path.join(generatedCssDir, CompressCssCompiler.OUTPUT_FILE_NAME);

        if (!fs.existsSync(generatedCssDir)) {
            fs.mkdirSync(generatedCssDir);
        }

        const start = new Date().getTime();
        console.log(`⟲ [${this.pluginName}] starting CSS compression...`);

        const cleanCssExecutable = this.getCleanCssExecutable();
        const args = ['-o', outputFile, this.pathToEntryFile, '--source-map'];
        debug(`(CompressCssCompiler) [${this.pluginName}] executing command '${cleanCssExecutable} ${args.join(' ')}'`);

        const result = spawn.sync(cleanCssExecutable, args, {
            stdio: [process.stdin, process.stdout, process.stderr]
        });

        debug(`(CompressCssCompiler) [${this.pluginName}] clean-css return code: ${result.status}`);
        if (result.status !== 0) {
            throw Error(`[${this.pluginName}] CSS compression failed...`);
        }

        const end = new Date().getTime();
        console.log(GREEN_CHECK, `[${this.pluginName}] CSS compression finished (${formatDuration(end - start)})`);

        return new Promise<void>(resolve => resolve());
    }

    private getCleanCssExecutable(): string {
        return path.resolve(
            this.mainRepoDir,
            'node_modules',
            'clean-css',
            'bin',
            'cleancss'
        );
    }
}
