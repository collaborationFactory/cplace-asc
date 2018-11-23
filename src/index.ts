#!/usr/bin/env node
/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {IRunConfig} from './types';
import AssetsCompiler from './lib/AssetsCompiler';
import {getAvailableStats} from './lib/utils';

function checkNodeVersion(): void {
    let major = Number.MAX_VALUE;
    try {
        const parts = process.version.split('.');
        major = Number(parts[0].replace(/\D/, ''));
    } catch {
        console.log('Failed to check node version, assuming correct version...');
    }
    if (major < 8) {
        console.error('ERROR: Requires node version 8.x (LTS)...');
        process.exit(1);
    }
}

(() => {
    checkNodeVersion();
    console.log(getAvailableStats());

    const config: IRunConfig = {
        plugins: []
    };
    // let parser = yargs.usage('\nUsage: $0 [options]')
    //     .command('', 'Compiler and bundler for Typescript and Less used in cplace.')
    //     .options(cliOptions)
    //     .demand(0);

    // const opts = parser.argv;
    //
    // console.log('opts');
    // console.log(opts);
    // if(opts.help) {
    //     parser.showHelp();
    //     process.exit(0);
    // }

    config.plugins = ['cf.cplace.training.extended'];
    // config.plugins = ['cf.cplace.pptexport'];

    new AssetsCompiler(config).start();

    // new AssetsCompiler(config).start();
})();
