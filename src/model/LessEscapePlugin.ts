import {cwarn} from "../utils";

/**
 * Checks improper LESS escaping
 * @param cssOutput CSS string output
 * @private
 */
function checkImproperLessEscaping(cssOutput: string): string | undefined {
    const cssOutputArray = cssOutput.split('\n');
    const foundImproperLessEscaping = cssOutputArray.reduce((acc: string[], val: string) => {
        if (val.includes('calc(') && !val.includes('~') && !val.includes('--')) {
            const spacer = '  ';
            acc.push(spacer.concat(val.trim()));
        }
        return acc;
    }, []);
    if (foundImproperLessEscaping && foundImproperLessEscaping.length) {
        return foundImproperLessEscaping.join('\n');
    }
}

let processedFiles: string[] = [];

/**
 * Processes LESS data and warns if there is an improper LESS escaping
 * @param pluginName Plugin name
 */
export function lessEscapePlugin(pluginName: string) {
    return {
        process: (src, extra) => {
            const improperLessEscaping = checkImproperLessEscaping(src);
            if (improperLessEscaping && !processedFiles.includes(extra.fileInfo.filename)) {
                const spacer = '  ';
                console.log(cwarn`⇢ [${pluginName}] LESS not properly escaped in ${extra.fileInfo.filename}:\n${improperLessEscaping}\n\n${spacer}Please escape LESS the following way:\n${spacer}width: ~"calc(100% - 200px)"; or width: ~"calc(100vw - " @yourVariable ~")";\n`);
                processedFiles.push(extra.fileInfo.filename);
            } else {
                const foundFile = processedFiles.indexOf(extra.fileInfo.filename);
                if (foundFile !== -1) {
                    processedFiles.splice(foundFile, 1);
                }
            }
            return src;
        }
    }
}
