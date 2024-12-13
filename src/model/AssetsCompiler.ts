/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as fs from 'fs';
import * as path from 'path';
import CplacePlugin from './CplacePlugin';
import { ExecutorService, Scheduler } from '../executor';
import { cerr, cgreen, csucc, cwarn, debug, formatDuration } from '../utils';
import { NPMResolver } from './NPMResolver';
import { ImlParser } from './ImlParser';
import { CplaceVersion } from './CplaceVersion';
import { PluginDescriptor } from './PluginDescriptor';
import { isArtifactsOnlyBuild } from '..';

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
     * Indicates if TypeScript files should be generated from the YAML files
     */
    withYaml: boolean;

    /**
     * Indicates whether the compiler should be run in production mode
     */
    production: boolean;

    /**
     * Indicates whether parent repositories should be excluded from compilation
     */
    noParents: boolean;

    /**
     * Indicates that the dependency plugins from parent repos will be used as npm artifacts from node_modules, instead of taking them from the folders of the parent repos
     */
    useParentArtifacts: boolean;

    /**
     * Indicates that package.json files will be created in the root and each plugin that has assets.
     */
    packagejson: boolean;

    /**
     * Explicitly sets the current cplace version.
     */
    cplaceversion: string;
}

export interface ParentRepo {
    /**
     * URL of the parent repository.
     */
    url: string;

    /**
     * Branch of the parent repository.
     */
    branch: string;

    /**
     * Indicates whether the plugins from this repository are used as local plugins from the file system, or as npm artifacts.
     * If the value is true, the plugins from this repository will be looked up in the node_modules.
     */
    pluginsAreArtifacts: boolean;
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
    private projects = new Map<string, CplacePlugin>();

    /**
     * Executor used to run all compilation steps
     */
    private executor: ExecutorService | null = null;

    /**
     * Schedule managing order and necessity of execution
     */
    private scheduler: Scheduler | null = null;

    /**
     * List of all parent repos
     */
    private static repoDependencies: Map<string, ParentRepo> = new Map();

    /**
     * NPMResolver to manage node_modules
     */
    private npmResolver: NPMResolver | null = null;

    constructor(
        private readonly runConfig: IAssetsCompilerConfiguration,
        private readonly repositoryDir: string
    ) {
        console.log(`⟲ Starting the main process with pid ${process.pid}`);
        if (!AssetsCompiler.shouldUseAscLocal()) {
            console.warn(
                cwarn`@cplace/asc-local should only be used starting from the cplace release 23.2!`
            );
        }
        this.repositoryName = path.basename(repositoryDir);

        this.npmResolver = new NPMResolver();
        this.npmResolver.init();
    }

    private static shouldUseAscLocal(): boolean {
        const version = CplaceVersion.get();
        const isAtLeast23_2 =
            (version.major === 23 && version.minor >= 2) || version.major > 23;
        const is23_1Snapshot =
            version.major === 23 && version.minor === 1 && version.isSnapshot();
        return isAtLeast23_2 || is23_1Snapshot;
    }

    public async start(): Promise<void> {
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

        if (this.runConfig.packagejson) {
            debug(
                `(AssetsCompiler) generating package.json for all plugins...`
            );
            for (const plugin of this.projects.values()) {
                if (this.isInCompilationScope(plugin)) {
                    plugin.generatePackageJson(this.repositoryDir);
                }
            }
        }

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
            this.runConfig.withYaml
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

        if (!!this.executor) {
            try {
                await this.executor.destroy();
            } catch (e) {
                debug(e);
            }
        }
    }

