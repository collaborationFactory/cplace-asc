/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
import { CplaceTSConfigGenerator } from './CplaceTSConfigGenerator';
import { cerr, cgreen, cwarn, debug, GREEN_CHECK } from '../utils';
import { CplaceTypescriptCompiler } from '../compiler/CplaceTypescriptCompiler';
import { CompressCssCompiler } from '../compiler/CompressCssCompiler';
import { NPMResolver } from './NPMResolver';
import { PluginDescriptor } from './PluginDescriptor';
import { getDescriptorParser } from './DescriptorParser';
import { PluginPackageJsonGenerator } from './PluginPackageJsonGenerator';
import { CombineJavascriptCompiler } from '../compiler/CombineJavascriptCompiler';
import { AssetsCompiler } from './AssetsCompiler';

export interface ICplacePluginResolver {
    (pluginName: string): CplacePlugin | undefined;
}

/**
 * Represents a cplace plugin that needs to be compiled
 */
export default class CplacePlugin {
    public static readonly DESCRIPTOR_FILE_NAME = 'pluginDescriptor.json';
    public static readonly BUILD_GRADLE_FILE_NAME = 'build.gradle';

    /**
     * Path to the plugin's `/assets` directory
     */
    public readonly assetsDir: string;

    public readonly hasAssetsFolder: boolean;
    public readonly hasTypeScriptAssets: boolean;
    public readonly hasTypeScriptE2EAssets: boolean;
    public readonly hasLessAssets: boolean;
    public readonly hasOpenAPIYamlAssets: boolean;
    public readonly hasCompressCssAssets: boolean;
    public readonly hasVendors: boolean;
    public readonly hasCombineJs: boolean;

    public pluginNameKebabCase: string;
    public pluginDescriptor: PluginDescriptor;

    protected readonly relRepoRootPrefix = '../../..';

    /**
     * Plugins that depend on this plugin (set explicitly afterwards), i.e. incoming dependencies
     */
    public readonly dependents: PluginDescriptor[];

    constructor(
        public readonly repo: string,
        public readonly pluginName: string,
        public readonly pluginDir: string,
        public readonly isArtifactPlugin: boolean,
        public readonly production: boolean
    ) {
        this.pluginNameKebabCase = this.pluginName.replace(/\./gi, '-').toLowerCase();
        this.dependents = [];
        this.pluginDescriptor = this.parsePluginDescriptor(production);

        this.assetsDir = CplacePlugin.getAssetsDir(
            this.pluginDir,
            this.isArtifactPlugin
        );
        this.hasAssetsFolder = fs.existsSync(path.resolve(this.assetsDir));
        this.hasTypeScriptAssets = fs.existsSync(
            path.resolve(this.assetsDir, 'ts', 'app.ts')
        );
        this.hasTypeScriptE2EAssets = false;
        const e2ePath: string = path.resolve(this.assetsDir, 'e2e');
        if (fs.existsSync(e2ePath)) {
            this.hasTypeScriptE2EAssets =
                glob.sync(path.join(e2ePath, '**', '*.ts')).length > 0;
        }
        this.hasOpenAPIYamlAssets =
            glob.sync(path.join(this.pluginDir, 'api', '*.yaml')).length > 0;
        this.hasLessAssets =
            glob.sync(path.join(this.assetsDir, '**', '*.less'), {
                ignore: path.join(
                    this.assetsDir,
                    'node_modules',
                    '**',
                    '*.less'
                ),
            }).length > 0;
        this.hasVendors = fs.existsSync(
            path.resolve(this.assetsDir, 'package.json')
        );
        this.hasCompressCssAssets = fs.existsSync(
            path.resolve(
                this.assetsDir,
                'css',
                CompressCssCompiler.ENTRY_FILE_NAME
            )
        );
        this.hasCombineJs = fs.existsSync(
            path.resolve(
                this.assetsDir,
                CombineJavascriptCompiler.ENTRY_FILE_NAME
            )
        );
    }

    public static getAssetsDir(
        pluginDir: string,
        isArtifactPlugin: boolean
    ): string {
        if (isArtifactPlugin) {
            return pluginDir;
        }
        return path.resolve(pluginDir, 'assets');
    }

