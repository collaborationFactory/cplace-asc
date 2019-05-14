/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {cerr, debug} from '../utils';


interface IExtraTypes {
    definitions: string[];
}

export class TsConfigGenerator {
    private tsConfig: any;
    public static readonly PLATFORM_PLUGIN = 'cf.cplace.platform';

    constructor(private readonly plugin: CplacePlugin,
                private readonly dependencies: CplacePlugin[],
                private readonly localOnly: boolean,
                private readonly isProduction: boolean) {
    }

    public createConfigAndGetPath(): string {
        const relRepoRootPrefix = `../../..`;
        const pathToMain = path.join(relRepoRootPrefix,
            !this.localOnly && this.plugin.repo !== 'main' ? path.join('..', 'main') : ''
        );

        const relPathToPlatform = path.join(relRepoRootPrefix, CplacePlugin.getPluginPathRelativeToRepo(this.plugin.repo, TsConfigGenerator.PLATFORM_PLUGIN, 'main', this.localOnly));
        const relPathToPlatformTs = path.join(relPathToPlatform, 'assets', 'ts');

        let defaultPaths = {
            ...TsConfigGenerator.getPathDependency(TsConfigGenerator.PLATFORM_PLUGIN, relPathToPlatformTs),
            '*': [
                '*',
                `${pathToMain}/node_modules/@types/*`,
                `${pathToMain}/cf.cplace.platform/assets/@cplaceTypes/*`
            ]
        };

        const defaultPathsAndRefs = {
            paths: defaultPaths,
            refs: [{
                path: relPathToPlatformTs
            }]
        };
        const {paths, refs} = this.dependencies.reduce((acc, dependency) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dependency.pluginName === TsConfigGenerator.PLATFORM_PLUGIN) {
                return acc;
            }

            const relPathToDependency = path.join(
                relRepoRootPrefix,
                dependency.getPluginPathRelativeFromRepo(this.plugin.repo, this.localOnly)
            );
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

        const extraTypes = TsConfigGenerator.checkExtraTypes(this.plugin, this.dependencies);
        const additionalIncludes = extraTypes === null ? [] : extraTypes.definitions;

        this.tsConfig = {
            extends: path.join(pathToMain, 'tsconfig.base.json'),
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.',
                outDir: '../generated_js',
                sourceMap: !this.isProduction,
                declarationMap: !this.isProduction
            },
            include: [
                './**/*.ts',
                ...additionalIncludes
            ]
        };

        if (this.plugin.pluginName !== TsConfigGenerator.PLATFORM_PLUGIN) {
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

    private static checkExtraTypes(plugin: CplacePlugin, dependencies: CplacePlugin[]): IExtraTypes | null {
        const typesPath = path.resolve(plugin.assetsDir, 'ts', 'extra-types.json');
        let result: IExtraTypes;

        if (fs.existsSync(typesPath)) {
            const content = fs.readFileSync(typesPath, {encoding: 'utf8'});
            try {
                result = JSON.parse(content);
            } catch (e) {
                console.error(cerr`[${plugin.pluginName}] Cannot read extra types: ${typesPath}`);
                return null;
            }
        } else {
            result = {
                definitions: []
            };
        }

        if (!result.definitions) {
            result.definitions = [];
        } else {
            result.definitions = result.definitions.map(p => path.resolve(
                plugin.assetsDir, 'ts', p
            ));
        }

        dependencies
            .map(dep => {
                return this.checkExtraTypes(dep, []);
            })
            .forEach(r => {
                if (r !== null) {
                    result.definitions = [...result.definitions, ...r.definitions]
                }
            });

        return result;
    }

    private static getPathDependency(dependency: string, path: string): { [dependencyKey: string]: string[] } {
        const dependencyObject: { [dependencyKey: string]: string[] } = {};
        dependencyObject[`@${dependency}/*`] = [path + '/*'];
        return dependencyObject;
    }
}
