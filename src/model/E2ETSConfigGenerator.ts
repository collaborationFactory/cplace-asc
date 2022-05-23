/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import { AbstractTSConfigGenerator } from './AbstractTSConfigGenerator';
import CplacePlugin from './CplacePlugin';
import { E2ETypescriptCompiler } from '../compiler/E2ETypescriptCompiler';

export class E2ETSConfigGenerator extends AbstractTSConfigGenerator {
    constructor(
        plugin: CplacePlugin,
        dependencies: CplacePlugin[],
        localOnly: boolean,
        isProduction: boolean
    ) {
        super(plugin, dependencies, localOnly, isProduction, 'e2e');
    }

    public createConfigAndGetPath(): string {
        const { paths } = this.getPathsAndRefs();
        this.tsConfig = {
            extends: `${this.pathToMain}/tsconfig.base.e2e.json`,
            compilerOptions: {
                baseUrl: '.',
                outDir: `../${E2ETypescriptCompiler.DEST_DIR}`,
            },
            include: ['./specs/**/*.ts', './lib/**/*.ts'],
        };

        if (this.plugin.pluginName !== this.platformPlugin) {
            paths['*'].push(
                `${this.pathToMain}/node_modules/@types/*`,
                `${this.pathToMain}/node_modules/*`
            );
            this.tsConfig.compilerOptions.paths = paths;
        }

        this.saveConfig();
        return this.getTSConfigPath();
    }
}
