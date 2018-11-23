/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as gts from 'gulp-typescript';
import * as fs from 'fs';
import {TsConfigGenerator} from './TsConfigGenerator';

/**
 * Represents a cplace plugin that needs to be compiled
 */
export default class CplacePlugin {

    /**
     * Path to the plugin's `/assets` directory
     */
    readonly assetsDir: string;

    readonly hasTypeScriptAssets: boolean;
    readonly hasLessAssets: boolean;

    /**
     * TypeScript plugin dependencies
     */
    readonly dependencies: Array<string>;
    /**
     * TypeScript plugins that depend on me
     */
    readonly dependents: Array<string>;

    /**
     * gulp-typescript project instance
     */
    private tsProject?: gts.Project;

    /**
     * depth/level in the graph based on topology
     */
    group: number = 0;

    constructor(public readonly pluginName: string,
                public readonly pluginDir: string,
                public readonly mainRepoDir: string) {
        this.dependencies = [];
        this.dependents = [];

        this.assetsDir = path.resolve(pluginDir, 'assets');
        this.hasTypeScriptAssets = fs.existsSync(path.resolve(this.assetsDir, 'ts'));
        this.hasLessAssets = fs.existsSync(path.resolve(this.assetsDir, 'less'));
    }

    public generateTsConfigAndGetTsProject(): gts.Project {
        if (!this.hasTypeScriptAssets) {
            throw Error('plugin does not have TypeScript assets');
        }

        // @todo: define option not to generate tsconfig each time (or to do it) and check existence
        const tsConfigGenerator = new TsConfigGenerator(
            this.pluginName,
            this.mainRepoDir,
            false // @todo: this needs to be fixed
        );
        tsConfigGenerator.getConfigAndSave();

        const tsconfigPath = path.resolve(this.assetsDir, 'ts', 'tsconfig.json');
        if (!fs.existsSync(tsconfigPath)) {
            console.error(`Could not generate tsconfig file for ${this.pluginName}...`);
            throw Error('tsconfig generation failed');
        }

        this.tsProject = gts.createProject(tsconfigPath);
        this.parseDependencies();
        return this.tsProject;
    }

    private parseDependencies(): void {
        if (!this.tsProject) {
            return;
        }

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