    private getPluginPathRelativeToRepo(
        sourceRepo: string,
        targetPluginName: string,
        targetRepo: string,
        localOnly: boolean
    ): string {
        if (localOnly || sourceRepo === targetRepo) {
            return targetPluginName;
        } else {
            return path.join('..', targetRepo, targetPluginName);
        }
    }

    /**
     * Returns the relative path of the plugin starting from the given source repository.
     * For artifacts build, this would be in the node_modules of the repository.
     */
    public getPluginPathRelativeFromRepo(
        sourceRepo: string,
        localOnly: boolean,
        isArtifactsBuild: boolean
    ): string {
        // in an artifacts build, all plugins from otherrepos are taken from the node_modules
        if (isArtifactsBuild && this.repo !== sourceRepo) {
            return path.join(
                'node_modules',
                '@cplace-assets',
                `${this.repo}_${this.pluginNameKebabCase}`
            );
        }
        return this.getPluginPathRelativeToRepo(
            sourceRepo,
            this.pluginName,
            this.repo == 'cplace' ? 'main' : this.repo,
            localOnly
        );
    }

    public generateTsConfig(
        pluginResolver: ICplacePluginResolver,
        isProduction: boolean,
        localOnly: boolean
    ): void {
        if (!this.hasTypeScriptAssets) {
            throw Error(
                `[${this.pluginName}] plugin does not have TypeScript assets`
            );
        }

        const dependenciesWithTypeScript = this.pluginDescriptor.dependencies
            .map((pluginDescriptor) => {
                const plugin = pluginResolver(pluginDescriptor.name);
                if (!plugin) {
                    cwarn`Plugin ${pluginDescriptor.name} not found in node_modules. Ignoring...`;
                }
                return plugin;
            })
            .filter(
                (p) => p != undefined && p.hasTypeScriptAssets
            ) as CplacePlugin[];

        const tsConfigGenerator = new CplaceTSConfigGenerator(
            this,
            dependenciesWithTypeScript,
            localOnly,
            isProduction
        );
        const tsconfigPath = tsConfigGenerator.createConfigAndGetPath();

        if (!fs.existsSync(tsconfigPath)) {
            console.error(
                cerr`[${this.pluginName}] Could not generate tsconfig file...`
            );
            throw Error(`[${this.pluginName}] tsconfig generation failed`);
        } else {
            console.log(
                `${GREEN_CHECK} [${this.pluginName}] wrote tsconfig...`
            );
        }
    }

    /**
     * Generate a less file named 'cplace-pluging.less' if the plugin has less files.
     * This file will contain a variable for each dependency plugin, pointing to the path to that plugin.
     * Based on the use case (local build or artifact build) the path to the dependency plugin will be different.
     * The less files can then reference any file from a dependency plugin through these variables instead of directly with a hardcoded relative path.
     *
     * @param pluginResolver
     * @param localOnly
     */
    public generateCplacePluginsLess(
        pluginResolver: ICplacePluginResolver,
        localOnly: boolean
    ): void {
        if (!this.hasLessAssets) {
            throw Error(
                `[${this.pluginName}] plugin does not have Less assets`
            );
        }

        const dependenciesWithLess = this.pluginDescriptor.dependencies
            .map((pluginDescriptor) => {
                const plugin = pluginResolver(pluginDescriptor.name);
                if (!plugin) {
                    cwarn`Plugin ${pluginDescriptor.name} not found in node_modules. Ignoring...`;
                }
                return plugin;
            })
            .filter(
                (p) => p != undefined && p.hasLessAssets
            ) as CplacePlugin[];

        // generate cplace-plugins.less
        const cplacePluginsLessPath = path.join(this.assetsDir, 'less', 'cplace-plugins.less');
        const lessFileContent: string[] = [];
        dependenciesWithLess.forEach((plugin) => {
            let lessPath = path.join(
                this.relRepoRootPrefix,
                plugin.getPluginPathRelativeFromRepo(
                    this.repo,
                    localOnly,
                    AssetsCompiler.isArtifactsBuild()
                )
            );
            // if it's not an artifact build, the less files are in the assets folder of the plugin
            if (!AssetsCompiler.isArtifactsBuild()) {
                lessPath = path.join(
                    lessPath,
                    'assets'
                );
            }
            lessFileContent.push(
                `@plugin-path-${plugin.pluginNameKebabCase}: '${lessPath}';`
            );
        });
        fs.writeFileSync(cplacePluginsLessPath, lessFileContent.join('\n'));

        if (!fs.existsSync(cplacePluginsLessPath)) {
            console.error(
                cerr`[${this.pluginName}] Could not generate cplace-plugins.less file...`
            );
            throw Error(`[${this.pluginName}] cplace-plugins.less generation failed`);
        } else {
            console.log(
                `${GREEN_CHECK} [${this.pluginName}] wrote cplace-plugins.less...`
            );
        }
    }

