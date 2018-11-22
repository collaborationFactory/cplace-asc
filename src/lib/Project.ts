/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as gts from 'gulp-typescript';

export default class Project {
    readonly assets: string;
    readonly dependencies: Array<string>;
    readonly dependents: Array<string>;
    readonly tsProject: gts.Project;
    // this is the depth/level in the graph based on topology
    group: number = 0;

    constructor(public readonly  pluginName: string, public readonly directory: string) {
        this.dependencies = [];
        this.dependents = [];
        this.assets = path.resolve(directory, 'assets');
        const tsconfigPtah = path.resolve(this.assets, 'ts', 'tsconfig.json');
        this.tsProject = gts.createProject(tsconfigPtah);
        this.parseDependencies();
    }

    parseDependencies() {
        let paths = this.tsProject.options.paths;
        if (paths) {
            Object.keys(paths).forEach((path) => {
                // dependencies are listed in references.
                this.dependencies.push(path.substring(1, path.indexOf('/')));
            });
        }
    }

    // TODO: do we need this?
    // getCleanTask(): TaskFunction {
    //     const clean: TaskFunction = () => {
    //         // console.log('Starting del');
    //         return del([
    //             `${this.assets}/generated_css/**`
    //         ], {
    //             force: true
    //         });
    //     };
    //
    //     clean.displayName = `ts:${this.pluginName}`;
    //     clean.description = `Clear for ${this.pluginName}`;
    //
    //     return clean;
    // }


}
