/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {debug} from '../utils';


export abstract class AbstractTSConfigGenerator {
    protected tsConfig: any;
    protected readonly pathToMain: string;
    protected readonly relPathToPlatform: string;
    protected readonly relPathToPlatformTs: string;
    protected readonly platformPlugin = 'cf.cplace.platform';
    private readonly relRepoRootPrefix = '../../..';
    protected readonly tsConfigJson = 'tsconfig.json';


    constructor(protected readonly plugin: CplacePlugin,
                protected readonly dependencies: CplacePlugin[],
                protected readonly localOnly: boolean,
                protected readonly isProduction: boolean,
                protected readonly srcFolderName: string) {
        this.pathToMain = AbstractTSConfigGenerator.pathToMain(this.localOnly, this.plugin.repo, this.relRepoRootPrefix);
        this.relPathToPlatform = path.join(this.relRepoRootPrefix, CplacePlugin.getPluginPathRelativeToRepo(this.plugin.repo, this.platformPlugin, 'main', this.localOnly));
        this.relPathToPlatformTs = path.join(this.relPathToPlatform, 'assets', this.srcFolderName);
    }

    public static pathToMain(localOnly: boolean, repo: string, relRepoRootPrefix: string): string {
        return path.join(relRepoRootPrefix,
            !localOnly && repo !== 'main' ? path.join('..', 'main') : ''
        );
    }

    public abstract createConfigAndGetPath(): string;

    protected getTSConfigPath(): string {
        return path.join(this.plugin.assetsDir, this.srcFolderName, this.tsConfigJson);
    }

    protected getPathsAndRefs(): { paths: Record<string, string[]>, refs: { path: string }[] } {
        let defaultPaths = {
            ...AbstractTSConfigGenerator.getPathDependency(this.platformPlugin, this.relPathToPlatformTs),
            '*': ['*']
        };

        const defaultPathsAndRefs = {
            paths: defaultPaths,
            refs: [{
                path: this.relPathToPlatformTs
            }]
        };

        return this.dependencies.reduce((acc, dependency) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dependency.pluginName === this.platformPlugin) {
                return acc;
            }

            const relPathToDependency = path.join(
                this.relRepoRootPrefix,
                dependency.getPluginPathRelativeFromRepo(this.plugin.repo, this.localOnly)
            );
            const relPathToDependencyTs = path.join(relPathToDependency, 'assets', this.srcFolderName);

            const newPath = AbstractTSConfigGenerator.getPathDependency(dependency.pluginName, relPathToDependencyTs);
            const newRef = {path: relPathToDependencyTs};

            return {
                paths: {
                    ...acc.paths,
                    ...newPath
                },
                refs: [
                    ...acc.refs,
                    newRef
                ]
            };
        }, defaultPathsAndRefs);
    }

    protected saveConfig(): void {
        const content = JSON.stringify(this.tsConfig, null, 4);
        fs.writeFileSync(
            this.getTSConfigPath(),
            content,
            {encoding: 'utf8'}
        );

        debug(`(TsConfigGenerator) [${this.plugin.pluginName}] TS Config content:`);
        debug(content);
    }

    protected static getPathDependency(dependency: string, path: string): { [dependencyKey: string]: string[] } {
        const dependencyObject: { [dependencyKey: string]: string[] } = {};
        dependencyObject[`@${dependency}/*`] = [path + '/*'];
        return dependencyObject;
    }

}
