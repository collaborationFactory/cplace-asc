/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {ExecutorService} from './ExecutorService';
import CplacePlugin from '../model/CplacePlugin';
import {JobDetails, JobTracker} from './JobTracker';
import * as path from 'path';
import * as chokidar from 'chokidar';
import {FSWatcher} from 'chokidar';
import {cerr, csucc, debug, isDebugEnabled, IUpdateDetails, printUpdateDetails} from '../utils';
import {CompilationResult, ICompileRequest} from '../compiler/interfaces';
import Timeout = NodeJS.Timeout;

interface ISchedulingResult {
    scheduledPlugin?: string | null | undefined;
    backoff?: boolean;
}

export class Scheduler {
    private readonly tsJobs: JobTracker;
    private readonly lessJobs: JobTracker;
    private readonly compressCssJobs: JobTracker;

    private watchers = {
        'ts': new Map<string, FSWatcher>(),
        'less': new Map<string, FSWatcher>(),
        'css': new Map<string, FSWatcher>()
    };

    private completed = false;
    private finishedResolver?: () => void;
    private finishedRejecter?: (reason: any) => void;

    constructor(private readonly executor: ExecutorService,
                private readonly plugins: Map<string, CplacePlugin>,
                private readonly mainRepoDir: string,
                private readonly isProduction: boolean,
                private readonly watchFiles: boolean,
                private readonly updateDetails?: IUpdateDetails) {
        this.tsJobs = this.createTsJobTracker();
        this.lessJobs = this.createLessJobTracker();
        this.compressCssJobs = this.createCompressCssJobTracker();
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

    public stop(): void {
        this.completed = true;
        this.cleanup();
    }

    private scheduleNext(): void {
        if (this.completed) {
            return;
        }

        const tsSchedulingResult = this.getAndScheduleNextJob(this.tsJobs, 'ts', 'ts');
        if (tsSchedulingResult.backoff) {
            return;
        }
        const nextTsPlugin = tsSchedulingResult.scheduledPlugin;

        const lessSchedulingResult = this.getAndScheduleNextJob(this.lessJobs, 'less', 'less');
        if (lessSchedulingResult.backoff) {
            return;
        }
        const nextLessPlugin = lessSchedulingResult.scheduledPlugin;

        const compressCssSchedulingResult = this.getAndScheduleNextJob(this.compressCssJobs, 'compressCss', 'css');
        if (compressCssSchedulingResult.backoff) {
            return;
        }
        const nextCompressCssPlugin = compressCssSchedulingResult.scheduledPlugin;

        if (nextTsPlugin === null && nextLessPlugin === null && nextCompressCssPlugin === null) {
            if (!this.watchFiles && !this.completed) {
                printUpdateDetails(this.updateDetails);
                this.completed = true;
                this.finishedResolver && this.finishedResolver();
            } else if (this.watchFiles) {
                console.log();
                console.log(csucc`Compilation completed - watching files...`);
                console.log();
                printUpdateDetails(this.updateDetails);
            }
        } else if (nextTsPlugin || nextLessPlugin || nextCompressCssPlugin) {
            if (this.executor.hasCapacity()) {
                this.scheduleNext();
            }
        }
    }

    private getAndScheduleNextJob(jobTracker: JobTracker,
                                  compileType: 'ts' | 'less' | 'compressCss',
                                  watchType: 'ts' | 'less' | 'css'): ISchedulingResult {
        const nextPlugin = jobTracker.getNextKey();
        if (nextPlugin) {
            const plugin = this.getPlugin(nextPlugin);
            const compileRequest: ICompileRequest = {
                pluginName: plugin.pluginName,
                assetsPath: plugin.assetsDir,
                mainRepoDir: this.mainRepoDir,
                isProduction: this.isProduction,
                verbose: isDebugEnabled()
            };
            compileRequest[compileType] = true;

            debug(`(Scheduler) scheduling ${compileType} compile step for ${plugin.pluginName}`);

            jobTracker.markProcessing(nextPlugin);
            this.executor
                .run(compileRequest)
                .then((result?: CompilationResult) => {
                    const compilationResultChanged = result !== CompilationResult.UNCHANGED;
                    const firstCompletion = jobTracker.markCompleted(nextPlugin, compilationResultChanged);
                    if (firstCompletion && this.watchFiles) {
                        this.registerWatch(nextPlugin, watchType);
                    }
                    this.scheduleNext();
                }, (e) => {
                    const firstCompletion = jobTracker.markCompleted(nextPlugin, true);
                    if (firstCompletion && this.watchFiles) {
                        this.registerWatch(nextPlugin, watchType);
                    }

                    // when watching we don't kill the compiler here but just continue
                    if (this.watchFiles) {
                        this.scheduleNext();
                        return;
                    }

                    this.completed = true;
                    this.finishedRejecter && this.finishedRejecter(e);
                });

            if (!this.executor.hasCapacity()) {
                return {backoff: true};
            }
        }
        return {
            scheduledPlugin: nextPlugin
        };
    }

    private cleanup(): void {
        this.watchers.ts.forEach(watcher => {
            watcher.close();
        });
        this.watchers.less.forEach(watcher => {
            watcher.close();
        });
        this.watchers.css.forEach(watcher => {
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

    private createCompressCssJobTracker(): JobTracker {
        const compressPlugins: CplacePlugin[] = [];
        this.plugins.forEach(plugin => {
            if (plugin.hasCompressCssAssets) {
                compressPlugins.push(plugin);
            }
        });

        const jobs: JobDetails[] = compressPlugins.map(plugin => new JobDetails(
            plugin.pluginName, [], []
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

    private registerWatch(pluginName: string, type: 'ts' | 'less' | 'css'): void {
        if (!this.watchFiles) {
            return;
        }

        const plugin = this.getPlugin(pluginName);
        const watchDir = path.join(plugin.assetsDir, type);
        const glob = Scheduler.convertToUnixPath(`${watchDir}/**/*.${type}`);
        const watcher = chokidar.watch(glob);
        this.watchers[type].set(pluginName, watcher);

        let jobTracker;
        switch (type) {
            case 'ts':
                jobTracker = this.tsJobs;
                break;
            case 'less':
                jobTracker = this.lessJobs;
                break;
            case 'css':
                jobTracker = this.compressCssJobs;
                break;
        }

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

    // code from some github project
    static convertToUnixPath(input) {
        const isExtendedLengthPath = /^\\\\\?\\/.test(input);
        const hasNonAscii = /[^\u0000-\u0080]+/.test(input);

        if (isExtendedLengthPath || hasNonAscii) {
            return input;
        }

        return input.replace(/\\/g, '/');
    }
}
