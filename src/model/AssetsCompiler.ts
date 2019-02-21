/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as fs from 'fs';
import * as path from 'path';
import CplacePlugin from './CplacePlugin';
import {ExecutorService, Scheduler} from '../executor';
import {cerr, cgreen, csucc, debug, formatDuration} from '../utils';

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
}

/**
 * This represents the main execution logic for the whole compilation process
 */
export class AssetsCompiler {
    public static readonly CPLACE_REPO_NAME = 'main';
    public static readonly PLATFORM_PLUGIN_NAME = 'cf.cplace.platform';

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

    constructor(private readonly runConfig: IAssetsCompilerConfiguration) {
        this.projects = this.setupProjects();
    }

    public async start(): Promise<void> {
        if (!this.projects.size) {
            console.log(cgreen`->`, 'Nothing to do, no plugins detected...');
            return new Promise<void>(resolve => resolve());
        }

        const mainRepoPath = this.getMainRepoPath();
        if (mainRepoPath === null) {
            debug(`(AssetsCompiler) Main repo cannot be found...`);
            return new Promise<void>((resolve, reject) => reject(
                'Main repo cannot be found...'
            ));
        }

        const start = new Date().getTime();
        if (this.runConfig.clean) {
            debug(`(AssetsCompiler) running clean for all plugins...`);
            for (const plugin of this.projects.values()) {
                await plugin.cleanGeneratedOutput();
            }
        }

        if (this.runConfig.onlyPreprocessing) {
            console.log();
            console.log(csucc`Preprocessing completed successfully`);
            console.log();
            return new Promise<void>(resolve => resolve());
        }

        this.executor = new ExecutorService(this.runConfig.maxParallelism);
        this.scheduler = new Scheduler(
            this.executor, this.projects, mainRepoPath,
            this.runConfig.production, this.runConfig.watchFiles
        );

        debug(`(AssetsCompiler) starting scheduler for compilation tasks...`);
        return this.scheduler
            .start()
            .then(() => {
                const end = new Date().getTime();
                const successLog = () => {
                    console.log();
                    console.log(csucc`Assets compiled successfully (${formatDuration(end - start)})`);
                    console.log();
                };

                if (!!this.executor) {
                    this.executor.destroy().then(successLog, successLog);
                }
            }, (e) => {
                debug(`(AssetsCompiler) Error while running assets compiler: ${e}`);
                const errorLog = () => {
                    console.log();
                    console.error(cerr`COMPILATION FAILED - please check errors in output above`);
                    console.log();
                };

                if (!!this.executor) {
                    this.executor.destroy().then(errorLog, errorLog);
                }
                throw e;
            });
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

    private setupProjects(): Map<string, CplacePlugin> {
        let knownRepoDependencies: string[];
        if (this.runConfig.localOnly) {
            knownRepoDependencies = [];
            debug(`(AssetsCompiler) Ignoring repo dependencies since localOnly execution...`);
        } else {
            knownRepoDependencies = AssetsCompiler.getRepoDependencies();
            debug(`(AssetsCompiler) Detected repo dependencies: ${knownRepoDependencies.join(', ')}`);
        }

        const projects = new Map<string, CplacePlugin>();
        const files = fs.readdirSync(process.cwd());

        files.forEach(file => {
            const filePath = path.join(process.cwd(), file);
            if (fs.lstatSync(filePath).isDirectory()) {
                const potentialPluginName = path.basename(file);
                if ((this.runConfig.rootPlugins.length === 0 || this.runConfig.rootPlugins.indexOf(potentialPluginName) !== -1)
                    && AssetsCompiler.directoryLooksLikePlugin(filePath, potentialPluginName)) {
                    AssetsCompiler.addProjectDependenciesRecursively(
                        projects, knownRepoDependencies,
                        potentialPluginName, filePath,
                        this.runConfig.production);
                }
            }
        });

        projects.forEach(project => {
            if (project.hasTypeScriptAssets) {
                project.generateTsConfig(p => projects.get(p), this.runConfig.production, this.runConfig.localOnly);
            }
        });

        AssetsCompiler.setDependents(projects);
        return projects;
    }

    private getMainRepoPath(): string | null {
        let mainRepoPath = '';
        if (this.runConfig.localOnly) {
            mainRepoPath = path.resolve(process.cwd());
        } else {
            mainRepoPath = path.resolve(path.join(process.cwd(), '..', AssetsCompiler.CPLACE_REPO_NAME));
        }

        if (!fs.existsSync(mainRepoPath)
            || !fs.existsSync(path.join(mainRepoPath, AssetsCompiler.PLATFORM_PLUGIN_NAME))) {
            return null;
        }

        return mainRepoPath;
    }

    private static directoryLooksLikePlugin(pluginPath: string, potentialPluginName: string): boolean {
        return fs.existsSync(path.join(pluginPath, `${potentialPluginName}.iml`)) // IML file
            && fs.existsSync(path.join(pluginPath, 'src')); // path to src directory - release-notes will be excluded
    }

    private static addProjectDependenciesRecursively(projects: Map<string, CplacePlugin>,
                                                     repoDependencies: string[],
                                                     pluginName: string,
                                                     pluginPath: string,
                                                     excludeTestDependencies: boolean) {
        if (projects.has(pluginName)) {
            return;
        }

        const project = new CplacePlugin(pluginName, pluginPath);
        project.parseDependencies(excludeTestDependencies);
        projects.set(pluginName, project);

        project.dependencies.forEach(depName => {
            if (projects.has(depName)) {
                return;
            }
            const pluginPath = this.findPluginPath(depName, repoDependencies);
            this.addProjectDependenciesRecursively(projects, repoDependencies, depName, pluginPath, excludeTestDependencies);
        });
    }

    private static setDependents(projects: Map<string, CplacePlugin>) {
        for (const plugin of projects.values()) {
            plugin.dependencies
                .map(dep => projects.get(dep))
                .forEach(p => {
                    if (!!p) {
                        p.dependents.push(plugin.pluginName)
                    }
                });
        }
    }

    private static getRepoDependencies(): string[] {
        if (path.basename(process.cwd()) === 'main') {
            return [];
        }

        const parentReposPath = path.join(process.cwd(), 'parent-repos.json');
        if (!fs.existsSync(parentReposPath)) {
            debug(`(AssetsCompiler) could not find parent-repos.json: ${parentReposPath}`);
            return [];
        }
        const parentReposContent = fs.readFileSync(parentReposPath, 'utf8');
        try {
            const parentRepos = JSON.parse(parentReposContent);
            return Object.keys(parentRepos);
        } catch (err) {
            console.error(cerr`Failed to parse parent-repos.json: ${parentReposPath}`);
            throw err;
        }
    }

    private static findPluginPath(pluginName: string, repoDependencies: string[]): string {
        let relativePath = pluginName;
        if (fs.existsSync(relativePath)) {
            return relativePath;
        }
        for (const repoName of repoDependencies) {
            relativePath = path.join('..', repoName, pluginName);
            if (fs.existsSync(relativePath)) {
                return relativePath;
            }
        }
        console.error(cerr`Could not locate plugin ${pluginName}`);
        throw Error(`Could not locate plugin ${pluginName}`);
    }
}
