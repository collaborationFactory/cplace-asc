/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {ImlParser} from './ImlParser';
import * as path from 'path';
import * as fs from 'fs';
import {getPathDependency, getRelPath} from './utils';

const PLATFORM_PLUGIN = 'cf.cplace.platform';

export class TsConfigGenerator {
    // @todo: maybe define a ts config interface
    private tsConfig: any;

    constructor(
        private readonly moduleName: string,
        private readonly mainPath: string,
        private readonly isSubRepo: boolean
    ) {
    }

    public createConfigAndGetPath(): string {
        const dependencies = this.findDependenciesWithTs();
        const platformRelPath = getRelPath(`${PLATFORM_PLUGIN}/assets/ts`, this.isSubRepo);
        const defaultPathsAndRefs = {
            paths: getPathDependency(PLATFORM_PLUGIN, platformRelPath),
            refs: [{
                path: platformRelPath
            }]
        };
        const {paths, refs} = dependencies.reduce((acc, dependency) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dependency !== PLATFORM_PLUGIN) {
                const relPath = getRelPath(`${dependency}/assets/ts`, this.isSubRepo);
                const newPath = getPathDependency(dependency, relPath);
                const newRef = {path: relPath};

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
            }

            return acc;

        }, defaultPathsAndRefs);

        this.tsConfig = {
            extends: '../../../tsconfig.base.json',
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.',
                outDir: '../generated_js'
            },
            include: ['./**/*.ts']
        };

        if (this.moduleName !== PLATFORM_PLUGIN) {
            this.tsConfig.compilerOptions.paths = paths;
            this.tsConfig.references = refs;
        }

        this.saveConfig();
        return this.getConfigPath();
    }

    public getConfigPath(): string {
        return path.join(this.mainPath, this.moduleName, 'assets', 'ts', 'tsconfig.json');
    }

    private saveConfig(): void {
        /* this is done sync for now, 'cause when a error occurs later in the execution
           and is not caught, it will fail the file generation
         */
        fs.writeFileSync(
            this.getConfigPath(),
            JSON.stringify(this.tsConfig, null, 4),
            {encoding: 'utf8'}
        );
    }

    private findDependenciesWithTs(): any[] {
        let imlPath = path.join(this.mainPath, this.moduleName, `${this.moduleName}.iml`);
        let referencedModules = new ImlParser(imlPath).getReferencedModules();
        return referencedModules;
        // return referencedModules.filter((module) => config.plugins.indexOf(module) > -1);
    }
}
