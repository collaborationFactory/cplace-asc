/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin from './CplacePlugin';
import {ITSConfigGenerator} from "../compiler/interfaces";
import {TsConfigGenerator} from "./TsConfigGenerator";
import {debug} from "../utils";

export class TsConfigGenerator_E2E implements ITSConfigGenerator {
    private tsConfig: any;

    constructor(private readonly plugin: CplacePlugin,
                private readonly localOnly: boolean) {

    }

    public createConfigAndGetPath(): string {
        const relRepoRootPrefix = `../../..`;
        const pathToMain = path.join(relRepoRootPrefix,
            !this.localOnly && this.plugin.repo !== 'main' ? path.join('..', 'main') : ''
        );

        this.tsConfig = {
            extends: `${pathToMain}/tsconfig.base.e2e.json`,
            compilerOptions: {
                target: 'es5',
                module: 'commonjs',
                outDir: "../generated_e2e",
                esModuleInterop: true
            },
            include: [
                "./specs/**/*.ts"
            ]
        };

        if (this.plugin.pluginName === TsConfigGenerator.PLATFORM_PLUGIN) {
            this.tsConfig.compilerOptions.outDir = '../generated_e2e/cf.cplace.platform/assets/e2e';
        }

        this.saveConfig();
        return this.getConfigPath();
    }

    public getConfigPath(): string {
        return path.join(this.plugin.assetsDir, 'e2e', 'tsconfig.json');
    }

    private saveConfig(): void {
        if (!fs.existsSync(require('path').dirname(this.getConfigPath()))) {
            fs.mkdirSync(require('path').dirname(this.getConfigPath()))
        }


        /* this is done sync for now, 'cause when a error occurs later in the execution
           and is not caught, it will fail the file generation
         */
        const content = JSON.stringify(this.tsConfig, null, 4);


        fs.writeFileSync(
            this.getConfigPath(),
            content,
            {encoding: 'utf8'}
        );

        debug(`(TsConfigGenerator) [${this.plugin.pluginName}] TS Config content:`);
        debug(content);
    }


}
