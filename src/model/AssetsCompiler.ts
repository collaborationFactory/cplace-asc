/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as fs from 'fs';
import * as path from 'path';
import CplacePlugin from './CplacePlugin';
import { ExecutorService, Scheduler } from '../executor';
import {
    cerr,
    cgreen,
    csucc,
    debug,
    formatDuration,
    IUpdateDetails,
} from '../utils';
import { NPMResolver } from './NPMResolver';
import { ImlParser } from './ImlParser';
import { PluginDescriptorParser } from './PluginDescriptorParser';

export interface IAssetsCompilerConfiguration {
    /**
     * Plugin names to start compilation for. All dependencies will be included
     * automatically, too.
     */
    rootPlugins: string[];

    /**
     * Indicates whether file watching should be active
     */
    watchFiles: boolean;

    /**
     * Indicates whether only the preprocessing steps should be executed but no acutal compilation
     */
    onlyPreprocessing: boolean;

    /**
     * Indicates whether generated folders should be cleaned before execution
     */
    clean: boolean;

    /**
     * The maximum number of compilation steps to run in parallel at once
     */
    maxParallelism: number;

    /**
     * Indicates whether only the current directory should be processed for plugins
     */
    localOnly: boolean;

    /**
     * Indicates whether the compiler should be run in production mode
     */
    production: boolean;

    /**
     * Indicates whether parent repositories should be excluded from compilation
     */
    noParents: boolean;

    /**
     * Indicates that npm artifacts should be used for the parent repos, instead of checkout out parent repos.
     */
    withParentArtifacts: boolean;
}

/**
 * This represents the main execution logic for the whole compilation process
 */
export class AssetsCompiler {
    public static readonly PLATFORM_PLUGIN_NAME = 'cf.cplace.platform';

    /**
     * Name of the repository the compiler was started in
     */
    private readonly repositoryName: string;

    /**
     * Map of known plugin names to plugin instance
     */
    private readonly projects = new Map<string, CplacePlugin>();

    /**
     * Executor used to run all compilation steps
     */
    private executor: ExecutorService | null = null;

    /**
     * Schedule managing order and necessity of execution
     */
    private scheduler: Scheduler | null = null;

    /**
     * NPMResolver to manage node_modules
     */
    private npmResolver: NPMResolver | null = null;

    constructor(
        private readonly runConfig: IAssetsCompilerConfiguration,
        private readonly repositoryDir: string
    ) {
        this.repositoryName = path.basename(repositoryDir);
        this.projects = this.setupProjects();
    }

    public async start(updateDetails?: IUpdateDetails): Promise<void> {
        if (!this.projects.size) {
            console.log(cgreen`->`, 'Nothing to do, no plugins detected...');
            return new Promise<void>((resolve) => resolve());
        }

        const mainRepoPath = AssetsCompiler.getMainRepoPath(
            this.repositoryDir,
            this.runConfig.localOnly
        );
        if (mainRepoPath === null) {
            debug(`(AssetsCompiler) Main repo cannot be found...`);
            return new Promise<void>((resolve, reject) =>
                reject('Main repo cannot be found...')
            );
        }

        const start = new Date().getTime();
        if (this.runConfig.clean) {
            debug(`(AssetsCompiler) running clean for all plugins...`);
            for (const plugin of this.projects.values()) {
                if (this.isInCompilationScope(plugin)) {
                    await plugin.cleanGeneratedOutput();
                }
            }
        }
        
        if (this.runConfig.withParentArtifacts) {
            debug(`(AssetsCompiler) generating package.json for all plugins...`);
            for (const plugin of this.projects.values()) {
                if (this.isInCompilationScope(plugin)) {
                    plugin.generatePackageJson(this.repositoryDir);
                }
            }
        }

        this.npmResolver = new NPMResolver(
            mainRepoPath,
            this.runConfig.watchFiles
        );
        await this.npmResolver.resolve();

        if (this.runConfig.onlyPreprocessing) {
            console.log();
            console.log(csucc`Preprocessing completed successfully`);
            console.log();
            return new Promise<void>((resolve) => resolve());
        }

        this.executor = new ExecutorService(this.runConfig.maxParallelism);
        this.scheduler = new Scheduler(
            this.executor,
            this.projects,
            this.repositoryName,
            mainRepoPath,
            this.runConfig.production,
            this.runConfig.noParents,
            this.runConfig.watchFiles,
            updateDetails
        );

        debug(`(AssetsCompiler) starting scheduler for compilation tasks...`);
        return this.scheduler.start().then(
            () => {
                const end = new Date().getTime();
                const successLog = () => {
                    console.log();
                    console.log(
                        csucc`Assets compiled successfully (${formatDuration(
                            end - start
                        )})`
                    );
                    console.log();
                };

                if (!!this.executor) {
                    this.executor.destroy().then(successLog, successLog);
                }
            },
            (e) => {
                debug(
                    `(AssetsCompiler) Error while running assets compiler: ${e}`
                );
                const errorLog = () => {
                    console.log();
                    console.error(
                        cerr`COMPILATION FAILED - please check errors in output above`
                    );
                    console.log();
                };

                if (!!this.executor) {
                    this.executor.destroy().then(errorLog, errorLog);
                }
                throw e;
            }
        );
    }

