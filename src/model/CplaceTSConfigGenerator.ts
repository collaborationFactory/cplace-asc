/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {cerr} from '../utils';
import {AbstractTSConfigGenerator} from "./AbstractTSConfigGenerator";
import {CplaceTypescriptCompiler} from '../compiler/CplaceTypescriptCompiler';


interface IExtraTypes {
    definitions: string[];
    externals: { [importName: string]: string };
}

export class CplaceTSConfigGenerator extends AbstractTSConfigGenerator {

    constructor(plugin: CplacePlugin,
                dependencies: CplacePlugin[],
                localOnly: boolean,
                isProduction: boolean) {
        super(plugin, dependencies, localOnly, isProduction, 'ts');
    }

    public createConfigAndGetPath(): string {
        const {paths, refs} = this.getPathsAndRefs();

        const extraTypes = CplaceTSConfigGenerator.getExtraTypes(
            this.plugin.pluginDir,
            this.dependencies.map(d => d.pluginDir)
        );
        const additionalIncludes = extraTypes === null ? [] : extraTypes.definitions;

        this.tsConfig = {
            extends: path.join(this.pathToMain, 'tsconfig.base.json'),
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.',
                outDir: `../${CplaceTypescriptCompiler.DEST_DIR}`,
                sourceMap: !this.isProduction,
                declarationMap: !this.isProduction
            },
            include: [
                './**/*.ts',
                ...additionalIncludes
            ]
        };

        if (this.plugin.pluginName !== this.platformPlugin) {
            paths['*'].push(
                `${this.pathToMain}/node_modules/@types/*`,
                `${this.pathToMain}/cf.cplace.platform/assets/@cplaceTypes/*`
            );
            this.tsConfig.compilerOptions.paths = paths;
            this.tsConfig.references = refs;
        }

        this.saveConfig();
        return this.getTSConfigPath();
    }

public static getExtraTypes(pluginDir: string, dependencyPaths: string[]): IExtraTypes | null {
        const pluginName = path.basename(pluginDir);
        const assetsDir = CplacePlugin.getAssetsDir(pluginDir);
        const typesPath = path.resolve(assetsDir, 'ts', 'extra-types.json');
        let result: IExtraTypes;

        if (fs.existsSync(typesPath)) {
            const content = fs.readFileSync(typesPath, {encoding: 'utf8'});
            try {
                result = JSON.parse(content);
            } catch (e) {
                console.error(cerr`[${pluginName}] Cannot read extra types: ${typesPath}`);
                return null;
            }
        } else {
            result = {
                definitions: [],
                externals: {}
            };
        }

        if (!result.definitions) {
            result.definitions = [];
        } else {
            result.definitions = result.definitions.map(p => path.resolve(
                assetsDir, 'ts', p
            ));
        }

        if (!result.externals) {
            result.externals = {};
        }

        dependencyPaths
            .map(dep => {
                return this.getExtraTypes(dep, []);
            })
            .forEach(r => {
                if (r !== null) {
                    result.definitions = [...result.definitions, ...r.definitions];
                    result.externals = {
                        ...result.externals,
                        ...r.externals
                    };
                }
            });

        return result;
    }


}
