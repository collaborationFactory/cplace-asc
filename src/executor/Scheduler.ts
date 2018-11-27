/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {ExecutorService} from './ExecutorService';
import {ICompileRequest} from '../types';
import CplacePlugin from '../model/CplacePlugin';
import {JobDetails, JobTracker} from './JobTracker';

export class Scheduler {
    private readonly tsJobs: JobTracker;
    private readonly lessJobs: JobTracker;

    private completed: boolean = false;
    private finishedResolver?: () => void;
    private finishedRejecter?: (reason: any) => void;

    constructor(private executor: ExecutorService, private plugins: Map<string, CplacePlugin>) {
        this.tsJobs = this.createTsJobTracker();
        this.lessJobs = this.createLessJobTracker();
    }

    start(): Promise<void> {
        this.scheduleNext();
        return new Promise((resolve, reject) => {
            this.finishedResolver = resolve;
            this.finishedRejecter = reject;
        });
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
            this.tsJobs.markProcessing(nextTsPlugin);
            this.executor
                .run(compileRequest)
                .then(() => {
                    this.tsJobs.markCompleted(nextTsPlugin);
                    this.scheduleNext();
                }, (e) => {
                    this.completed = true;
                    this.finishedRejecter && this.finishedRejecter(e);
                });

            if (!this.executor.hasCapacity()) {
                console.log('no capacity');
                return;
            }
        }

        /*const nextLessPlugin = this.lessJobs.getNextKey();
        if (nextLessPlugin) {
            const plugin = this.getPlugin(nextLessPlugin);
            const compileRequest: ICompileRequest = {
                pluginName: plugin.pluginName,
                assetsPath: plugin.assetsDir,
                less: true
            };
            this.lessJobs.markProcessing(nextLessPlugin);
            this.executor
                .run(compileRequest)
                .then(() => {
                    this.lessJobs.markCompleted(nextLessPlugin);
                    this.scheduleNext();
                }, (e) => {
                    this.completed = true;
                    this.finishedRejecter && this.finishedRejecter(e);
                });

            if (!this.executor.hasCapacity()) {
                console.log('no capacity');
                return;
            }
        }*/

        if (nextTsPlugin === null /*&& nextLessPlugin === null*/) {
            this.completed = true;
            this.finishedResolver && this.finishedResolver();
        } else if (nextTsPlugin !== undefined) {
            this.scheduleNext();
        }
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

    private getPlugin(pluginName: string): CplacePlugin {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw Error(`unknown plugin: ${plugin}`);
        }
        return plugin;
    }
}
