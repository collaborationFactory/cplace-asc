/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import {TsConfigGenerator} from './TsConfigGenerator';
import {cerr, debug, GREEN_CHECK} from '../utils';
import {ImlParser} from './ImlParser';
import * as rimraf from 'rimraf';
import {TypescriptCompiler} from '../compiler/TypescriptCompiler';
import {CompressCssCompiler} from '../compiler/CompressCssCompiler';

export interface ICplacePluginResolver {
    (pluginName: string): CplacePlugin | undefined
}

/**
 * Represents a cplace plugin that needs to be compiled
 */
export default class CplacePlugin {

    /**
     * Name of the repository this plugin is contained in
     */
    public readonly repo: string;

    /**
     * Path to the plugin's `/assets` directory
     */
    public readonly assetsDir: string;

    public readonly hasTypeScriptAssets: boolean;
    public readonly hasLessAssets: boolean;
    public readonly hasCompressCssAssets: boolean;

    /**
     * Plugin dependencies this plugin depends on (parsed from IML), i.e. outgoing dependencies
     */
    public readonly dependencies: string[];
    /**
     * Plugins that depend on this plugin (set explicitly afterwards), i.e. incoming dependencies
     */
    public readonly dependents: string[];

    constructor(public readonly pluginName: string,
                public readonly pluginDir: string,
                public readonly mainRepoDir: string,
                public readonly localOnly: boolean) {
        this.dependencies = [];
        this.dependents = [];

        this.repo = path.basename(path.dirname(path.resolve(pluginDir)));
        this.assetsDir = path.resolve(pluginDir, 'assets');
        this.hasTypeScriptAssets = fs.existsSync(path.resolve(this.assetsDir, 'ts'));
        this.hasLessAssets = fs.existsSync(path.resolve(this.assetsDir, 'less'));
        this.hasCompressCssAssets = fs.existsSync(path.resolve(this.assetsDir, 'css', CompressCssCompiler.ENTRY_FILE_NAME));
    }

    public static getPluginPathRelativeToRepo(sourceRepo: string, targetPluginName: string, targetRepo: string,
                                              localOnly: boolean): string {
        if (localOnly || sourceRepo === targetRepo) {
            return targetPluginName;
        } else {
            return path.join('..', targetRepo, targetPluginName);
        }
    }

    public isInSubRepo(): boolean {
        return this.repo !== 'main';
    }

    public getPluginPathRelativeFromRepo(sourceRepo: string): string {
        return CplacePlugin.getPluginPathRelativeToRepo(sourceRepo, this.pluginName, this.repo, this.localOnly);
    }

    public generateTsConfig(pluginResolver: ICplacePluginResolver, isProduction: boolean): void {
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

        const tsConfigGenerator = new TsConfigGenerator(this, dependenciesWithTypeScript, this.localOnly, isProduction);
        const tsconfigPath = tsConfigGenerator.createConfigAndGetPath();

        if (!fs.existsSync(tsconfigPath)) {
            console.error(cerr`[${this.pluginName}] Could not generate tsconfig file...`);
            throw Error(`[${this.pluginName}] tsconfig generation failed`);
        } else {
            console.log(`${GREEN_CHECK} [${this.pluginName}] wrote tsconfig...`);
        }
    }

    public async cleanGeneratedOutput(): Promise<void> {
        const promises: Promise<void>[] = [];
        if (this.hasLessAssets || this.hasCompressCssAssets) {
            const generatedCss = CompressCssCompiler.getCssOutputDir(this.assetsDir);
            promises.push(this.removeDir(generatedCss));
        }
        if (this.hasTypeScriptAssets) {
            const generatedJs = TypescriptCompiler.getJavaScriptOutputDir(this.assetsDir);
            promises.push(this.removeDir(generatedJs));
        }
        await Promise.all(promises);

        if (promises.length) {
            console.log(`${GREEN_CHECK} [${this.pluginName}] cleaned output directories`);
        }
    }

    public parseDependencies(excludeTestDependencies: boolean = false): void {
        const imlPath = path.join(this.pluginDir, `${this.pluginName}.iml`);
        if (!fs.existsSync(imlPath)) {
            throw Error(`[${this.pluginName}] failed to find plugin IML`);
        }

        new ImlParser(imlPath).getReferencedModules()
            .filter(module => {
                const includeDependency = !excludeTestDependencies || !module.isTestScoped;
                if (!includeDependency) {
                    debug(`(CplacePlugin) [${this.pluginName}] excluding test dependency: ${module.moduleName}`);
                }
                return includeDependency;
            })
            .forEach(module => {
                return this.dependencies.push(module.moduleName);
            });
    }

    private async removeDir(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            rimraf(path, e => {
                if (!e) {
                    debug(`(CplacePlugin) [${this.pluginName}] removed folder ${path}`);
                    resolve();
                } else {
                    reject(e);
                }
            });
        });
    }
}