    public async shutdown(): Promise<void> {
        if (!!this.scheduler) {
            this.scheduler.stop();
        }
        if (!!this.npmResolver) {
            this.npmResolver.stop();
        }

        if (!!this.executor) {
            try {
                await this.executor.destroy();
            } catch (e) {
                debug(e);
            }
        }
    }

    private setupProjects(): Map<string, CplacePlugin> {
        let knownRepoDependencies: string[];
        if (this.runConfig.localOnly) {
            knownRepoDependencies = [];
            debug(
                `(AssetsCompiler) Ignoring repo dependencies since localOnly execution...`
            );
        } else {
            knownRepoDependencies = AssetsCompiler.getRepoDependencies(
                this.repositoryDir
            );
            debug(
                `(AssetsCompiler) Detected repo dependencies: ${knownRepoDependencies.join(
                    ', '
                )}`
            );
        }

        const projects = new Map<string, CplacePlugin>();
        const files = fs.readdirSync(this.repositoryDir);

        files.forEach((file) => {
            const filePath = path.join(this.repositoryDir, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                const potentialPluginName = path.basename(file);
                if (
                    (this.runConfig.rootPlugins.length === 0 ||
                        this.runConfig.rootPlugins.indexOf(
                            potentialPluginName
                        ) !== -1) &&
                    AssetsCompiler.directoryLooksLikePlugin(
                        filePath,
                        potentialPluginName
                    )
                ) {
                    AssetsCompiler.addProjectDependenciesRecursively(
                        this.repositoryDir,
                        projects,
                        knownRepoDependencies,
                        potentialPluginName,
                        filePath,
                        this.runConfig
                    );
                }
            }
        });

        projects.forEach((project) => {
            if (!this.isInCompilationScope(project)) {
                return;
            }

            if (project.hasTypeScriptAssets) {
                project.generateTsConfig(
                    (p) => projects.get(p),
                    this.runConfig.production,
                    this.runConfig.localOnly
                );
            }
            if (project.hasTypeScriptE2EAssets) {
                if (!this.runConfig.production) {
                    project.generateTsE2EConfig(
                        (p) => projects.get(p),
                        false,
                        this.runConfig.localOnly
                    );
                }
            }
        });

        AssetsCompiler.setDependents(projects);
        return projects;
    }

    public static getMainRepoPath(
        repositoryDir: string,
        localonly: boolean
    ): string | null {
        let mainRepoPath = '';
        if (localonly) {
            debug(
                `(AssetsCompiler) Resolving main repo path [localonly] as: "${repositoryDir}"`
            );
            mainRepoPath = path.resolve(repositoryDir);
        } else {
            debug(
                `(AssetsCompiler) Resolving main repo path from root: "${repositoryDir}"`
            );
            if (
                fs.existsSync(
                    path.resolve(path.join(repositoryDir, '..', 'main'))
                )
            ) {
                debug(`(AssetsCompiler) Found as "main"`);
                mainRepoPath = path.resolve(
                    path.join(repositoryDir, '..', 'main')
                );
            } else if (
                fs.existsSync(
                    path.resolve(path.join(repositoryDir, '..', 'cplace'))
                )
            ) {
                debug(`(AssetsCompiler) Found as "cplace"`);
                mainRepoPath = path.resolve(
                    path.join(repositoryDir, '..', 'cplace')
                );
            } else {
                debug(
                    `(AssetsCompiler) Failed to find main/cplace repository...`
                );
                return null;
            }
        }

        debug(`(AssetsCompiler) main repo resolved to: "${mainRepoPath}"`);
        if (
            !fs.existsSync(
                path.join(mainRepoPath, AssetsCompiler.PLATFORM_PLUGIN_NAME)
            )
        ) {
            debug(
                `(AssetsCompiler) Failed to find cf.cplace.platform inside: "${mainRepoPath}"`
            );
            return null;
        }

        return mainRepoPath;
    }

