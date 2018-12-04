/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {ExecutorService} from './ExecutorService';
import {ICompileRequest} from '../types';
import CplacePlugin from '../model/CplacePlugin';
import {JobDetails, JobTracker} from './JobTracker';
import * as path from 'path';
import * as chokidar from 'chokidar';
import {FSWatcher} from 'chokidar';
import {cerr, debug} from '../utils';
import Timeout = NodeJS.Timeout;

export class Scheduler {
    private readonly tsJobs: JobTracker;
    private readonly lessJobs: JobTracker;

    private watchers = {
        'ts': new Map<string, FSWatcher>(),
        'less': new Map<string, FSWatcher>()
    };

    private completed = false;
    private finishedResolver?: () => void;
    private finishedRejecter?: (reason: any) => void;

    constructor(private readonly executor: ExecutorService,
                private readonly plugins: Map<string, CplacePlugin>,
                private readonly watchFiles: boolean = false) {
        this.tsJobs = this.createTsJobTracker();
        this.lessJobs = this.createLessJobTracker();
    }

    start(): Promise<void> {
        const p = new Promise<void>((resolve, reject) => {
            this.finishedResolver = resolve;
            this.finishedRejecter = reject;
            this.scheduleNext();
        });
        p.then(() => {
            this.cleanup();
        }, () => {
            this.cleanup();
        });
        return p;
    }

    private scheduleNext(): void {
        if (this.completed) {
            return;
        }

        const nextTsPlugin = this.tsJobs.getNextKey();
        if (nextTsPlugin) {
            const plugin = this.getPlugin(nextTsPlugin);
            const compileRequest: ICompileRequest = {
                pluginName: plugin.pluginName,
                assetsPath: plugin.assetsDir,
                ts: true
            };
            debug(`(Scheduler) scheduling TS compile step for ${plugin}`);

            this.tsJobs.markProcessing(nextTsPlugin);
            this.executor
                .run(compileRequest)
                .then(() => {
                    const firstCompletion = this.tsJobs.markCompleted(nextTsPlugin);
                    if (firstCompletion && this.watchFiles) {
                        this.registerWatch(nextTsPlugin, 'ts');
                    }
                    this.scheduleNext();
                }, (e) => {
                    this.completed = true;
                    this.finishedRejecter && this.finishedRejecter(e);
                });

            if (!this.executor.hasCapacity()) {
                return;
            }
        }

        const nextLessPlugin = this.lessJobs.getNextKey();
        if (nextLessPlugin) {
            const plugin = this.getPlugin(nextLessPlugin);
            const compileRequest: ICompileRequest = {
                pluginName: plugin.pluginName,
                assetsPath: plugin.assetsDir,
                less: true
            };
            debug(`(Scheduler) scheduling LESS compile step for ${plugin}`);

            this.lessJobs.markProcessing(nextLessPlugin);
            this.executor
                .run(compileRequest)
                .then(() => {
                    const firstCompletion = this.lessJobs.markCompleted(nextLessPlugin);
                    if (firstCompletion && this.watchFiles) {
                        this.registerWatch(nextLessPlugin, 'less');
                    }
                    this.scheduleNext();
                }, (e) => {
                    if (!this.completed) {
                        this.completed = true;
                        this.finishedRejecter && this.finishedRejecter(e);
                    }
                });

            if (!this.executor.hasCapacity()) {
                return;
            }
        }

        if (nextTsPlugin === null && nextLessPlugin === null) {
            if (!this.watchFiles && !this.completed) {
                this.completed = true;
                this.finishedResolver && this.finishedResolver();
            }
        } else if (nextTsPlugin || nextLessPlugin) {
            if (this.executor.hasCapacity()) {
                this.scheduleNext();
            }
        }
    }

    private cleanup(): void {
        this.watchers.ts.forEach(watcher => {
            watcher.close();
        });
        this.watchers.less.forEach(watcher => {
            watcher.close();
        });
    }

    private createTsJobTracker(): JobTracker {
        const tsPlugins: CplacePlugin[] = [];
        this.plugins.forEach(plugin => {
            if (plugin.hasTypeScriptAssets) {
                tsPlugins.push(plugin);
            }
        });

        const jobs: JobDetails[] = tsPlugins.map(plugin => new JobDetails(
            plugin.pluginName,
            this.filterTypeScriptPlugins(plugin.dependencies),
            this.filterTypeScriptPlugins(plugin.dependents)
        ));
        return new JobTracker(jobs);
    }

    private createLessJobTracker(): JobTracker {
        const lessPlugins: CplacePlugin[] = [];
        this.plugins.forEach(plugin => {
            if (plugin.hasLessAssets) {
                lessPlugins.push(plugin);
            }
        });

        const jobs: JobDetails[] = lessPlugins.map(plugin => new JobDetails(
            plugin.pluginName,
            this.filterLessPlugins(plugin.dependencies),
            this.filterLessPlugins(plugin.dependents)
        ));
        return new JobTracker(jobs);
    }

    private filterTypeScriptPlugins(plugins: string[]): string[] {
        return plugins
            .map(p => this.getPlugin(p))
            .filter(p => p.hasTypeScriptAssets)
            .map(p => p.pluginName);
    }

    private filterLessPlugins(plugins: string[]): string[] {
        return plugins
            .map(p => this.getPlugin(p))
            .filter(p => p.hasLessAssets)
            .map(p => p.pluginName);
    }

    private registerWatch(pluginName: string, type: 'ts' | 'less'): void {
        if (!this.watchFiles) {
            return;
        }

        const plugin = this.getPlugin(pluginName);
        const watchDir = path.join(plugin.assetsDir, type);
        const glob = `${watchDir}/**/*.${type}`;
        const watcher = chokidar.watch(glob);
        this.watchers[type].set(pluginName, watcher);

        const jobTracker = type === 'ts' ? this.tsJobs : this.lessJobs;
        let ready = false;
        let debounce: Timeout;
        const handleEvent = () => {
            if (!ready) {
                return;
            }
            console.log('===> Recompiling', pluginName);
            debounce && clearTimeout(debounce);
            debounce = setTimeout(() => {
                jobTracker.markDirty(pluginName);
                this.scheduleNext();
            }, 500);
        };

        watcher
            .on('ready', () => ready = true)
            .on('add', handleEvent)
            .on('change', handleEvent)
            .on('unlink', handleEvent)
            .on('unlinkDir', handleEvent)
            .on('error', (e) => {
                console.error(cerr`[${pluginName}] watcher failed: ${e}`);
                watcher.close();
            });
    }

    private getPlugin(pluginName: string): CplacePlugin {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw Error(`unknown plugin: ${plugin}`);
        }
        return plugin;
    }
}