    /**
     * Generate empty package.json file (only name and version) in assets folder for publishing purposes.
     */
    public generatePackageJson(repositoryDir: string): void {
        if (!this.hasAssetsFolder) {
            console.log(
                cgreen`⇢`,
                `[${this.pluginName}] plugin does not have assets`
            );
            return;
        }

        const packageJsonGenerator = new PluginPackageJsonGenerator(
            this,
            repositoryDir
        );
        const packageJsonPath = packageJsonGenerator.generatePackageJson();

        if (!fs.existsSync(packageJsonPath)) {
            console.error(
                cerr`[${this.pluginName}] Could not generate package.json file...`
            );
            throw Error(`[${this.pluginName}] package.json generation failed`);
        } else {
            console.log(
                `${GREEN_CHECK} [${this.pluginName}] wrote package.json`
            );
        }
    }

    public async cleanGeneratedOutput(): Promise<void> {
        const promises: Promise<void>[] = [];
        if (this.hasLessAssets || this.hasCompressCssAssets) {
            const generatedCss = CompressCssCompiler.getCssOutputDir(
                this.assetsDir
            );
            promises.push(this.removeDir(generatedCss));
        }
        if (this.hasTypeScriptAssets) {
            const generatedJs = CplaceTypescriptCompiler.getJavaScriptOutputDir(
                this.assetsDir
            );
            promises.push(this.removeDir(generatedJs));
        }
        if (this.hasVendors) {
            const pluginNodeModules = NPMResolver.getPluginNodeModulesPath(
                this.assetsDir
            );
            promises.push(this.removeDir(pluginNodeModules));
        }
        if (this.hasCombineJs) {
            const generatedDir = CombineJavascriptCompiler.getOutputDir(
                this.assetsDir
            );
            promises.push(this.removeDir(generatedDir));
        }
        await Promise.all(promises);

        if (promises.length) {
            console.log(
                `${GREEN_CHECK} [${this.pluginName}] cleaned output directories`
            );
        }
    }

    public parsePluginDescriptor(
        excludeTestDependencies: boolean = false
    ): PluginDescriptor {
        if (this.isArtifactPlugin) {
            // no plugin descriptor for plugins in node_modules
            return {
                name: this.pluginName,
                group: '',
                repoName: this.repo,
                dependencies: [],
                dependenciesExtendedInfo: [],
            };
        }

        return getDescriptorParser(
            this.pluginDir,
            this.pluginName,
            excludeTestDependencies
        ).getPluginDescriptor();
    }

    public static isCplacePluginWithGradleAndContainsPluginDescriptor(
        pluginDir: string
    ): boolean {
        return (
            fs.existsSync(this.getPathToDescriptor(pluginDir)) &&
            fs.existsSync(this.getPathToBuildGradle(pluginDir))
        );
    }

    public static getPathToDescriptor(pluginDir: string) {
        return path.join(pluginDir, CplacePlugin.DESCRIPTOR_FILE_NAME);
    }

    private static getPathToBuildGradle(pluginDir: string) {
        return path.join(pluginDir, CplacePlugin.BUILD_GRADLE_FILE_NAME);
    }

    private async removeDir(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.rm(path, { recursive: true, force: true }, (e) => {
                if (!e) {
                    debug(
                        `(CplacePlugin) [${this.pluginName}] removed folder ${path}`
                    );
                    resolve();
                } else {
                    console.error(
                        cerr`(CplacePlugin) [${this.pluginName}] cannot remove path ${path}. ${e}`
                    );
                    reject(e);
                }
            });
        });
    }
}
