/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {createPool, Factory, Pool} from 'generic-pool';
import * as path from 'path';
import * as node_process from 'process';
import {ChildProcess, fork} from 'child_process';
import {CompilationResult, ICompileRequest, ICompileResponse, ProcessState} from '../compiler/interfaces';
import {debug} from '../utils';

const COMPILER_ENTRY_POINT = path.resolve(path.dirname(__filename), '../compiler/index.js');

const Processfactory: Factory<ChildProcess> = {
    create: async () => {
        return fork(COMPILER_ENTRY_POINT);
    },
    destroy: async (_process: ChildProcess) => {
        _process.kill();
    }
};

export class ExecutorService {
    private readonly pool: Pool<ChildProcess>;
    private running = 0;
    private pids: Set<number> = new Set();

    constructor(private readonly maxParallelism: number) {
        debug(`(ExecutorService) got maxParallelism: ${maxParallelism}`);
        this.pool = createPool(Processfactory, {
            max: maxParallelism
        });
    }

    public hasCapacity(): boolean {
        return this.running < this.maxParallelism;
    }

    public run(compileRequest: ICompileRequest, watchFiles: boolean): Promise<CompilationResult> {
        this.running++;
        return new Promise<CompilationResult>((resolve, reject) => {
            this.pool.acquire().then((process) => {
                if (!watchFiles) {
                    this.pids.add(process.pid);
                }
                let resolved = false;
                const exit = (code) => {
                    if (!resolved) {
                        this.pool.release(process);
                        this.running--;
                        reject(code);
                    }
                };

                process.send(compileRequest);

                process.once('message', (message: ICompileResponse) => {
                    process.removeListener('exit', exit);
                    this.pool.release(process);
                    resolved = true;
                    if (message.state === ProcessState.DONE) {
                        this.running--;
                        resolve(message.result);
                    } else {
                        this.running--;
                        if (watchFiles) {
                            reject(2);
                        } else {
                            this.killAllProcesses();
                        }
                    }
                });
                process.once('exit', exit);
            }, (e) => {
                this.running--;
                throw Error(`failed to acquire process: ${e}`);
            });
        });
    }

    /**
     * Kills all running processes
     * @private
     */
    private killAllProcesses(): void {
        this.pids.forEach(pid => {
            node_process.kill(pid);
        });
    }

    public destroy(): PromiseLike<void> {
        let drainPromise = this.pool.drain();
        drainPromise.then(
            () => this.pool.clear(),
            () => this.pool.clear()
        );
        return drainPromise;
    }


}
