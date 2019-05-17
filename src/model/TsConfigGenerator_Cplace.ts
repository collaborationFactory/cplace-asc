/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {cerr} from '../utils';
import {ConfigGenerator} from "../compiler/interfaces";
import {TSConfigGenerator} from "./TSConfigGenerator";


interface IExtraTypes {
    definitions: string[];
}

export class TsConfigGenerator_Cplace extends TSConfigGenerator {

    public createConfigAndGetPath(): string {
        let defaultPaths = {
            ...TSConfigGenerator.getPathDependency(ConfigGenerator.PLATFORM_PLUGIN, this.relPathToPlatformTs),
            '*': [
                '*',
                `${this.pathToMain}/node_modules/@types/*`,
                `${this.pathToMain}/cf.cplace.platform/assets/@cplaceTypes/*`
            ]
        };

        const defaultPathsAndRefs = {
            paths: defaultPaths,
            refs: [{
                path: this.relPathToPlatformTs
            }]
        };
        const {paths, refs} = this.dependencies.reduce((acc, dependency) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dependency.pluginName === ConfigGenerator.PLATFORM_PLUGIN) {
                return acc;
            }

            const relPathToDependency = path.join(
                ConfigGenerator.REL_REPO_ROOT_PREFIX,
                dependency.getPluginPathRelativeFromRepo(this.plugin.repo, this.localOnly)
            );
            const relPathToDependencyTs = path.join(relPathToDependency, 'assets', 'ts');

            const newPath = TsConfigGenerator_Cplace.getPathDependency(dependency.pluginName, relPathToDependencyTs);
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

        const extraTypes = TsConfigGenerator_Cplace.checkExtraTypes(this.plugin, this.dependencies);
        const additionalIncludes = extraTypes === null ? [] : extraTypes.definitions;

        this.tsConfig = {
            extends: path.join(this.pathToMain, 'tsconfig.base.json'),
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

        if (this.plugin.pluginName !== ConfigGenerator.PLATFORM_PLUGIN) {
            this.tsConfig.compilerOptions.paths = paths;
            this.tsConfig.references = refs;
        }

        this.saveConfig();
        return this.getTSConfigPath();
    }

    public getTSConfigPath(): string {
        return path.join(this.plugin.assetsDir, 'ts', ConfigGenerator.TS_CONFIG_JSON);
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


}
