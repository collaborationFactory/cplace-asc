#!/usr/bin/env node
/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {getAvailableStats} from './model/utils';
import {AssetsCompiler, IAssetsCompilerConfiguration} from './model/AssetsCompiler';
import {cerr, checkForUpdate, debug, enableDebug, isDebugEnabled, IUpdateDetails} from './utils';
import * as os from 'os';
import meow = require('meow');

checkNodeVersion();
checkForUpdate()
    .then(details => run(details))
    .catch(() => run());

function run(updateDetails?: IUpdateDetails) {
    const cli = meow(`
    Usage:
        $ cplace-asc

    Options:
        --plugin, -p <plugin>   Run for specified plugin (and dependencies)
        --watch, -w             Enable watching of source files (continuous compilation)
        --onlypre, -o           Run only preprocessing steps (like create tsconfig.json files)
        --clean, -c             Clean generated output folders at the beginning
        --threads, -t           Maximum number of threads to run in parallel
        --localonly, -l         Enable to not scan other directories than CWD for plugins
        --verbose, -v           Enable verbose logging
        --production, -P        Enable production mode (ignores test dependencies)
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
            threads: {
                type: 'string',
                alias: 't',
                default: null
            },
            localonly: {
                type: 'boolean',
                alias: 'l',
                default: false
            },
            verbose: {
                type: 'boolean',
                alias: 'v',
                default: false
            },
            production: {
                type: 'boolean',
                alias: 'P',
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
    if (cli.flags.production && cli.flags.onlypre) {
        console.error(cerr`--production and --onlypre cannot be enabled simultaneously`);
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
        maxParallelism: !!cli.flags.threads ? cli.flags.threads : os.cpus().length - 1,
        localOnly: cli.flags.localonly,
        production: cli.flags.production
    };

    console.log(getAvailableStats());

    try {
        const assetsCompiler = new AssetsCompiler(config);
        process.on('SIGTERM', () => {
            debug('Shutting down...');
            assetsCompiler.shutdown().then(() => {
                process.exit(0);
            }, () => {
                process.exit(1);
            });
        });

        // Timeout to ensure flush of stdout
        assetsCompiler.start(updateDetails).then(() => {
            setTimeout(() => process.exit(0), 200);
        }, () => {
            setTimeout(() => process.exit(1), 200);
        });
    } catch (err) {
        console.error(cerr`Failed to start assets compiler: ${err.message}`);
        if (isDebugEnabled()) {
            console.error(err);
        }
    }
}

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
