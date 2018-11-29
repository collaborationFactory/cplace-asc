/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as fs from 'fs';
import * as path from 'path';
import CplacePlugin from './CplacePlugin';
import {ExecutorService, Scheduler} from '../executor';
import {cerr, csucc} from '../utils';

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
}

/**
 * This represents the main execution logic for the whole compilation process
 */
export class AssetsCompiler {
    public static readonly CPLACE_REPO_NAME = 'main';
    public static readonly PLATFORM_PLUGIN_NAME = 'cf.cplace.platform';

    /**
     * Indicates whether the compiler is started in a sub-repo (i.e. not `main`)
     */
    private readonly isSubRepo: boolean;

    /**
     * Path the the `cplace` repository (i.e. `main`)
     */
    private readonly mainRepoPath: string;

    /**
     * Map of known plugin names to plugin instance
     */
    private readonly projects = new Map<string, CplacePlugin>();

    /**
     * Executor used to run all compilation steps
     */
    private readonly executor: ExecutorService;

    /**
     * Schedule managing order and necessity of execution
     */
    private readonly scheduler: Scheduler;

    constructor(private readonly runConfig: IAssetsCompilerConfiguration) {
        this.isSubRepo = AssetsCompiler.checkIsSubRepo();
        this.mainRepoPath = AssetsCompiler.getMainRepoPath();
        this.projects = AssetsCompiler.setupProjects(runConfig.rootPlugins, this.mainRepoPath);
        this.executor = new ExecutorService(3);
        this.scheduler = new Scheduler(this.executor, this.projects, runConfig.watchFiles);
    }

    public start(): Promise<void> {
        return this.scheduler.start().then(() => {
            const log = () => {
                console.log();
                console.log(csucc`Assets compiled successfully`);
                console.log();
            };
            this.executor.destroy().then(log, log);
        }, (e) => {
            const log = () => {
                console.log();
                console.error(cerr`COMPILATION FAILED - please check errors in output above`);
                console.log();
            };
            this.executor.destroy().then(log, log);
        });
    }

    private static checkIsSubRepo(): boolean {
        const localPathToPlatform = path.join(process.cwd(), this.PLATFORM_PLUGIN_NAME);
        return fs.statSync(localPathToPlatform).isDirectory();
    }

    private static getMainRepoPath(): string {
        return path.resolve(path.join(process.cwd(), '..', this.CPLACE_REPO_NAME));
    }

    private static setupProjects(rootPlugins: string[], mainRepoPath: string): Map<string, CplacePlugin> {
        const projects = new Map<string, CplacePlugin>();
        // TODO: this does not yet work for sub repos...?
        const files = fs.readdirSync(mainRepoPath);

        files.forEach(file => {
            const filePath = path.join(mainRepoPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                const potentialPluginName = path.basename(file);
                if ((rootPlugins.length === 0 || rootPlugins.indexOf(potentialPluginName) !== -1)
                    && fs.existsSync(path.join(filePath, `${potentialPluginName}.iml`))) {
                    this.addProjectDependenciesRecursively(projects, mainRepoPath, potentialPluginName, filePath);
                }
            }
        });

        projects.forEach(project => {
            if (project.hasTypeScriptAssets) {
                project.generateTsConfigAndGetTsProject(p => projects.get(p));
            }
        });

        this.setDependents(projects);
        return projects;
    }

    private static addProjectDependenciesRecursively(projects: Map<string, CplacePlugin>, mainRepoPath: string, pluginName: string, pluginPath: string) {
        if (projects.has(pluginName)) {
            return;
        }

        const project = new CplacePlugin(pluginName, pluginPath, mainRepoPath);
        projects.set(pluginName, project);

        project.dependencies.forEach(depName => {
            if (!projects.has(depName)) {
                this.addProjectDependenciesRecursively(projects, mainRepoPath, depName, path.join(mainRepoPath, depName));
            }
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
}
