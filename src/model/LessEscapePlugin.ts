import { cwarn } from '../utils';

/**
 * Checks improper LESS escaping
 * @param cssOutput CSS string output
 * @private
 */
function checkImproperLessEscaping(cssOutput: string): string | undefined {
    const cssOutputArray = cssOutput.split('\n');
    const foundImproperLessEscaping = cssOutputArray.reduce(
        (acc: string[], val: string) => {
            if (
                val.includes('calc(') &&
                !val.includes('~') &&
                !val.includes('--')
            ) {
                const spacer = '  ';
                acc.push(spacer.concat(val.trim()));
            }
            return acc;
        },
        []
    );
    if (foundImproperLessEscaping && foundImproperLessEscaping.length) {
        return foundImproperLessEscaping.join('\n');
    }
}

let improperLessEscapedFiles: Set<string> = new Set<string>();

/**
 * Processes LESS data and warns if there is an improper LESS escaping
 * @param pluginName Plugin name
 */
export function lessEscapePlugin(pluginName: string) {
    return {
        process: (src, extra) => {
            const improperLessEscaping = checkImproperLessEscaping(src);
            if (
                improperLessEscaping &&
                !improperLessEscapedFiles.has(extra.fileInfo.filename)
            ) {
                const spacer = ' ';
                console.log(
                    cwarn`⇢ [${pluginName}] LESS not properly escaped in ${extra.fileInfo.filename}:`,
                    cwarn`\n${improperLessEscaping}\n\n`,
                    cwarn`${spacer}Please escape LESS the following way:\n`,
                    cwarn`${spacer}width: ~"calc(100% - 200px)"; or width: ~"calc(100vw - " @yourVariable ~")";\n`
                );
                improperLessEscapedFiles.add(extra.fileInfo.filename);
            } else {
                // This is needed to avoid having warnings for the already checked files (watch)
                if (improperLessEscapedFiles.has(extra.fileInfo.filename)) {
                    improperLessEscapedFiles.delete(extra.fileInfo.filename);
                }
            }
            return src;
        },
    };
}
