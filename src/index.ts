#!/usr/bin/env node
/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {getAvailableStats} from './model/utils';
import {AssetsCompiler, IAssetsCompilerConfiguration} from './model/AssetsCompiler';
import {cerr, debug, enableDebug} from './utils';
import * as os from 'os';
import meow = require('meow');


checkNodeVersion();


const cli = meow(`
    Usage:
        $ cplace-asc

    Options:
        --plugin, -p <plugin>   Run for specified plugin (and dependencies)
        --watch, -w             Enable watching of source files (continuous compilation)
        --onlypre, -o           Run only preprocessing steps (like create tsconfig.json files)
        --clean, -c             Clean generated output folders at the beginning
        --threads, -t           Maximum number of threads to run in parallel
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
        clean: {
            type: 'boolean',
            alias: 'c',
            default: false
        },
        verbose: {
            type: 'boolean',
            alias: 'v',
            default: false
        },
        threads: {
            type: 'string',
            alias: 't',
            default: null
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
if (cli.flags.threads !== null) {
    const t = parseInt(cli.flags.threads);
    if (isNaN(t)) {
        console.error(cerr`Number of --threads|-t must be greater or equal to 0 `);
        process.exit(1);
    }
    cli.flags.threads = t;
}

if (cli.flags.verbose) {
    enableDebug();
    debug('Debugging enabled...');
}

const config: IAssetsCompilerConfiguration = {
    rootPlugins: cli.flags.plugin ? [cli.flags.plugin] : [],
    watchFiles: cli.flags.watch,
    onlyPreprocessing: cli.flags.onlypre,
    clean: cli.flags.clean,
    maxParallelism: !!cli.flags.threads ? cli.flags.threads : os.cpus().length - 1
};

console.log(getAvailableStats());

new AssetsCompiler(config).start().then(() => {
    // success
}, () => {
    // failed
});

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
