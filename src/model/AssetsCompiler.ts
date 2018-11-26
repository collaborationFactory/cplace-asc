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
    private readonly isSubRepo: boolean;
    private readonly mainRepoPath: string;
    private readonly projects = new Map<string, CplacePlugin>();
    private readonly projectGroups: Array<Array<string>>;
    private readonly executor: ExecutorService;

    constructor(private readonly runConfig: IRunConfig) {
        this.isSubRepo = false;
        this.mainRepoPath = AssetsCompiler.getMainRepoPath();
        this.projects = AssetsCompiler.setupProjects(runConfig.plugins, this.mainRepoPath);
        this.projectGroups = this.groupProjects();
        this.executor = new ExecutorService(3);
    }

    public start(): void {
        const groups: string[][] = this.projectGroups.map(it => [...it]);
        const scheduler = new Scheduler(this.executor, this.projects, groups);
        scheduler.start().then(() => {
            console.log();
            console.log(csucc`Assets compiled successfully`);
            console.log();
            this.executor.destroy();
        }, (e) => {
            console.log();
            console.error(cerr`COMPILATION FAILED - please check errors in output above`);
            console.log();
            this.executor.destroy();
        });
    }

    static getMainRepoPath() {
        const cwd = process.cwd();
        let split = cwd.split(path.sep);
        let idx = split.indexOf('main');
        split.splice(idx + 1, split.length - idx);
        // @ts-ignore
        let mainPath = path.join(...split);
        if (path.sep === '/') {
            mainPath = path.sep + mainPath;
        }
        return mainPath;
    }

    static setupProjects(plugins: string[], mainRepoPath: string): Map<string, CplacePlugin> {
        const projects = new Map<string, CplacePlugin>();
        // TODO: this does not yet work for sub repos...?
        let files = fs.readdirSync(mainRepoPath);

        if (plugins.length) {
            files = files.filter((file) => {
                return plugins.indexOf(file) > -1;
            });
        }

        function addProjectsRecursively(pluginName: string, filePath: string) {
            if (projects.has(pluginName)) {
                return;
            }

            const project = new CplacePlugin(pluginName, filePath, mainRepoPath);
            projects.set(pluginName, project);

            project.dependencies.forEach(depName => {
                if (!projects.has(depName)) {
                    addProjectsRecursively(depName, path.join(mainRepoPath, depName));
                }
            });
        }

        files.forEach(file => {
            const filePath = path.join(mainRepoPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                const potentialPluginName = path.basename(file);
                if (fs.existsSync(path.join(filePath, `${potentialPluginName}.iml`)) && fs.existsSync(path.join(filePath, 'assets', 'ts', 'tsconfig.json'))) {
                    addProjectsRecursively(potentialPluginName, filePath);
                }
            }
        });

        projects.forEach(project => {
            if (project.hasTypeScriptAssets) {
                project.generateTsConfigAndGetTsProject(p => projects.get(p));
            }
        });

        AssetsCompiler.setDependentsAndGroup(projects);
        return projects;
    }

    static setDependentsAndGroup(projects: Map<string, CplacePlugin>) {
        let pluginNames = AssetsCompiler.topologicalSort(projects);

        pluginNames.forEach((p) => {
            let project = <CplacePlugin>projects.get(p);
            project.dependencies.forEach((dep) => {
                const depProject = projects.get(dep);
                if (depProject) {
                    project.group = Math.max(depProject.group + 1, project.group);
                    depProject.dependents.push(p);
                }
            });
        });
    }

    static topologicalSort(projects: Map<string, CplacePlugin>): string[] {
        const sorted: string[] = [];
        const visited = new Set<string>();

        function visit(pluginName: string) {
            visited.add(pluginName);
            const project = projects.get(pluginName) as CplacePlugin;
            project.dependencies.forEach((dep) => {
                if (!visited.has(dep)) {
                    visit(dep);
                }
            });
            sorted.push(pluginName);
        }

        projects.forEach((plugin, pluginName) => {
            if (!visited.has(pluginName)) {
                visit(pluginName);
            }
        });

        return sorted;
    }

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

    private groupProjects() {
        let groups: Array<Array<string>> = [];


        this.projects.forEach((project) => {
            let group = groups[project.group];
            if (Array.isArray(group)) {
                group.push(project.pluginName);
            } else {
                groups[project.group] = [project.pluginName];
            }
        });
        return groups;
    }

}
