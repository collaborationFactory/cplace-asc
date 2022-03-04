/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {AbstractTypescriptCompiler} from './AbstractTypescriptCompiler';

export class E2ETypescriptCompiler extends AbstractTypescriptCompiler {
    public static readonly DEST_DIR = 'generated_e2e';

    constructor(pluginName: string,
                dependencyPaths: string[],
                assetsPath: string,
                mainRepoDir: string,
                isProduction: boolean,
                esTargetVersion: string) {
        super(pluginName, dependencyPaths, assetsPath, mainRepoDir, false,  esTargetVersion,'e2e', E2ETypescriptCompiler.DEST_DIR);
    }

    protected getJobName(): string {
        return 'E2E TypeScript';
    }

}
