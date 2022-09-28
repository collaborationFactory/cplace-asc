/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */
import { debug } from 'console';
import * as spawn from 'cross-spawn';
import * as os from 'os';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PACKAGE_JSON_PATH = resolve(__dirname, '../../package.json');

/**
 * Returns a human-readable info line with the number of cpus/cores
 * and the current memory details
 */
export function getAvailableStats() {
    const packageJson_String = readFileSync(PACKAGE_JSON_PATH, 'utf8');
    const packageJson = JSON.parse(packageJson_String);
    const versionString = packageJson.version;
    let op: string[] = [];
    op.push(`Currently running version: ${versionString}`);
    op.push(`Available cpus/cores: ${os.cpus().length}`);
    let memoryUsage = process.memoryUsage();
    for (let key in memoryUsage) {
        // @ts-ignore
        op.push(
            `${key}: ${
                Math.round((memoryUsage[key] / 1024 / 1024) * 100) / 100
            }MB`
        );
    }

    return op.join(', ');
}

const LIB_TEST_RE = /@([a-zA-Z0-9.]+)\/.+/;

export function isFromLibrary(file: string) {
    return LIB_TEST_RE.test(file);
}

/**
 * Check if a file is tracked
 */
export function isFileTracked(
    workingDir: string,
    relativePathToFile: string
): boolean {
    const res = spawn.sync(
        'git',
        ['ls-files', '--error-unmatch', relativePathToFile],
        {
            cwd: workingDir,
        }
    );
    if (res.status !== 0) {
        debug(`File ${relativePathToFile} is not tracked`);
        return false;
    }
    return true;
}
