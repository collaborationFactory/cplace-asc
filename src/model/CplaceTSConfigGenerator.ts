/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import { AbstractTSConfigGenerator } from './AbstractTSConfigGenerator';
import { debug } from 'console';
import { AssetsCompiler } from './AssetsCompiler';

export class CplaceTSConfigGenerator extends AbstractTSConfigGenerator {
    constructor(
        protected readonly plugin: CplacePlugin,
        protected readonly dependencies: CplacePlugin[],
        protected readonly localOnly: boolean,
        protected readonly isProduction: boolean
    ) {
        super(plugin, dependencies, localOnly, isProduction, 'ts');
    }

    public getRelativePathToMain(
        localOnly: boolean,
        repo: string,
        relRepoRootPrefix: string
    ) {
        if (
            !AssetsCompiler.isLocalParentRepo('main') &&
            !AssetsCompiler.isLocalParentRepo('cplace')
        ) {
            // the main repo is not used as a local parent repo, so the 'main' folder will not be used
            return path.join(relRepoRootPrefix, '.');
        }

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
        if (this.platformPlugin?.isArtifactPlugin) {
            // if platform is used as npm artifact, it's location is in the node_modules
            return path.join(
                this.relRepoRootPrefix,
                'node_modules',
                '@cplace-assets',
                `cplace_${this.platformPluginName
                    .replaceAll('.', '-')
                    .toLowerCase()}`
            );
        } else {
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
    }

    public getRelativePathToPlatformAssets(): string {
        if (this.platformPlugin?.isArtifactPlugin) {
            // if the platform is used as an npm artifact, the content of the npm package is the assets folder itself.
            return this.relPathToPlatform;
        } else {
            return path.join(this.relPathToPlatform, 'assets');
        }
    }

    public getRelativePathToPlatformSources(): string {
        return path.join(
            this.relPathToPlatformAssets,
            this.platformPlugin?.isArtifactPlugin
                ? this.DEST_DIR
                : this.srcFolderName
        );
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

        let defaultRefs = [{ path: this.relPathToPlatformSources }];
        if (this.platformPlugin?.isArtifactPlugin) {
            // do not set references to artifact plugins, as they are not really editable projects
            defaultRefs = [];
        }

        const defaultPathsAndRefs = {
            paths: defaultPaths,
            refs: defaultRefs,
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
            const relPathToDependencySources = path.join(
                relPathToDependency,
                dependency.isArtifactPlugin ? '' : 'assets',
                dependency.isArtifactPlugin ? this.DEST_DIR : this.srcFolderName
            );

            const newPath = AbstractTSConfigGenerator.getPathDependency(
                dependency.pluginName,
                relPathToDependencySources
            );
            const newRef = { path: relPathToDependencySources };

            // if the dependency plugin is an artifact plugin, do not add the references, since it's not a real project
            let newRefs = [...acc.refs, newRef];
            if (dependency.isArtifactPlugin) {
                // do not set references to artifact plugins, as they are not really editable projects
                newRefs = [...acc.refs];
            }
            return {
                paths: {
                    ...acc.paths,
                    ...newPath,
                },
                refs: newRefs,
            };
        }, defaultPathsAndRefs);
    }

    public getTsConfigBasePath(): string {
        return path.join(this.relPathToPlatformAssets, 'tsconfig.base.json');
    }
}
