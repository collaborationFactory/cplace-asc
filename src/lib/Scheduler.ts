/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import Project from './Project';
import { StringMap } from './StringMap';
import { ExecutorService } from './ExecutorService';
import { StringSet } from './StringSet';
import { ICompileRequest } from '../types';

export class Scheduler {
    compiled: StringSet;
    finishedResolver: any;

    constructor(private executor: ExecutorService, private projects: StringMap<Project>, private groups: Array<Array<string>>) {
        this.compiled = new StringSet();
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
                    const project = <Project>this.projects.get(pluginName);
                    let compileRequest: ICompileRequest = {
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
                            if (this.compiled.size() === this.projects.size()) {
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
            const p = this.projects.get(pluginName) as Project;
            groupIdx = p.group + 1;
        }
        if (groupIdx >= this.groups.length) {
            return null;
        }
        group = this.groups[groupIdx];
        const len = group.length - 1;
        for (let i = len; i >= 0; i--) {
            const project = this.projects.get(group[i]) as Project;
            if (this.compiled.hasAll(project.dependencies)) {
                nextTasks.push(project.pluginName);
                group.splice(i, 1);
            }
        }
        return nextTasks;
    }
}
