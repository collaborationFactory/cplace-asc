/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import {TsConfigGenerator} from './TsConfigGenerator';
import {cerr, debug, GREEN_CHECK} from '../utils';
import {ImlParser} from './ImlParser';
import {LessCompiler} from '../compiler/LessCompiler';
import * as rimraf from 'rimraf';
import {TypescriptCompiler} from '../compiler/TypescriptCompiler';

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
     * Plugin dependencies this plugin depends on (parsed from IML), i.e. outgoing dependencies
     */
    public readonly dependencies: string[];
    /**
     * Plugins that depend on this plugin (set explicitly afterwards), i.e. incoming dependencies
     */
    public readonly dependents: string[];

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

    public generateTsConfig(pluginResolver: ICplacePluginResolver): void {
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
    }

    public async cleanGeneratedOutput(): Promise<void> {
        const promises: Promise<void>[] = [];
        if (this.hasLessAssets) {
            const generatedCss = LessCompiler.getCssOutputDir(this.assetsDir);
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

    private parseDependencies(): void {
        const imlPath = path.join(this.pluginDir, `${this.pluginName}.iml`);
        if (!fs.existsSync(imlPath)) {
            throw Error(`[${this.pluginName}] failed to find plugin IML`);
        }

        new ImlParser(imlPath).getReferencedModules().forEach(p => {
            return this.dependencies.push(p);
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
