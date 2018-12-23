/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {debug} from '../utils';

const PLATFORM_PLUGIN = 'cf.cplace.platform';

export class TsConfigGenerator {
    // @todo: maybe define a ts config interface
    private tsConfig: any;

    constructor(private readonly plugin: CplacePlugin,
                private readonly dependencies: CplacePlugin[],
                private readonly localOnly: boolean) {
    }

    public createConfigAndGetPath(): string {
        const relRepoRootPrefix = `../../..`;
        const pathToMain = path.join(relRepoRootPrefix,
            !this.localOnly && this.plugin.repo !== 'main' ? path.join('..', 'main') : ''
        );

        const relPathToPlatform = path.join(relRepoRootPrefix, CplacePlugin.getPluginPathRelativeToRepo(this.plugin.repo, PLATFORM_PLUGIN, 'main', this.localOnly));
        const relPathToPlatformTs = path.join(relPathToPlatform, 'assets', 'ts');

        let defaultPaths = TsConfigGenerator.getPathDependency(PLATFORM_PLUGIN, relPathToPlatformTs);
        if (this.plugin.isInSubRepo()) {
            defaultPaths = {
                ...defaultPaths,
                '*': [
                    '*',
                    `${pathToMain}/node_modules/@types/*`
                ]
            };
        }

        const defaultPathsAndRefs = {
            paths: defaultPaths,
            refs: [{
                path: relPathToPlatformTs
            }]
        };
        const {paths, refs} = this.dependencies.reduce((acc, dependency) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dependency.pluginName === PLATFORM_PLUGIN) {
                return acc;
            }

            const relPathToDependency = path.join(relRepoRootPrefix, dependency.getPluginPathRelativeFromRepo(this.plugin.repo));
            const relPathToDependencyTs = path.join(relPathToDependency, 'assets', 'ts');

            const newPath = TsConfigGenerator.getPathDependency(dependency.pluginName, relPathToDependencyTs);
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

        this.tsConfig = {
            extends: path.join(pathToMain, 'tsconfig.base.json'),
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.',
                outDir: '../generated_js'
            },
            include: ['./**/*.ts']
        };

        if (this.plugin.pluginName !== PLATFORM_PLUGIN) {
            this.tsConfig.compilerOptions.paths = paths;
            this.tsConfig.references = refs;
        }

        this.saveConfig();
        return this.getConfigPath();
    }

    public getConfigPath(): string {
        return path.join(this.plugin.assetsDir, 'ts', 'tsconfig.json');
    }

    private saveConfig(): void {
        /* this is done sync for now, 'cause when a error occurs later in the execution
           and is not caught, it will fail the file generation
         */
        const content = JSON.stringify(this.tsConfig, null, 4);
        fs.writeFileSync(
            this.getConfigPath(),
            content,
            {encoding: 'utf8'}
        );

        debug(`(TsConfigGenerator) [${this.plugin.pluginName}] TS Config content:`);
        debug(content);
    }

    private static getPathDependency(dependency: string, path: string): { [dependencyKey: string]: string[] } {
        const dependencyObject: { [dependencyKey: string]: string[] } = {};
        dependencyObject[`@${dependency}/*`] = [path + '/*'];
        return dependencyObject;
    }
}
