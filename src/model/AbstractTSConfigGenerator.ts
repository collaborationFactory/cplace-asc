/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import { debug } from '../utils';
import { ExtraTypesReader } from './ExtraTypesReader';

export abstract class AbstractTSConfigGenerator {
    protected tsConfig: any;
    protected readonly platformPluginName = 'cf.cplace.platform';
    protected readonly platformPlugin: CplacePlugin | undefined;
    protected readonly tsConfigJson = 'tsconfig.json';
    protected mainFolderName = '';
    protected readonly destDir = 'generated_js';

    protected readonly relRepoRootPrefix = '../../..';
    protected readonly pathToMain: string;
    protected readonly relPathToPlatform: string;
    protected readonly relPathToPlatformAssets: string;
    protected readonly relPathToPlatformSources: string;

    constructor(
        protected readonly plugin: CplacePlugin,
        protected readonly dependencies: CplacePlugin[],
        protected readonly localOnly: boolean,
        protected readonly isProduction: boolean,
        protected readonly srcFolderName: string,
        protected readonly isArtifactsBuild: boolean
    ) {
        this.isArtifactsBuild = isArtifactsBuild;
        this.tsConfig = {};
        this.platformPlugin =
            this.plugin.pluginName === this.platformPluginName
                ? this.plugin
                : this.dependencies.find(
                      (d) => d.pluginName === this.platformPluginName
                  );

        this.pathToMain = this.getRelativePathToMain(
            this.localOnly,
            this.plugin.repo,
            this.relRepoRootPrefix
        );
        this.relPathToPlatform = this.getRelativePathToPlugin(
            this.platformPlugin
        );
        this.relPathToPlatformAssets = this.getRelativePathToPluginAssets(
            this.platformPlugin
        );
        this.relPathToPlatformSources = this.getRelativePathToPluginSources(
            this.platformPlugin
        );
    }

    public createConfigAndGetPath(): string {
        const { paths, refs } = this.getPathsAndRefs();

        const extraTypes = ExtraTypesReader.getExtraTypes(
            this.plugin.pluginDir,
            this.dependencies.map((d) => d.pluginDir)
        );
        const additionalIncludes = extraTypes?.definitions ?? [];

        this.tsConfig = {
            extends: this.getTsConfigBasePath(),
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.',
                outDir: path.join('..', this.destDir),
                sourceMap: !this.isProduction,
                declarationMap: !this.isProduction,
                typeRoots: this.getTypeRoots(),
            },
            include: ['./**/*.ts', ...additionalIncludes],
        };

        if (this.plugin.pluginName !== this.platformPluginName) {
            paths['*'].push(...this.getPathsToMainTypes());
            this.tsConfig.compilerOptions.paths = paths;
            this.tsConfig.references = refs;
        }

        this.saveConfig();
        return this.getTSConfigPath();
    }

    public abstract getTsConfigBasePath(): string;

    public abstract getRelativePathToMain(
        localOnly: boolean,
        repo: string,
        relRepoRootPrefix: string
    ): string;

    public abstract getRelativePathToPlugin(
        cplacePlugin: CplacePlugin | undefined
    ): string;

    public abstract getRelativePathToPluginAssets(
        cplacePlugin: CplacePlugin | undefined
    ): string;

    public abstract getRelativePathToPluginSources(
        cplacePlugin: CplacePlugin | undefined
    ): string;

    public abstract getPathsAndRefs(): {
        paths: Record<string, string[]>;
        refs: { path: string }[];
    };

    protected getPathsToMainTypes(): string[] {
        return [
            path.join(this.relRepoRootPrefix, 'node_modules', '@types', '*'),
            path.join(
                this.getRelativePathToPluginAssets(this.plugin),
                'node_modules',
                '@types',
                '*'
            ),
            path.join(this.relPathToPlatformAssets, '@cplaceTypes', '*'),
            path.join(
                this.relPathToPlatformAssets,
                'node_modules',
                '@types',
                '*'
            ),
        ];
    }

    /**
     * Types should be used from the plugins assets, the platform assets and the @cplaceTypes in platform.
     * Any additional specific types should be added to the plugin directly
     *
     * @returns
     */
    protected getTypeRoots(): string[] {
        const typeRoots: string[] = [];

        typeRoots.push(
            path.join(this.relRepoRootPrefix, 'node_modules', '@types')
        );
        typeRoots.push(
            path.join(
                this.getRelativePathToPluginAssets(this.plugin),
                'node_modules',
                '@types'
            )
        );
        typeRoots.push(path.join(this.relPathToPlatformAssets, '@cplaceTypes'));
        typeRoots.push(
            path.join(this.relPathToPlatformAssets, 'node_modules', '@types')
        );

        return typeRoots;
    }

    protected getTSConfigPath(): string {
        return path.join(
            this.plugin.assetsDir,
            this.srcFolderName,
            this.tsConfigJson
        );
    }

    protected saveConfig(): void {
        const content = JSON.stringify(this.tsConfig, null, 4);
        fs.writeFileSync(this.getTSConfigPath(), content, { encoding: 'utf8' });

        debug(
            `(TsConfigGenerator) [${this.plugin.pluginName}] TS Config content:`
        );
        debug(content);
    }

    protected static getPathDependency(
        dependency: string,
        path: string
    ): { [dependencyKey: string]: string[] } {
        const dependencyObject: { [dependencyKey: string]: string[] } = {};
        dependencyObject[`@${dependency}/*`] = [path + '/*'];
        return dependencyObject;
    }
}
