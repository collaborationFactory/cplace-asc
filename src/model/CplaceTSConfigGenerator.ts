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
     * Retrieves the relative path to a plugin, from the current plugin.
     *
     * @returns {string} The relative path to the plugin.
     * @throws {Error} If the specified plugin is not found.
     */
    public getRelativePathToPlugin(
        cplacePlugin: CplacePlugin | undefined
    ): string {
        if (!cplacePlugin) {
            throw new Error(`Plugin cannot be null`);
        }

        if (this.plugin.pluginName === cplacePlugin.pluginName) {
            return path.join(this.relRepoRootPrefix, cplacePlugin.pluginName);
        }

        const pluginPathRelativeFromRepo =
            cplacePlugin.getPluginPathRelativeFromRepo(
                this.plugin.repo,
                this.localOnly,
                AssetsCompiler.isArtifactsBuild()
            );
        return path.join(this.relRepoRootPrefix, pluginPathRelativeFromRepo);
    }

    public getRelativePathToPluginAssets(
        cplacePlugin: CplacePlugin | undefined
    ): string {
        if (!cplacePlugin) {
            throw new Error(`Plugin cannot be null`);
        }

        const relativePathToPlugin = this.getRelativePathToPlugin(cplacePlugin);
        if (
            AssetsCompiler.isArtifactsBuild() &&
            this.plugin.repo !== cplacePlugin.repo
        ) {
            // in artifact builds, plugin from other repositories would be located in the node_modules and the assets are directly in there
            return relativePathToPlugin;
        } else {
            return path.join(relativePathToPlugin, 'assets');
        }
    }

    public getRelativePathToPluginSources(
        cplacePlugin: CplacePlugin | undefined
    ): string {
        return path.join(
            this.getRelativePathToPluginAssets(cplacePlugin),
            AssetsCompiler.isArtifactsBuild() &&
                this.plugin.repo !== cplacePlugin?.repo
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

            const relPathToDependencySources =
                this.getRelativePathToPluginSources(dependency);

            const newPath = AbstractTSConfigGenerator.getPathDependency(
                dependency.pluginName,
                relPathToDependencySources
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

    /**
     * Get the path to the tsconfig.base.json file.
     * From cplace 25.2, the file is located in the platform assets folder, otherwise it should be taken from the main folder.
     */
    public getTsConfigBasePath(): string {
        const pathInPlatform = path.join(
            this.relPathToPlatformAssets,
            'tsconfig.base.json'
        );
        if (
            fs.existsSync(
                path.join(
                    this.plugin.assetsDir,
                    this.srcFolderName,
                    this.getRelativePathToPluginAssets(this.platformPlugin),
                    'tsconfig.base.json'
                )
            )
        ) {
            return pathInPlatform;
        } else {
            return path.join(this.pathToMain, 'tsconfig.base.json');
        }
    }
}
