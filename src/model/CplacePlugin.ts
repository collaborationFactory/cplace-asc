/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
import { CplaceTSConfigGenerator } from './CplaceTSConfigGenerator';
import { cerr, cgreen, debug, GREEN_CHECK } from '../utils';
import * as rimraf from 'rimraf';
import { CplaceTypescriptCompiler } from '../compiler/CplaceTypescriptCompiler';
import { CompressCssCompiler } from '../compiler/CompressCssCompiler';
import { E2ETSConfigGenerator } from './E2ETSConfigGenerator';
import { NPMResolver } from './NPMResolver';
import { PluginDescriptor } from './PluginDescriptor';
import { getDescriptorParser } from './DescriptorParser';
import { PackageJsonGenerator } from './PackageJsonGenerator';
import * as spawn from 'cross-spawn';

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
     * Name of the repository this plugin is contained in
     */
    public readonly repo: string;

    /**
     * Path to the plugin's `/assets` directory
     */
    public readonly assetsDir: string;

    public readonly hasTypeScriptAssets: boolean;
    public readonly hasTypeScriptE2EAssets: boolean;
    public readonly hasLessAssets: boolean;
    public readonly hasOpenAPIYamlAssets: boolean;
    public readonly hasCompressCssAssets: boolean;
    public readonly hasVendors: boolean;

    public pluginDescriptor: PluginDescriptor;

    /**
     * Plugins that depend on this plugin (set explicitly afterwards), i.e. incoming dependencies
     */
    public readonly dependents: PluginDescriptor[];

    constructor(
        public readonly pluginName: string,
        public readonly pluginDir: string,
        public readonly production: boolean
    ) {
        this.dependents = [];
        this.pluginDescriptor = this.parsePluginDescriptor(production);

        this.repo = path.basename(path.dirname(path.resolve(pluginDir)));
        this.assetsDir = CplacePlugin.getAssetsDir(this.pluginDir);
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
    }

    public static getAssetsDir(pluginDir: string): string {
        return path.resolve(pluginDir, 'assets');
    }

    public static getPluginPathRelativeToRepo(
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

    public getPluginPathRelativeFromRepo(
        sourceRepo: string,
        localOnly: boolean
    ): string {
        return CplacePlugin.getPluginPathRelativeToRepo(
            sourceRepo,
            this.pluginName,
            this.repo,
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
                    throw Error(
                        `[${this.pluginName}] could not resolve dependency ${this.pluginName}`
                    );
                }
                return plugin;
            })
            .filter((p) => p.hasTypeScriptAssets);

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

    public generatePackageJson(repositoryDir: string): void {
        if (!this.hasTypeScriptAssets) {
            console.log(
                cgreen`⇢`,
                `[${this.pluginName}] plugin does not have TypeScript assets`
            );
            return;
        }

        const packageJsonGenerator = new PackageJsonGenerator(this, repositoryDir);
        const packageJsonPath = packageJsonGenerator.createContentAndGetPath();

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

    public generateTsE2EConfig(
        pluginResolver: ICplacePluginResolver,
        isProduction: boolean,
        localOnly: boolean
    ): void {
        if (!this.hasTypeScriptE2EAssets) {
            throw Error(
                `[${this.pluginName}] plugin does not have TypeScript E2E assets`
            );
        }
        const dependenciesWithE2ETypeScript = this.pluginDescriptor.dependencies
            .map((pluginDescriptor) => {
                const plugin = pluginResolver(pluginDescriptor.name);
                if (!plugin) {
                    throw Error(
                        `[${this.pluginName}] could not resolve dependency ${this.pluginName}`
                    );
                }
                return plugin;
            })
            .filter((p) => p.hasTypeScriptE2EAssets);
        const tsConfigGenerator = new E2ETSConfigGenerator(
            this,
            dependenciesWithE2ETypeScript,
            localOnly,
            isProduction
        );
        const tsconfigPath = tsConfigGenerator.createConfigAndGetPath();

        if (!fs.existsSync(tsconfigPath)) {
            console.error(
                cerr`[${this.pluginName}] Could not generate tsconfig E2E file...`
            );
            throw Error(`[${this.pluginName}] tsconfig E2E generation failed`);
        } else {
            console.log(
                `${GREEN_CHECK} [${this.pluginName}] wrote tsconfig E2E...`
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
        if (!this.isFileTracked(path.resolve(this.pluginDir, 'assets', 'package.json'))) {
            promises.push(this.removeDir(path.resolve(this.pluginDir, 'assets', 'package.json')));
            if (fs.existsSync(path.resolve(this.pluginDir, 'assets', 'package-lock.json'))) {
                promises.push(this.removeDir(path.resolve(this.pluginDir, 'assets', 'package-lock.json')));
            }
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

    public static getPathToDescriptor(
        pluginDir: string
    ) {
        return path.join(
            pluginDir,
            CplacePlugin.DESCRIPTOR_FILE_NAME
        );
    }

    private static getPathToBuildGradle(
        pluginDir: string
    ) {
        return path.join(
            pluginDir,
            CplacePlugin.BUILD_GRADLE_FILE_NAME
        );
    }

    private async removeDir(path: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            rimraf(path, (e) => {
                if (!e) {
                    debug(
                        `(CplacePlugin) [${this.pluginName}] removed folder ${path}`
                    );
                    resolve();
                } else {
                    reject(e);
                }
            });
        });
    }

    /**
     * Check if a file in the plugin is tracked
     * 
     * @param pathToFile path to file relative to pluginDir
     */
    private isFileTracked(pathToFile: string): boolean {
        const res = spawn.sync(
            'git', ['ls-files', '--error-unmatch', pathToFile],
            {
                cwd: this.pluginDir,
            }
        );
        if (res.status !== 0) {
            debug(
                `[${this.pluginName}] (CplacePlugin) file ${pathToFile} is not tracked`
            );
            return false;
        }
        return true;
    }
}
