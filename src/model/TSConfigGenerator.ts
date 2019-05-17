/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {debug} from '../utils';
import {ConfigGenerator} from "../compiler/interfaces";


export abstract class TSConfigGenerator {
    protected tsConfig: any;
    protected readonly pathToMain: string;
    protected readonly relPathToPlatform: string;
    protected readonly relPathToPlatformTs: string;

    constructor(protected readonly plugin: CplacePlugin,
                protected readonly dependencies: CplacePlugin[],
                protected readonly localOnly: boolean,
                protected readonly isProduction: boolean,
                srcFolderName: string) {
        this.pathToMain = TSConfigGenerator.pathToMain(this.localOnly, this.plugin.repo);
        this.relPathToPlatform = path.join(ConfigGenerator.REL_REPO_ROOT_PREFIX, CplacePlugin.getPluginPathRelativeToRepo(this.plugin.repo, ConfigGenerator.PLATFORM_PLUGIN, 'main', this.localOnly));
        this.relPathToPlatformTs = path.join(this.relPathToPlatform, 'assets', srcFolderName);
    }

    public static pathToMain(localOnly: boolean, repo: string): string {
        return path.join(ConfigGenerator.REL_REPO_ROOT_PREFIX,
            !localOnly && repo !== 'main' ? path.join('..', 'main') : ''
        );
    }

    public abstract createConfigAndGetPath(): string;

    public abstract getTSConfigPath(): string;

    protected saveConfig(): void {
        const content = JSON.stringify(this.tsConfig, null, 4);
        fs.writeFileSync(
            this.getTSConfigPath(),
            content,
            {encoding: 'utf8'}
        );

        debug(`(TsConfigGenerator) [${this.plugin.pluginName}] TS Config content:`);
        debug(content);
    }

    protected static getPathDependency(dependency: string, path: string): { [dependencyKey: string]: string[] } {
        const dependencyObject: { [dependencyKey: string]: string[] } = {};
        dependencyObject[`@${dependency}/*`] = [path + '/*'];
        return dependencyObject;
    }

}
