#!/usr/bin/env node
/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import { getAvailableStats } from './model/utils';
import {
    AssetsCompiler,
    IAssetsCompilerConfiguration,
} from './model/AssetsCompiler';
import {
    cerr,
    checkForUpdate,
    cwarn,
    debug,
    enableDebug,
    isDebugEnabled,
    IUpdateDetails,
} from './utils';
import * as os from 'os';
import * as path from 'path';
import { PackageVersion } from './model/PackageVersion';
import meow = require('meow');

checkNodeVersion();
checkForUpdate()
    .then((details) => run(details))
    .catch(() => run());

function run(updateDetails?: IUpdateDetails) {
    const cli = meow(
        `
    Usage:
        Go to the root folder of your cplace project. Then you can start cplace-asc: 
        $ cplace-asc

    Options:
        --plugin, -p <plugins>  Run for specified plugins (and dependencies) - comma separated list of plugin names
        --watch, -w             Enable watching of source files (continuous compilation)
        --onlypre, -o           Run only preprocessing steps (like create tsconfig.json files)
        --clean, -c             Clean generated output folders at the beginning
        --threads, -t           Maximum number of threads to run in parallel
        --localonly, -l         Enable to not scan other directories than CWD for plugins
        --noparents, -x         Enable to only run compilation on plugins in current repository (still scans for other sources to be present)
        --verbose, -v           Enable verbose logging
        --production, -P        Enable production mode (ignores test dependencies and E2E)

`,
        {
            flags: {
                plugin: {
                    type: 'string',
                    alias: 'p',
                    default: null,
                },
                watch: {
                    type: 'boolean',
                    alias: 'w',
                    default: false,
                },
                onlypre: {
                    type: 'boolean',
                    alias: 'o',
                    default: false,
                },
                clean: {
                    type: 'boolean',
                    alias: 'c',
                    default: false,
                },
                threads: {
                    type: 'string',
                    alias: 't',
                    default: null,
                },
                localonly: {
                    type: 'boolean',
                    alias: 'l',
                    default: false,
                },
                noparents: {
                    type: 'boolean',
                    alias: 'x',
                    default: false,
                },
                verbose: {
                    type: 'boolean',
                    alias: 'v',
                    default: false,
                },
                production: {
                    type: 'boolean',
                    alias: 'P',
                    default: false,
                },
            },
        }
    );

    if (cli.flags.plugin !== null && !cli.flags.plugin) {
        console.error(cerr`Missing value for --plugin|-p argument`);
        process.exit(1);
    }
    if (cli.flags.watch && cli.flags.onlypre) {
        console.error(
            cerr`--watch and --onlypre cannot be enabled simultaneously`
        );
        process.exit(1);
    }
    if (cli.flags.production && cli.flags.onlypre) {
        console.error(
            cerr`--production and --onlypre cannot be enabled simultaneously`
        );
        process.exit(1);
    }

    if (cli.flags.threads !== null) {
        const t = parseInt(cli.flags.threads);
        if (isNaN(t)) {
            console.error(
                cerr`Number of --threads|-t must be greater or equal to 0 `
            );
            process.exit(1);
            return;
        }
        cli.flags.threads = t;
    }

    if (cli.flags.verbose) {
        enableDebug();
        debug('Debugging enabled...');
    }

    if (cli.flags.production) {
        process.env.NODE_ENV = 'production';
    }

    const mainRepoPath = AssetsCompiler.getMainRepoPath(
        process.cwd(),
        cli.flags.localonly
    );
    if (mainRepoPath === null) {
        console.error(
            cerr`Failed to find path to main repository containing cf.cplace.platform plugin... Ensure that you are starting from the root directory of your cplace project.`
        );
        process.exit(1);
        return;
    } else if (
        path.basename(mainRepoPath) !== 'main' &&
        !cli.flags.onlypre &&
        !cli.flags.localonly
    ) {
        console.warn(
            cwarn`Sry main Repository is not called 'main' LESS Compilation might fail, please rename your folder to 'main'`
        );
    }

    try {
        PackageVersion.initialize(mainRepoPath);

        const plugins = cli.flags.plugin ? cli.flags.plugin.split(',') : [];
        const config: IAssetsCompilerConfiguration = {
            rootPlugins: plugins,
            watchFiles: cli.flags.watch,
            onlyPreprocessing: cli.flags.onlypre,
            clean: cli.flags.clean,
            maxParallelism: !!cli.flags.threads
                ? cli.flags.threads
                : os.cpus().length - 1,
            localOnly: cli.flags.localonly,
            production: cli.flags.production,
            noParents: cli.flags.noparents || cli.flags.noParents,
        };

        console.log(getAvailableStats());
        const assetsCompiler = new AssetsCompiler(config, process.cwd());
        process.on('SIGTERM', () => {
            debug('Shutting down...');
            assetsCompiler.shutdown().then(
                () => {
                    process.exit(0);
                },
                () => {
                    process.exit(1);
                }
            );
        });

        // Timeout to ensure flush of stdout
        assetsCompiler.start(updateDetails).then(
            () => {
                setTimeout(() => process.exit(0), 200);
            },
            (reason: any) => {
                const message = reason instanceof Error ? reason.message : reason;
                console.error(cerr`Failed to start assets compiler: ${message}`);
                if (isDebugEnabled()) {
                    console.error(reason);
                }
                setTimeout(() => process.exit(1), 200);
            }
        );
    } catch (err) {
        console.error(cerr`Failed to start assets compiler: ${err.message}`);
        if (isDebugEnabled()) {
            console.error(err);
        }
        process.exit(1);
    }
}

function checkNodeVersion(): void {
    let major = Number.MAX_VALUE;
    try {
        const parts = process.version.split('.');
        major = Number(parts[0].replace(/\D/, ''));
    } catch {
        console.log(
            'Failed to check node version, assuming correct version...'
        );
    }
    if (major < 8) {
        console.error('ERROR: Requires node version 8.x (LTS)...');
        process.exit(1);
    }
}
