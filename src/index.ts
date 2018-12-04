#!/usr/bin/env node
/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {getAvailableStats} from './model/utils';
import {AssetsCompiler, IAssetsCompilerConfiguration} from './model/AssetsCompiler';
import {cerr, debug, enableDebug} from './utils';
import meow = require('meow');


checkNodeVersion();


const cli = meow(`
    Usage:
        $ cplace-asc

    Options:
        --plugin, -p <plugin>   Run for specified plugin (and dependencies)
        --watch, -w             Enable watching of source files (continuous compilation)
        --onlypre, -o           Run only preprocessing steps (like create tsconfig.json files)
        --verbose, -v           Enable verbose logging
`, {
    flags: {
        plugin: {
            type: 'string',
            alias: 'p',
            default: null
        },
        watch: {
            type: 'boolean',
            alias: 'w',
            default: false
        },
        onlypre: {
            type: 'boolean',
            alias: 'o',
            default: false
        },
        verbose: {
            type: 'boolean',
            alias: 'v',
            default: false
        }
    }
});

if (cli.flags.plugin !== null && !cli.flags.plugin) {
    console.error(cerr`Missing value for --plugin|-p argument`);
    process.exit(1);
}
if (cli.flags.watch && cli.flags.onlypre) {
    console.error(cerr`--watch and --onlypre cannot be enabled simultaneously`);
    process.exit(1);
}

if (cli.flags.verbose) {
    enableDebug();
    debug('Debugging enabled...');
}

const config: IAssetsCompilerConfiguration = {
    rootPlugins: cli.flags.plugin ? [cli.flags.plugin] : [],
    watchFiles: cli.flags.watch,
    onlyPreprocessing: cli.flags.onlypre
};

console.log(getAvailableStats());
new AssetsCompiler(config).start().then(() => {
    // success
}, () => {
    // failed
});

// new AssetsCompiler(config).start();


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
