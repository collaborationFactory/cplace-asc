/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as gts from 'gulp-typescript';
import * as fs from 'fs';
import {TsConfigGenerator} from './TsConfigGenerator';
import {cerr, GREEN_CHECK} from '../utils';
import {ImlParser} from './ImlParser';

export interface ICplacePluginResolver {
    (pluginName: string): CplacePlugin | undefined
}

/**
 * Represents a cplace plugin that needs to be compiled
 */
export default class CplacePlugin {

    /**
     * Path to the plugin's `/assets` directory
     */
    public readonly assetsDir: string;

    public readonly hasTypeScriptAssets: boolean;
    public readonly hasLessAssets: boolean;

    /**
     * Plugin dependencies (parsed from IML)
     */
    public readonly dependencies: string[];
    /**
     * TypeScript plugins that depend on me
     */
    public readonly dependents: Array<string>;

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

        this.parseDependencies();
    }

    public generateTsConfigAndGetTsProject(pluginResolver: ICplacePluginResolver): gts.Project {
        if (!this.hasTypeScriptAssets) {
            throw Error(`[${this.pluginName}] plugin does not have TypeScript assets`);
        }

        const dependenciesWithTypeScript = this.dependencies
            .map(pluginName => {
                const plugin = pluginResolver(pluginName);
                if (!plugin) {
                    throw Error(`[${this.pluginName}] could not resolve dependency ${this.pluginName}`);
                }
                return plugin;
            })
            .filter(p => p.hasTypeScriptAssets);

        // @todo: define option not to generate tsconfig each time (or to do it) and check existence
        const tsConfigGenerator = new TsConfigGenerator(
            this.pluginName,
            this.mainRepoDir,
            false, // @todo: this needs to be fixed
            dependenciesWithTypeScript
        );
        const tsconfigPath = tsConfigGenerator.createConfigAndGetPath();

        if (!fs.existsSync(tsconfigPath)) {
            console.error(cerr`[${this.pluginName}] Could not generate tsconfig file...`);
            throw Error(`[${this.pluginName}] tsconfig generation failed`);
        } else {
            console.log(`${GREEN_CHECK} [${this.pluginName}] wrote tsconfig...`);
        }

        this.tsProject = gts.createProject(tsconfigPath);
        return this.tsProject;
    }

    private parseDependencies(): void {
        const imlPath = path.join(this.pluginDir, `${this.pluginName}.iml`);
        if (!fs.existsSync(imlPath)) {
            throw Error(`[${this.pluginName}] failed to find plugin IML`);
        }

        new ImlParser(imlPath).getReferencedModules().forEach(p => {
            return this.dependencies.push(p);
        });
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
