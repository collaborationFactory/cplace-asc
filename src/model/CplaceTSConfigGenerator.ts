/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import { AbstractTSConfigGenerator } from './AbstractTSConfigGenerator';
import { debug } from 'console';

export class CplaceTSConfigGenerator extends AbstractTSConfigGenerator {
    constructor(
        plugin: CplacePlugin,
        dependencies: CplacePlugin[],
        localOnly: boolean,
        isProduction: boolean
    ) {
        super(plugin, dependencies, localOnly, isProduction, 'ts');
    }

    public getRelativePathToMain(
        localOnly: boolean,
        repo: string,
        relRepoRootPrefix: string
    ) {
        let workingDir: string = process.cwd();
        workingDir = path.resolve(workingDir);
        if (
            path.basename(workingDir) === 'main' ||
            path.basename(workingDir) === 'cplace'
        ) {
            this.mainFolderName = path.basename(workingDir);
        }

        const expectedMain = path.resolve(workingDir, '..', 'main');
        const expectedCplace = path.resolve(workingDir, '..', 'cplace');

        if (fs.existsSync(expectedMain)) {
            this.mainFolderName = path.basename(expectedMain);
        } else if (fs.existsSync(expectedCplace)) {
            this.mainFolderName = path.basename(expectedCplace);
        }
        debug(
            `main/cplace Repository folder was found in ${this.mainFolderName}`
        );
        return path.join(
            relRepoRootPrefix,
            !localOnly && repo !== this.mainFolderName
                ? path.join('..', this.mainFolderName)
                : ''
        );
    }

    public getRelativePathToPlatform(): string {
        return path.join(
            this.relRepoRootPrefix,
            CplacePlugin.getPluginPathRelativeToRepo(
                this.plugin.repo,
                this.platformPluginName,
                this.mainFolderName,
                this.localOnly
            )
        );
    }

    public getRelativePathToPlatformAssets(): string {
        return path.join(this.relPathToPlatform, 'assets');
    }

    public getRelativePathToPlatformSources(): string {
        return path.join(this.relPathToPlatform, 'assets', this.srcFolderName);
    }

    public getPathsAndRefs(): {
        paths: Record<string, string[]>;
        refs: { path: string }[];
    } {
        let defaultPaths = {
            ...AbstractTSConfigGenerator.getPathDependency(
                this.platformPluginName,
                this.relPathToPlatformSources
            ),
            '*': ['*'],
        };

        const defaultPathsAndRefs = {
            paths: defaultPaths,
            refs: [
                {
                    path: this.relPathToPlatformSources,
                },
            ],
        };

        return this.dependencies.reduce((acc, dependency) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dependency.pluginName === this.platformPluginName) {
                return acc;
            }

            const relPathToDependency = path.join(
                this.relRepoRootPrefix,
                dependency.getPluginPathRelativeFromRepo(
                    this.plugin.repo,
                    this.localOnly
                )
            );
            const relPathToDependencyTs = path.join(
                relPathToDependency,
                'assets',
                this.srcFolderName
            );

            const newPath = AbstractTSConfigGenerator.getPathDependency(
                dependency.pluginName,
                relPathToDependencyTs
            );
            const newRef = { path: relPathToDependencyTs };

            return {
                paths: {
                    ...acc.paths,
                    ...newPath,
                },
                refs: [...acc.refs, newRef],
            };
        }, defaultPathsAndRefs);
    }

    public getTsConfigBasePath(): string {
        return path.join(this.pathToMain, 'tsconfig.base.json');
    }
}
