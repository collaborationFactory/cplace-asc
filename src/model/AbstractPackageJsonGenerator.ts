/*
 * Copyright 2022, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import { PackageJson } from 'type-fest';
import { debug, GREEN_CHECK } from '../utils';
import { CplaceVersion } from './CplaceVersion';

export interface IPackageJsonDependency {
    group: string;

    name: string;
}

export abstract class AbstractPackageJsonGenerator {
    protected packageJsonContent: any;
    protected readonly packageJsonFile = 'package.json';

    constructor(readonly repositoryDir: string) {}

    /**
     * Generate package.json file.
     */
    public generatePackageJson(): string {
        const filePath = this.getFilePath();

        if (!fs.existsSync(filePath)) {
            const pluginDependencies: IPackageJsonDependency[] =
                this.getPluginDependencies();
            const devDependencies =
                this.createDevDependencies(pluginDependencies);

            let packageJson: PackageJson = {};
            packageJson.name = this.getPackageName();
            packageJson.version = this.getVersion();
            packageJson.devDependencies = devDependencies;
            this.packageJsonContent = packageJson;
        } else {
            // update package name and version
            console.log(
                `⟲ Updating version and name in package.json ${filePath}`
            );
            const content = fs.readFileSync(filePath, {
                encoding: 'utf8',
            });
            this.packageJsonContent = JSON.parse(content);
            this.packageJsonContent.name = this.getPackageName();
            this.packageJsonContent.version = this.getVersion();
        }

        this.saveConfig(this.packageJsonContent, filePath);
        console.log(`${GREEN_CHECK} updated package.json file in ${filePath}`);

        return filePath;
    }

    public abstract getFilePath();

    public abstract getPackageName();

    public abstract getPluginDependencies(): IPackageJsonDependency[];

    private getVersion(): string {
        return CplaceVersion.toString().toLowerCase();
    }

    private createDevDependencies(
        pluginDependencies: IPackageJsonDependency[]
    ) {
        let devDependencies = {};
        // only add plugins from other repositories as npm dependencies,
        // plugins from the current repo should be used directly
        pluginDependencies
            .filter(
                (dependency) =>
                    !fs.existsSync(
                        path.resolve(this.repositoryDir, dependency.name)
                    )
            )
            .forEach(
                (dependency) =>
                    (devDependencies[
                        `@${dependency.group.replace(
                            /\./g,
                            '-'
                        )}/${dependency.name.replace(/\./g, '-')}`
                    ] = this.getVersion())
            );
        return devDependencies;
    }

    private saveConfig(jsonObject, filePath: string): void {
        const stringContent = JSON.stringify(jsonObject, null, 2);
        fs.writeFileSync(filePath, stringContent, { encoding: 'utf8' });

        debug(
            `(AbstractPackageJsonGenerator) [${filePath}] package.json content:`
        );
        debug(stringContent);
    }
}