    private static directoryLooksLikePlugin(
        pluginPath: string,
        potentialPluginName: string
    ): boolean {
        return (
            (ImlParser.doesImlExist(pluginPath, potentialPluginName) ||
                CplacePlugin.isCplacePluginWithGradleAndContainsPluginDescriptor(
                    pluginPath
                )) &&
            fs.existsSync(path.join(pluginPath, 'src'))
        ); // path to src directory - release-notes will be excluded
    }

    private static addProjectDependenciesRecursively(
        repositoryDir: string,
        projects: Map<string, CplacePlugin>,
        repoDependencies: string[],
        pluginName: string,
        pluginPath: string,
        runConfig: IAssetsCompilerConfiguration
    ) {
        if (projects.has(pluginName)) {
            return;
        }

        const project = new CplacePlugin(pluginName, pluginPath, runConfig.production);

        projects.set(pluginName, project);

        project.pluginDescriptor.dependencies.forEach((pluginDescriptor) => {
            if (projects.has(pluginDescriptor.name)) {
                return;
            }
            const pluginPath = this.findPluginPath(
                repositoryDir,
                pluginDescriptor.name,
                repoDependencies
            );
            this.addProjectDependenciesRecursively(
                repositoryDir,
                projects,
                repoDependencies,
                pluginDescriptor.name,
                pluginPath,
                runConfig
            );
        });
    }

    private static setDependents(projects: Map<string, CplacePlugin>) {
        for (const plugin of projects.values()) {
            plugin.pluginDescriptor.dependencies
                .map((pluginDescriptor) => projects.get(pluginDescriptor.name))
                .forEach((p) => {
                    if (!!p) {
                        p.dependents.push(plugin.pluginDescriptor);
                    }
                });
        }
    }

    private static getRepoDependencies(repositoryDir: string): string[] {
        if (
            path.basename(repositoryDir) === 'main' ||
            path.basename(repositoryDir) === 'cplace'
        ) {
            return [];
        }

        const parentReposPath = path.join(repositoryDir, 'parent-repos.json');
        if (!fs.existsSync(parentReposPath)) {
            debug(
                `(AssetsCompiler) could not find parent-repos.json: ${parentReposPath}`
            );
            return [];
        }
        const parentReposContent = fs.readFileSync(parentReposPath, 'utf8');
        try {
            const parentRepos = JSON.parse(parentReposContent);
            return Object.keys(parentRepos);
        } catch (err) {
            console.error(
                cerr`Failed to parse parent-repos.json: ${parentReposPath}`
            );
            throw err;
        }
    }

    public static findPluginPath(
        repositoryDir: string,
        pluginName: string,
        repoDependencies: string[]
    ): string {
        let relativePathToPlugin = pluginName;
        if (AssetsCompiler.isPluginFolder(repositoryDir, pluginName)) {
            return path.join(repositoryDir, relativePathToPlugin);
        }
        for (const repoName of repoDependencies) {
            const pathToRepo = path.resolve(repositoryDir, '..', repoName);
            relativePathToPlugin = path.join('..', repoName, pluginName);
            if (AssetsCompiler.isPluginFolder(pathToRepo, pluginName)) {
                return relativePathToPlugin;
            }
        }
        console.error(cerr`Could not locate plugin ${pluginName}`);
        throw Error(`Could not locate plugin ${pluginName}`);
    }

    private static isPluginFolder(
        repoPath: string,
        pluginName: string
    ): boolean {
        if (
            fs.existsSync(path.join(repoPath, 'build.gradle')) &&
            fs.existsSync(path.join(repoPath, pluginName, 'build.gradle'))
        ) {
            // a plugin in cplace 5.4 and later, with Gradle build files whose existence we just checked
            return true;
        } else if (
            !fs.existsSync(path.join(repoPath, 'build.gradle')) &&
            fs.existsSync(path.join(repoPath, pluginName))
        ) {
            // a potential plugin in cplace 5.3 and earlier, with Ant build files and IML project files; we don't check those however
            return true;
        }
        return false;
    }

    private isInCompilationScope(plugin: CplacePlugin): boolean {
        return !this.runConfig.noParents || plugin.repo === this.repositoryName;
    }
}
