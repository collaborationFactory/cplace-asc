/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {createPool, Factory, Pool} from 'generic-pool';
import * as path from 'path';
import {ChildProcess, fork} from 'child_process';
import {ICompileRequest} from '../types';

const COMPILER_ENTRY_POINT = path.resolve(path.dirname(__filename), '../compiler/index.js');

const Processfactory: Factory<ChildProcess> = {
    create: async () => {
        return fork(COMPILER_ENTRY_POINT);
    },
    destroy: async (_process: ChildProcess) => {
        return _process.kill();
    }
};

export class ExecutorService {
    private readonly _pool: Pool<ChildProcess>;

    constructor(maxParallism: number) {
        this._pool = createPool(Processfactory, {
            max: maxParallism
        });
    }

    run(compileRequest: ICompileRequest) {
        return new Promise<string>((resolve, reject) => {
            this._pool.acquire().then((process) => {
                let resolved = false;
                process.send(compileRequest);

                process.once('message', (message) => {
                    this._pool.release(process);
                    console.log(`XXX message: ${message}`);
                    resolved = true;
                    resolve(compileRequest.pluginName);
                });
                process.on('exit', (code) => {
                    if (!resolved) {
                        reject(code);
                    }
                });
            });
        });
    }

    destroy() {
        this._pool.drain().then(() => {
            this._pool.clear();
        });
    }


}
