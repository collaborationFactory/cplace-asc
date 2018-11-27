/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as fs from 'fs';
import * as path from 'path';
import {IRunConfig} from '../types';
import CplacePlugin from './CplacePlugin';
import {ExecutorService, Scheduler} from '../executor';
import {cerr, csucc} from '../utils';

/**
 * This represents the main execution logic for the whole compilation process
 */
export default class AssetsCompiler {
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

    constructor(private readonly runConfig: IRunConfig) {
        this.isSubRepo = AssetsCompiler.checkIsSubRepo();
        this.mainRepoPath = AssetsCompiler.getMainRepoPath();
        this.projects = AssetsCompiler.setupProjects(runConfig.plugins, this.mainRepoPath);

        this.executor = new ExecutorService(3);
    }

    public start(): Promise<void> {
        const scheduler = new Scheduler(this.executor, this.projects);

        return scheduler.start().then(() => {
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

    private static setupProjects(plugins: string[], mainRepoPath: string): Map<string, CplacePlugin> {
        const projects = new Map<string, CplacePlugin>();
        // TODO: this does not yet work for sub repos...?
        const files = fs.readdirSync(mainRepoPath);

        // if (plugins.length) {
        //     files = files.filter((file) => {
        //         return plugins.indexOf(file) > -1;
        //     });
        // }

        files.forEach(file => {
            const filePath = path.join(mainRepoPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                const potentialPluginName = path.basename(file);
                if (fs.existsSync(path.join(filePath, `${potentialPluginName}.iml`))) {
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

    // static topologicalSort(projects: Map<string, CplacePlugin>): string[] {
    //     const sorted: string[] = [];
    //     const visited = new Set<string>();
    //
    //     function visit(pluginName: string) {
    //         visited.add(pluginName);
    //         const project = projects.get(pluginName) as CplacePlugin;
    //         project.dependencies.forEach((dep) => {
    //             if (!visited.has(dep)) {
    //                 visit(dep);
    //             }
    //         });
    //         sorted.push(pluginName);
    //     }
    //
    //     projects.forEach((plugin, pluginName) => {
    //         if (!visited.has(pluginName)) {
    //             visit(pluginName);
    //         }
    //     });
    //
    //     return sorted;
    // }

    // getCompileTaskForPlugins(plugins: string[]) {
    //
    // }
    //
    // getCompileTaskForAllPlugins() {
    //     console.log(this.projectGroups);
    //     this.projectGroups.forEach((group) => {
    //         console.log(group);
    //     });
    // }

    // private groupProjects() {
    //     let groups: Array<Array<string>> = [];
    //
    //
    //     this.projects.forEach((project) => {
    //         let group = groups[project.group];
    //         if (Array.isArray(group)) {
    //             group.push(project.pluginName);
    //         } else {
    //             groups[project.group] = [project.pluginName];
    //         }
    //     });
    //     return groups;
    // }

}
