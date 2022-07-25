import * as path from 'path';
import { AbstractPackageJsonGenerator, IPackageJsonDependency } from "./AbstractPackageJsonGenerator";
import CplacePlugin from './CplacePlugin';

export class RootPackageJsonGenerator extends AbstractPackageJsonGenerator {

    constructor(
        repositoryDir: string,
        private repositoryName: string,
        private projects: Map<string, CplacePlugin>
    ) {
        super(repositoryDir)
    }

    public getFilePath() {
        return path.join(
            this.repositoryDir,
            this.packageJsonFile
        );
    }

    public getPackageName() {
        return this.repositoryName;
    }

    public getPluginDependencies(): IPackageJsonDependency[] {
        const pluginDependencies: IPackageJsonDependency[] = [];

        this.projects.forEach((value: CplacePlugin, key: string) => {
            // only gpo through plugins from current repo
            if (value.pluginDescriptor.repoName == this.repositoryName) {
                value.pluginDescriptor.dependencies.forEach((dependency) => {
                    pluginDependencies.push(dependency);
                })
            }
        })

        return pluginDependencies;
    }
    
}