export const RED_CROSS = cred`✗`;
export const GREEN_CHECK = cgreen`✓`;

let DEBUG_ENABLED = false;

export function isDebugEnabled(): boolean {
    return DEBUG_ENABLED;
}

export function enableDebug(debugEnabled = true): void {
    DEBUG_ENABLED = debugEnabled;
}

export function debug(content: string | Error): void {
    if (DEBUG_ENABLED) {
        if (typeof content === 'string') {
            console.debug(`\x1b[37m✹ ${content}\x1b[0m`);
        } else {
            console.debug(content);
        }
    }
}

export function cred(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `\x1b[1;31m`;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    result += `\x1b[0m`;
    return result;
}

export function cwarn(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `\x1b[0;33m`;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    result += `\x1b[0m`;
    return result;
}

export function cerr(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `✗ `;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    return cred`${result}`;
}

export function cgreen(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `\x1b[1;32m`;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    result += `\x1b[0m`;
    return result;
}

export function csucc(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `✓ `;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    return cgreen`${result}`;
}
