/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import {getPathDependency, getRelPath} from './utils';
import CplacePlugin from './CplacePlugin';

const PLATFORM_PLUGIN = 'cf.cplace.platform';

export class TsConfigGenerator {
    // @todo: maybe define a ts config interface
    private tsConfig: any;

    constructor(private readonly moduleName: string,
                private readonly mainPath: string,
                private readonly isSubRepo: boolean,
                private readonly dependencies: CplacePlugin[]) {
    }

    public createConfigAndGetPath(): string {
        const platformRelPath = getRelPath(`${PLATFORM_PLUGIN}/assets/ts`, this.isSubRepo);
        const defaultPathsAndRefs = {
            paths: getPathDependency(PLATFORM_PLUGIN, platformRelPath),
            refs: [{
                path: platformRelPath
            }]
        };
        const {paths, refs} = this.dependencies.reduce((acc, dependency) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dependency.pluginName === PLATFORM_PLUGIN) {
                return acc;
            }

            const relPath = getRelPath(`${dependency.pluginName}/assets/ts`, this.isSubRepo);
            const newPath = getPathDependency(dependency.pluginName, relPath);
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
}
