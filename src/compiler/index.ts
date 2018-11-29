/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {LessCompiler} from './LessCompiler';
import {ICompileRequest} from '../types';
import {TypescriptCompiler} from './TypescriptCompiler';
import {ICompilerConstructor} from './interfaces';
import {cerr} from '../utils';

export const MESSAGE_PROCESS_COMPLETED = 'done';
export const MESSAGE_PROCESS_FAILED = 'failed';

/* ==================
 *      This file will be called as main process by `ExecutorService` as specified by
 *      `ExecutorService#COMPILER_ENTRY_POINT`.
 * ================== */

if (require.main === module) {
    process.on('message', (request: ICompileRequest) => {
        handleRequest(request).then(() => {
            if (!process.send) {
                throw Error('must be called as a worker');
            }
            process.send(MESSAGE_PROCESS_COMPLETED);
        }, () => {
            if (process.send) {
                process.send(MESSAGE_PROCESS_FAILED);
            }
        });
    });

    async function handleRequest(request: ICompileRequest) {
        // verify that all required values are present
        if (!request.pluginName || !request.assetsPath) {
            throw Error('Invalid request');
        }

        let CompilerConstructor: ICompilerConstructor;
        if (request.ts) {
            CompilerConstructor = TypescriptCompiler;
        } else if (request.less) {
            CompilerConstructor = LessCompiler;
        } else {
            console.error(cerr`unknown compile type - neither ts nor less`);
            throw Error(`unknown compile type - neither ts nor less`);
        }

        let compiler;
        try {
            compiler = new CompilerConstructor(request.pluginName, request.assetsPath);
        } catch (e) {
            console.error(cerr`${e.message}`);
            throw Error(e);
        }
        return compiler.compile();
    }
}
