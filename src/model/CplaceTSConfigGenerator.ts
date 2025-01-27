/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as process from 'process';
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
        super(
            plugin,
            dependencies,
            localOnly,
            isProduction,
            'ts',
            AssetsCompiler.isArtifactsBuild()
        );
    }

    public getRelativePathToMain(
        localOnly: boolean,
        repo: string,
        relRepoRootPrefix: string
    ) {
        if (AssetsCompiler.isArtifactsBuild()) {
            // for artifacts build, the main folder will not be used in any way
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

    /**
     * Retrieves the relative path to the platform plugin, from the current plugin.
     *
     * @returns {string} The relative path to the platform.
     * @throws {Error} If the platform plugin is not found.
     */
    public getRelativePathToPlatform(): string {
        if (this.plugin.pluginName === this.platformPluginName) {
            return path.join(this.relRepoRootPrefix, this.platformPluginName);
        }

        if (this.platformPlugin) {
            const platformPathRelativeFromRepo =
                this.platformPlugin.getPluginPathRelativeFromRepo(
                    this.plugin.repo,
                    this.localOnly,
                    AssetsCompiler.isArtifactsBuild()
                );
            return path.join(
                this.relRepoRootPrefix,
                platformPathRelativeFromRepo
            );
        } else {
            throw new Error('Platform plugin not found');
        }
    }

    public getRelativePathToPlatformAssets(): string {
        if (
            AssetsCompiler.isArtifactsBuild() &&
            this.plugin.pluginName !== this.platformPluginName
        ) {
            // for artifact builds, the platform location would be in the node_modules and the assets are directly in there
            return this.relPathToPlatform;
        } else {
            return path.join(this.relPathToPlatform, 'assets');
        }
    }

    public getRelativePathToPlatformSources(): string {
        return path.join(
            this.relPathToPlatformAssets,
            AssetsCompiler.isArtifactsBuild()
                ? this.destDir
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
        if (AssetsCompiler.isArtifactsBuild()) {
            // do not set references to plugins from other repos in artifact build, as they are not really editable projects
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
                    this.localOnly,
                    AssetsCompiler.isArtifactsBuild()
                )
            );
            // the assets of the dependency plugin are either in the 'assets' folder, if the plugin is from the same repo, or this is not an artifact build
            // if it's an artifact build, or the dependency plugin is from another repo, then the assets are directly in the npm package inside the node_modules
            const relPathToDependencyAssets = path.join(
                relPathToDependency,
                !AssetsCompiler.isArtifactsBuild() ||
                    this.plugin.repo === dependency.repo
                    ? 'assets'
                    : ''
            );
            const relPathToDependencySources = path.join(
                relPathToDependencyAssets,
                this.srcFolderName
            );
            const relPathToDependencyOutput = path.join(
                relPathToDependencyAssets,
                this.destDir
            );

            const newPath = AbstractTSConfigGenerator.getPathDependency(
                dependency.pluginName,
                relPathToDependencyOutput
            );
            const newRef = { path: relPathToDependencySources };

            // if the dependency plugin is an artifact plugin, do not add the references, since it's not a real project
            let newRefs = [...acc.refs];
            if (
                !AssetsCompiler.isArtifactsBuild() ||
                this.plugin.repo === dependency.repo
            ) {
                // do not set references to artifact plugins, as they are not really editable projects
                newRefs = [...acc.refs, newRef];
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

    public getTypeRootsOfLinkedPlugins(): string[] {
        const typeRoots: string[] = [];
        return this.dependencies.reduce((acc, dependency) => {
            const dependencyRepoName =
                dependency.repo === 'cplace' ? 'main' : dependency.repo;
            if (
                dependencyRepoName !== this.plugin.repo &&
                AssetsCompiler.isLocalParentRepo(dependencyRepoName)
            ) {
                const pathToTypes = path.join(
                    this.relRepoRootPrefix,
                    '..',
                    dependencyRepoName,
                    'node_modules',
                    '@types'
                );
                return [...acc, pathToTypes];
            }

            return acc;
        }, typeRoots);
    }

    public getTsConfigBasePath(): string {
        return AssetsCompiler.isArtifactsBuild()
            ? path.join(this.relPathToPlatformAssets, 'tsconfig.base.json')
            : path.join(this.pathToMain, 'tsconfig.base.json');
    }
}