    /**
     * Collect all plugins that need to be processed.
     */
    public async setupProjects(): Promise<void> {
        if (this.runConfig.localOnly) {
            debug(
                `(AssetsCompiler) Ignoring repo dependencies since localOnly execution...`
            );
        } else {
            AssetsCompiler.repoDependencies =
                await AssetsCompiler.getRepoDependencies(this.repositoryDir);
            debug(
                `(AssetsCompiler) Detected repo dependencies: ${Object.keys(
                    AssetsCompiler.repoDependencies
                )}.join(
                    ', '
                )}`
            );
        }

        const projects = new Map<string, CplacePlugin>();
        const files = fs.readdirSync(this.repositoryDir);

        // go through all plugins of the current repo and collect any dependency plugin recursively
        // the plugin discovery is done by checking the pluginDescriptor.json and calling the recursive method for each dependency
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
                        this.repositoryName,
                        potentialPluginName,
                        filePath,
                        false,
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
                console.log(
                    cwarn`[${project.pluginName}] E2E assets are no longer compiled! Starting from the cplace release 23.1 all the E2E tests should be moved into a dedicated E2E repository. In addition, E2E tests must be written using Cypress!`
                );
            }
        });

        AssetsCompiler.setDependents(projects);
        this.projects = projects;
    }

    public static getMainRepoPath(
        repositoryDir: string,
        localonly: boolean
    ): string | null {
        let mainRepoPath = '';
        if (localonly || isArtifactsOnlyBuild()) {
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
            !localonly &&
            !isArtifactsOnlyBuild() &&
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
        repoName: string,
        pluginName: string,
        pluginPath: string,
        isArtifactPlugin: boolean,
        runConfig: IAssetsCompilerConfiguration
    ) {
        const project = new CplacePlugin(
            repoName,
            pluginName,
            pluginPath,
            isArtifactPlugin,
            runConfig.production
        );

        projects.set(pluginName, project);

        // this is a plugin from a repository that is publishing assets.
        // The plugin should be looked up in node_modules and it should not continue to look for its dependencies
        if (isArtifactPlugin) {
            return;
        }

        project.pluginDescriptor.dependencies.forEach((pluginDescriptor) => {
            if (projects.has(pluginDescriptor.name)) {
                return;
            }
            const pluginsRepoName =
                pluginDescriptor.repoName === 'cplace'
                    ? 'main'
                    : pluginDescriptor.repoName;
            if (
                AssetsCompiler.isLocalParentRepo(pluginsRepoName) ||
                pluginsRepoName === project.repo
            ) {
                // the dependency plugin is from a local repository or the repository to be built and should be built from scratch
                const pluginPath = this.findPluginPath(
                    repositoryDir,
                    pluginDescriptor.name,
                    Object.keys(AssetsCompiler.repoDependencies)
                );
                this.addProjectDependenciesRecursively(
                    repositoryDir,
                    projects,
                    pluginDescriptor.repoName,
                    pluginDescriptor.name,
                    pluginPath,
                    false,
                    runConfig
                );
            } else {
                // the dependency plugin is not from a local repository. It should be used as npm artifact from node_modules
                AssetsCompiler.checkIfPluginExistsAsNpmArtifact(
                    repositoryDir,
                    pluginDescriptor
                );

                const pluginPathInNodeModules = path.resolve(
                    repositoryDir,
                    'node_modules',
                    '@cplace-assets',
                    `${pluginDescriptor.repoName}_${pluginDescriptor.name
                        .replaceAll('.', '-')
                        .toLowerCase()}`
                );

                this.addProjectDependenciesRecursively(
                    repositoryDir,
                    projects,
                    pluginDescriptor.repoName,
                    pluginDescriptor.name,
                    pluginPathInNodeModules,
                    true,
                    runConfig
                );
            }
        });
    }

    private static checkIfPluginExistsAsNpmArtifact(
        repositoryDir: string,
        pluginDescriptor: PluginDescriptor
    ): void {
        // validate that the npm package for the repository exists in the node_modules
        const pathToRepoInNodeModules = path.resolve(
            repositoryDir,
            'node_modules',
            '@cplace-assets',
            `${pluginDescriptor.repoName}`
        );
        if (!fs.existsSync(pathToRepoInNodeModules)) {
            throw Error(
                `[${pluginDescriptor.repoName}] npm package for the repository should exist in node_modules, but it's missing. \nMake sure the package.json file is generated in the "build" folder of the repository and then run "npm install".`
            );
        }

        // check in the package.json file of the repo npm package if the plugin is a npm dependency (if the plugin assets wer published)
        const packageJsonPath = path.resolve(
            pathToRepoInNodeModules,
            'package.json'
        );
        const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf8')
        );

        const expectedPluginPackageName = `@cplace-assets/${
            pluginDescriptor.repoName
        }_${pluginDescriptor.name.replaceAll('.', '-').toLowerCase()}`;
        const expectedPathToPluginInNodeModules = path.resolve(
            repositoryDir,
            'node_modules',
            expectedPluginPackageName
        );

        if (
            packageJson.dependencies &&
            packageJson.dependencies[expectedPluginPackageName] &&
            !fs.existsSync(expectedPathToPluginInNodeModules)
        ) {
            throw Error(
                `[${pluginDescriptor.name}] npm package for the plugin should exist in node_modules, but it's missing. \nMake sure the package.json file is generated in the "build" folder of the repository and then run "npm install".`
            );
        }
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

    /**
     * Parse the parent repositories from paren-repos.json file.
     */
    private static async getRepoDependencies(
        repositoryDir: string
    ): Promise<Map<string, ParentRepo>> {
        const parentRepos: Map<string, ParentRepo> =
            AssetsCompiler.parseParentRepos(repositoryDir);

        if (!isArtifactsOnlyBuild()) {
            return parentRepos;
        }

        for (const repoName of Object.keys(parentRepos)) {
            const parentRepo: ParentRepo = parentRepos[repoName];
            // if the repo is on a "publishable" branch and there are artifacts published for it, use it as a remote repo
            if (
                parentRepo.branch.match(/release\/\d+\.\d+/) ||
                parentRepo.branch === 'main' ||
                parentRepo.branch === 'master'
            ) {
                const isRepoPublished =
                    await NPMResolver.isRepositoryAssetsPublished(repoName);
                if (isRepoPublished) {
                    parentRepo.pluginsAreArtifacts = true;
                }
            }
        }

        return parentRepos;
    }

    private static parseParentRepos(
        repositoryDir: string
    ): Map<string, ParentRepo> {
        const parentReposPath = path.join(repositoryDir, 'parent-repos.json');
        let parentRepos: Map<string, ParentRepo> = new Map();
        try {
            if (fs.existsSync(parentReposPath)) {
                const parentReposContent = fs.readFileSync(
                    parentReposPath,
                    'utf8'
                );
                parentRepos = JSON.parse(parentReposContent);
            } else {
                debug(
                    `(AssetsCompiler) could not find parent-repos.json: ${parentReposPath}`
                );
            }
        } catch (err) {
            console.error(
                cerr`Failed to parse parent-repos.json: ${parentReposPath}`
            );
            throw err;
        }
        return parentRepos;
    }

    /**
     * Check if the given parent repository is used as a local repository.
     */
    public static isLocalParentRepo(repoName: string): boolean {
        return (
            AssetsCompiler.repoDependencies[repoName] &&
            AssetsCompiler.repoDependencies[repoName]?.pluginsAreArtifacts !==
                true
        );
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
        if (isArtifactsOnlyBuild() && plugin.isArtifactPlugin) {
            return false;
        }
        return !this.runConfig.noParents || plugin.repo === this.repositoryName;
    }
}
