/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */
import * as os from 'os';
import { StringObj } from '../types';

export function getAvailableStats() {
    let op: string[] = [];
    op.push(`Available cpus/cores: ${os.cpus().length}`);
    let memoryUsage = process.memoryUsage();
    for (let key in memoryUsage) {
        // @ts-ignore
        op.push(`${key}: ${Math.round(memoryUsage[key] / 1024 / 1024 * 100) / 100}MB`);
    }

    return op.join(', ');
}

let LIB_TEST_RE = /@cf\.cplace\.platform\/.+/;

export function isFromLibrary(file: string) {
    return LIB_TEST_RE.test(file);
}


export function getPathDependency(dependency: string, path: string) {
    const o: StringObj<Array<string>> = {};
    o[`@${dependency}/*`] = [path + '/*'];
    return o;
}

export function getRelPath(path: string, isSubRepo = false) {
    return `${isSubRepo ? '../main/' : ''}../../../${path}`;
}
