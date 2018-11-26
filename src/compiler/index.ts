/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {LessCompiler} from './LessCompiler';
import {ICompileRequest} from '../types';
import {TypescriptCompiler} from './TypescriptCompiler';
import {ICompilerConstructor} from './interfaces';

export const MESSAGE_PROCESS_COMPLETED = 'done';

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
            process.exit(1);
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
            throw Error('unknown compile type - neither ts nor less');
        }

        return new CompilerConstructor(request.pluginName, request.assetsPath).compile();
    }
}
