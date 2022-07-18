/*
 * Copyright 2022, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import { debug, GREEN_CHECK } from '../utils';
import { CplaceVersion } from './CplaceVersion';

export class PackageJsonGenerator {
    protected packageJsonContent: any;
    protected readonly packageJsonFile = 'package.json';

    constructor(
        private readonly plugin: CplacePlugin,
        private readonly repositoryDir: string
    ) {}

    /**
     * Generate package.json file in the assets folder of the plugin.
     */
    public createContentAndGetPath(): string {
        if (!fs.existsSync(this.getPackageJsonPath())) { 
            let devDependencies = this.createDevDependencies();

            this.packageJsonContent = {
                name: `@${this.plugin.pluginDescriptor.group.replace(/\./g, '-')}/${this.plugin.pluginDescriptor.name.replace(/\./g, '-')}`,
                version: CplaceVersion.toString(),
                devDependencies: devDependencies
            };

            this.saveConfig();
            console.log(
                `${GREEN_CHECK} [${this.plugin.pluginName}] created package.json file in assets folder`
            );
        }

        return this.getPackageJsonPath();
    }

    private createDevDependencies() {
        let devDependencies = {};
        // only add plugins from other repositories as npm dependencies,
        // plugins from the current repo should be used directly
        this.plugin.pluginDescriptor.dependencies
            .filter((dependency) => !fs.existsSync(path.resolve(this.repositoryDir, dependency.name)))
            .forEach((dependency) => devDependencies[`@${dependency.group.replace(/\./g, '-')}/${dependency.name.replace(/\./g, '-')}`] = CplaceVersion.toString()
            );
        return devDependencies;
    }

    private getPackageJsonPath(): string {
        return path.join(
            this.plugin.assetsDir,
            this.packageJsonFile
        );
    }

    private saveConfig(): void {
        const content = JSON.stringify(this.packageJsonContent, null, 4);
        fs.writeFileSync(this.getPackageJsonPath(), content, { encoding: 'utf8' });

        debug(
            `(PackageJsonGenerator) [${this.plugin.pluginName}] package.json content:`
        );
        debug(content);
    }
}
