import * as path from 'path';
import {
    AbstractPackageJsonGenerator,
    IPackageJsonDependency,
} from './AbstractPackageJsonGenerator';
import CplacePlugin from './CplacePlugin';

export class PluginPackageJsonGenerator extends AbstractPackageJsonGenerator {
    constructor(private plugin: CplacePlugin, repositoryDir: string) {
        super(repositoryDir);
    }

    public getFilePath() {
        return path.join(this.plugin.assetsDir, this.packageJsonFile);
    }

    public getPackageName() {
        return `@${this.plugin.pluginDescriptor.group.replace(
            /\./g,
            '-'
        )}/${this.plugin.pluginDescriptor.name.replace(
            /\./g,
            '-'
        )}`.toLowerCase();
    }

    /**
     * Plugins don't list their rependencies in the assets/package.json
     * since that would create duplications of the same dependency in many plugins
     * (cf.cplace.platform would appear in all plugins).
     *
     * The dependencies are listed in the root package.json
     */
    public getPluginDependencies(): IPackageJsonDependency[] {
        return [];
    }
}
