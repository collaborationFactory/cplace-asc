import * as path from 'path';
import {
    AbstractPackageJsonGenerator,
    IPackageJsonDependency,
} from './AbstractPackageJsonGenerator';
import CplacePlugin from './CplacePlugin';

export class RootPackageJsonGenerator extends AbstractPackageJsonGenerator {
    constructor(
        repositoryDir: string,
        private repositoryName: string,
        private projects: Map<string, CplacePlugin>
    ) {
        super(repositoryDir);
    }

    public getFilePath() {
        return path.join(this.repositoryDir, this.packageJsonFile);
    }

    public getPackageName() {
        return this.repositoryName;
    }

    /**
     * Go through all plugins from this repository and
     * collect all plugins that are dependencies to them.
     *
     * The dependency plugins are added to the root package.json instead the package.json of each plugin.
     * That way there won't be duplications of the same dependency in several plugins.
     */
    public getPluginDependencies(): IPackageJsonDependency[] {
        const pluginDependencies: IPackageJsonDependency[] = [];

        this.projects.forEach((value: CplacePlugin, key: string) => {
            // only go through plugins from current repo
            if (value.pluginDescriptor.repoName == this.repositoryName) {
                value.pluginDescriptor.dependencies.forEach((dependency) => {
                    pluginDependencies.push(dependency);
                });
            }
        });

        return pluginDependencies;
    }
}
