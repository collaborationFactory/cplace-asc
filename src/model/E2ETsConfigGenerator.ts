/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import {ConfigGenerator} from "../compiler/interfaces";
import {TSConfigGenerator} from "./TSConfigGenerator";
import CplacePlugin from './CplacePlugin';

export class E2ETsConfigGenerator extends TSConfigGenerator {

    constructor(plugin: CplacePlugin,
                dependencies: CplacePlugin[],
                localOnly: boolean,
                isProduction: boolean) {
        super(plugin, dependencies, localOnly, isProduction, 'e2e');
    }

    public createConfigAndGetPath(): string {
        this.tsConfig = {
            extends: `${this.pathToMain}/tsconfig.base.e2e.json`,
            compilerOptions: {
                target: 'es5',
                module: 'commonjs',
                baseUrl: '.',
                outDir: '../generated_e2e',
                esModuleInterop: true
            },
            include: [
                './specs/**/*.ts',
                "./lib/**/*.ts"
            ]
        };

        if (this.plugin.pluginName === ConfigGenerator.PLATFORM_PLUGIN) {
            this.tsConfig.compilerOptions.outDir = '../generated_e2e/cf.cplace.platform/assets/e2e';
            delete this.tsConfig.compilerOptions.paths
        }
        this.createFolder2TSConfig();
        this.saveConfig();
        return this.getTSConfigPath();
    }

    public getTSConfigPath(): string {
        return path.join(this.plugin.assetsDir, 'e2e', 'tsconfig.json');
    }


    private createFolder2TSConfig(): void {
        if (!fs.existsSync(require('path').dirname(this.getTSConfigPath()))) {
            fs.mkdirSync(require('path').dirname(this.getTSConfigPath()))
        }
    }


}
