/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as fs from 'fs';
import * as path from 'path';
import { IRunConfig } from '../types';
import Project from './Project';
import { StringMap } from './StringMap';
import { getAvailableStats } from './utils';
import { ExecutorService } from './ExecutorService';
import { Scheduler } from './Scheduler';
import { StringSet } from './StringSet';
import { TsConfigGenerator } from './TsConfigGenerator';


export default class AssetsCompiler {
    isSubRepo: boolean;
    mainRepoPath: string;
    projects = new StringMap<Project>();
    projectGroups: Array<Array<string>>;
    private executor: ExecutorService;

    constructor(private readonly runConfig: IRunConfig) {
        console.log(getAvailableStats());
        this.isSubRepo = false;
        this.mainRepoPath = AssetsCompiler.getMainRepoPath();
        this.projects = AssetsCompiler.setupProjects(runConfig.plugins, this.mainRepoPath);
        this.projectGroups = this.groupProjects();
        this.executor = new ExecutorService(3);
    }

    start() {
        const groups: Array<Array<string>> = JSON.parse(JSON.stringify(this.projectGroups));
        let finished = new Scheduler(this.executor, this.projects, groups).start();

        finished.then(() => {
            console.log('all done');
            this.executor.destroy();
        });

        console.log(getAvailableStats());
    }

    getCompileTaskForPlugins(plugins: string[]) {

    }

    getCompileTaskForAllPlugins() {
        console.log(this.projectGroups);
        this.projectGroups.forEach((group) => {
            console.log(group);
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

    static setupProjects(plugins: string[], repoPath: string): StringMap<Project> {
        const projects = new StringMap<Project>();
        let files = fs.readdirSync(repoPath);

        if (plugins.length) {
            files = files.filter((file) => {
                return plugins.indexOf(file) > -1;
            });
        }

        function addProjectsRecursively(pluginName: string, filePath: string) {
            if (projects.has(pluginName)) {
                return;
            }
            // @todo: define option not to generate tsconfig each time (or to do it) and check existence
            const tsConfigGenerator = new TsConfigGenerator(
                pluginName,
                AssetsCompiler.getMainRepoPath(),
                false // @todo: this needs to be fixed
            );
            const tsConfigObj = tsConfigGenerator.getConfigAndSave();
            const project = new Project(pluginName, filePath);
            projects.set(pluginName, project);

            if (project.tsProject.projectReferences) {
                project.tsProject.projectReferences.forEach((ref) => {
                    let refPath = ref.path;
                    if (refPath.indexOf(repoPath) > -1) {
                        const depName = refPath.substring(repoPath.length + 1, refPath.indexOf('/', repoPath.length + 1));
                        if (!projects.has(depName)) {
                            addProjectsRecursively(depName, path.join(repoPath, depName));
                        }
                    }
                });
            }
        }

        files.forEach(file => {
            const filePath = path.join(repoPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                const potentialPluginName = path.basename(file);
                if (fs.existsSync(path.join(filePath, `${potentialPluginName}.iml`)) && fs.existsSync(path.join(filePath, 'assets', 'ts', 'tsconfig.json'))) {
                    addProjectsRecursively(potentialPluginName, filePath);
                }
            }
        });

        AssetsCompiler.setDependentsAndGroup(projects);
        return projects;
    }

    static setDependentsAndGroup(projects: StringMap<Project>) {
        let pluginNames = AssetsCompiler.topologicalSort(projects);

        pluginNames.forEach((p) => {
            let project = <Project>projects.get(p);
            project.dependencies.forEach((dep) => {
                const depProject = projects.get(dep);
                if (depProject) {
                    project.group = Math.max(depProject.group + 1, project.group);
                    depProject.dependents.push(p);
                }
            });
        });
    }

    static topologicalSort(projects: StringMap<Project>): string[] {
        const sorted: string[] = [];
        const visited = new StringSet();
        const pluginNames = projects.keys();

        function visit(pluginName: string) {
            visited.add(pluginName);
            const project = projects.get(pluginName) as Project;
            project.dependencies.forEach((dep) => {
                if (!visited.has(dep)) {
                    visit(dep);
                }
            });
            sorted.push(pluginName);
        }

        for (let i = 0; i < pluginNames.length; i++) {
            if (!visited.has(pluginNames[i])) {
                visit(pluginNames[i]);
            }
        }

        return sorted;
    }

}
