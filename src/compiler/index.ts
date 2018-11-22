/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import { LessCompiler } from './LessCompiler';
import { ICompileRequest } from '../types';
import { TypescriptCompiler } from './TypescriptCompiler';
import { ChildProcess } from 'child_process';


// redeclare process as ChildPrecess to get proper types checking for process(ChildProcess).
declare var process: ChildProcess;

process.on('message', (request: ICompileRequest) => {
    handleRequest(request)
        .then((response) => {
            // console.log(request.pluginName, response);
            process.send(response);
        });
});


async function handleRequest(request: ICompileRequest) {
    // verify that all required values are present
    if (!request.pluginName || !request.assetsPath) {
        return new Error('Invalid request');
    }
    if (request.ts) {
        const compiler = new TypescriptCompiler(request.pluginName, request.assetsPath);
        return await compiler.compile();
    }
    if (request.less) {
        const compiler = new LessCompiler(request.pluginName, request.assetsPath);
        return await compiler.compile();
    }
}
