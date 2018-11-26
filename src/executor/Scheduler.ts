/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {ExecutorService} from './ExecutorService';
import {ICompileRequest} from '../types';
import CplacePlugin from '../model/CplacePlugin';

export class Scheduler {
    private readonly compiled: Set<string>;

    private finishedResolver?: () => void;
    private finishedRejecter?: (reason: any) => void;

    constructor(private executor: ExecutorService, private projects: Map<string, CplacePlugin>, private groups: Array<Array<string>>) {
        this.compiled = new Set<string>();
    }

    start(): Promise<void> {
        this.scheduleNext();
        return new Promise((resolve, reject) => {
            this.finishedResolver = resolve;
            this.finishedRejecter = reject;
        });
    }

    /**
     *
     * @param pluginName plugin that has finished compiling
     */
    scheduleNext(pluginName?: string) {
        const nextGroup = this.getNextBatch(pluginName);
        if (!Array.isArray(nextGroup)) {
            return;
        }
        nextGroup.forEach(pluginName => {
            if (!pluginName || !this.projects.has(pluginName)) {
                return;
            }

            const plugin = this.projects.get(pluginName);
            if (!plugin) {
                return;
            }

            // TODO: we need to separate between TS and LESS!
            if (!plugin.hasTypeScriptAssets) {
                this.compiled.add(plugin.pluginName); // we fake completion
                return;
            }

            const compileRequest: ICompileRequest = {
                pluginName: plugin.pluginName,
                assetsPath: plugin.assetsDir,
                ts: true
            };
            this.executor
                .run(compileRequest)
                .then((completedPluginName: string) => {
                    console.log('done', completedPluginName);
                    this.compiled.add(completedPluginName);
                    this.scheduleNext(completedPluginName);
                    // everything is compiled
                    // console.log(this.compiled.asArray().sort(), this.projects.keys().sort());
                    if (this.compiled.size === this.projects.size) {
                        this.finishedResolver && this.finishedResolver();
                    }
                }, (e) => {
                    this.finishedRejecter && this.finishedRejecter(e);
                });

        });
    }

    getNextBatch(pluginName?: string): string[] | null {
        let nextTasks: string[] = [];
        let groupIdx = 0;
        let group: string[];
        if (pluginName) {
            const p = this.projects.get(pluginName);
            if (p) {
                groupIdx = p.group + 1;
            }
        }
        if (groupIdx >= this.groups.length) {
            return null;
        }
        group = this.groups[groupIdx];
        const len = group.length - 1;
        for (let i = len; i >= 0; i--) {
            const project = this.projects.get(group[i]);
            if (!project) {
                continue;
            }

            const allDependenciesCompiled = project.dependencies
                .filter(dep => !this.compiled.has(dep))
                .length === 0;

            if (allDependenciesCompiled) {
                nextTasks.push(project.pluginName);
                group.splice(i, 1);
            }
        }
        return nextTasks;
    }
}
