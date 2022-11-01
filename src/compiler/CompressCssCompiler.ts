import * as path from 'path';

import { CompilationResult, ICompiler } from './interfaces';
import { debug, formatDuration, GREEN_CHECK } from '../utils';
import * as fs from 'fs';
import * as CleanCSS from 'clean-css';
import { writeFileSync } from 'fs';

export class CompressCssCompiler implements ICompiler {
    public static readonly CSS_SOURCES_DIR = 'css';
    public static readonly CSS_OUTPUT_DIR = 'generated_css';

    public static readonly ENTRY_FILE_NAME = 'imports.css';
    public static readonly OUTPUT_FILE_NAME = 'compressed.css';

    private readonly pathToCssSources: string;
    private readonly pathToEntryFile: string = '';

    constructor(
        private readonly pluginName: string,
        private readonly dependencyPaths: string[],
        private readonly assetsPath: string,
        private readonly mainRepoDir: string,
        private readonly isProduction: boolean
    ) {
        this.pathToCssSources = path.join(
            this.assetsPath,
            CompressCssCompiler.CSS_SOURCES_DIR
        );
        this.pathToEntryFile = path.join(
            this.pathToCssSources,
            CompressCssCompiler.ENTRY_FILE_NAME
        );
    }

    public static getCssOutputDir(assetsPath: string): string {
        return path.resolve(assetsPath, this.CSS_OUTPUT_DIR);
    }

    compile(): Promise<CompilationResult> {
        return new Promise<CompilationResult>((resolve) => {
            const generatedCssDir = CompressCssCompiler.getCssOutputDir(
                this.assetsPath
            );
            const outputFile = path.join(
                generatedCssDir,
                CompressCssCompiler.OUTPUT_FILE_NAME
            );

            if (!fs.existsSync(this.pathToEntryFile)) {
                this.cleanOutput(outputFile);
                return resolve(CompilationResult.CHANGED);
            }

            if (!fs.existsSync(generatedCssDir)) {
                fs.mkdirSync(generatedCssDir);
            }

            const start = new Date().getTime();
            console.log(`⟲ [${this.pluginName}] starting CSS compression...`);

            new CleanCSS({
                inline: 'all',
                level: {
                    2: {
                        all: true,
                    },
                },
                rebaseTo: generatedCssDir,
                output: outputFile,
                sourceMap: true,
            }).minify([this.pathToEntryFile], (error, output) => {
                if (error) {
                    this.cleanOutput(outputFile);
                    debug(
                        `[${this.pluginName}] (CompressCssCompiler) minifying with clean-css failed with error: ${error}`
                    );
                    throw Error(
                        `[${this.pluginName}] (CompressCssCompiler) CSS compression failed...`
                    );
                }

                const sourceMapFileName =
                    CompressCssCompiler.OUTPUT_FILE_NAME.concat('.map');
                const sourceMapFilePath = outputFile.concat('.map');
                const sourceMappingURL = `\n/*# sourceMappingURL=${sourceMapFileName} */`;
                let cssContent = output.styles;

                if (!this.isProduction) {
                    cssContent = cssContent.concat(sourceMappingURL);
                    const assetsRelativePath =
                        this.pluginName.concat(`/assets`);
                    const normalizedSourceMap = output.sourceMap
                        .toString()
                        .replace(new RegExp(assetsRelativePath, 'g'), '..');
                    writeFileSync(
                        sourceMapFilePath,
                        normalizedSourceMap,
                        'utf-8'
                    );
                }
                writeFileSync(outputFile, cssContent, 'utf-8');

                const end = new Date().getTime();
                console.log(
                    GREEN_CHECK,
                    `[${
                        this.pluginName
                    }] CSS compression finished (${formatDuration(
                        end - start
                    )})`
                );

                return resolve(CompilationResult.CHANGED);
            });
        });
    }

    private cleanOutput(outputFile: string): void {
        fs.rmSync(outputFile);
        fs.rmSync(outputFile.concat('.map'));
    }
}
