/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import { createPool, Factory, Pool } from 'generic-pool';
import * as path from 'path';
import { ChildProcess, fork } from 'child_process';
import { cpus } from 'os';
import Project from './Project';
import { ICompileRequest } from '../types';

const _fileName = path.resolve(path.dirname(__filename), '../compiler/index.js');

const Processfactory: Factory<ChildProcess> = {
    create: async () => {
        return fork(_fileName);
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
        return new Promise<string>((resolve) => {
            this._pool.acquire().then((process) => {
                process.send(compileRequest);
                process.once('message', (message) => {
                    this._pool.release(process);
                    console.log(message);
                    resolve(compileRequest.pluginName);
                });
            });
        });
    }

    runCb(project: Project, ack: (pluginName: string) => void) {
        this._pool.acquire().then((process) => {
            process.send(project.pluginName);
            process.once('message', (message) => {
                this._pool.release(process);
                ack(project.pluginName);
            });
        });
    }

    destroy() {
        this._pool.drain().then(() => {
            this._pool.clear();
        });
    }


}
