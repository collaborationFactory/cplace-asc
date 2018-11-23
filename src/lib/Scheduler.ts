/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import CplacePlugin from './CplacePlugin';
import {ExecutorService} from './ExecutorService';
import {ICompileRequest} from '../types';

export class Scheduler {
    private readonly compiled: Set<string>;
    private finishedResolver: any;

    constructor(private executor: ExecutorService, private projects: Map<string, CplacePlugin>, private groups: Array<Array<string>>) {
        this.compiled = new Set<string>();
    }

    start() {
        this.scheduleNext();
        return new Promise((resolve) => {
            this.finishedResolver = resolve;
        });
    }

    /**
     *
     * @param pluginName plugin that has finished compiling
     */
    scheduleNext(pluginName?: string) {
        const nextGroup = this.getNextBatch(pluginName);
        if (Array.isArray(nextGroup)) {
            const len = nextGroup.length - 1;
            for (let i = len; i >= 0; i--) {
                let pluginName = nextGroup[i];
                if (pluginName && this.projects.has(pluginName)) {
                    const project = this.projects.get(pluginName);
                    if (!project) {
                        continue;
                    }

                    const compileRequest: ICompileRequest = {
                        pluginName: project.pluginName,
                        assetsPath: project.assets,
                        ts: true
                    };
                    this.executor.run(compileRequest)
                        .then((completedPluginName: string) => {
                            console.log('done', completedPluginName);
                            this.compiled.add(completedPluginName);
                            this.scheduleNext(completedPluginName);
                            // everything is compiled
                            // console.log(this.compiled.asArray().sort(), this.projects.keys().sort());
                            if (this.compiled.size === this.projects.size) {
                                this.finishedResolver();
                            }
                        });
                }
            }
        }
    }

    getNextBatch(pluginName?: string): string[] | null {
        let nextTasks: string[] = [];
        let groupIdx = 0;
        let group: string[];
        if (pluginName) {
            const p = this.projects.get(pluginName) as CplacePlugin;
            groupIdx = p.group + 1;
        }
        if (groupIdx >= this.groups.length) {
            return null;
        }
        group = this.groups[groupIdx];
        const len = group.length - 1;
        for (let i = len; i >= 0; i--) {
            const project = this.projects.get(group[i]) as CplacePlugin;
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
