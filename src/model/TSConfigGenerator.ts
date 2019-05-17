/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {debug} from '../utils';
import {ConfigGenerator, ITSConfigGenerator} from "../compiler/interfaces";
import {TsConfigGenerator_Cplace} from "./TsConfigGenerator_Cplace";


export class TSConfigGenerator implements ITSConfigGenerator {
    protected tsConfig: any;
    protected pathToMain: string;
    protected relPathToPlatform: string;
    protected relPathToPlatformTs: string;
    protected dependencyTs: string;


    constructor(protected readonly plugin: CplacePlugin,
                protected readonly dependencies: CplacePlugin[],
                protected readonly localOnly: boolean,
                protected readonly isProduction: boolean) {
        this.pathToMain = TSConfigGenerator.pathToMain(this.localOnly, this.plugin.repo);
        this.relPathToPlatform = path.join(ConfigGenerator.REL_REPO_ROOT_PREFIX, CplacePlugin.getPluginPathRelativeToRepo(this.plugin.repo, ConfigGenerator.PLATFORM_PLUGIN, 'main', this.localOnly));
        if (this instanceof TsConfigGenerator_Cplace) {
            this.relPathToPlatformTs = path.join(this.relPathToPlatform, 'assets', 'ts');
            this.dependencyTs = ConfigGenerator.PLATFORM_PLUGIN
        } else {
            this.relPathToPlatformTs = path.join(this.relPathToPlatform, 'assets', 'e2e');
            this.dependencyTs = ConfigGenerator.PLATFORM_PLUGIN_E2E
        }
    }

    public static pathToMain(localOnly: boolean, repo: string): string {
        return path.join(ConfigGenerator.REL_REPO_ROOT_PREFIX,
            !localOnly && repo !== 'main' ? path.join('..', 'main') : ''
        );
    }

    createConfigAndGetPath(): string {
        return "";
    }

    getTSConfigPath(): string {
        return "";
    }

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
