/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */


export const cliOptions = {
    help: {
        alias: 'h',
        desc: 'Show this help.'
    },
    verbose: {
        alias: 'v',
        desc: 'Verbose logging. Useful for debugging.'
    },
    parallelism: {
        alias: 't',
        requiresArg: true,
        desc: 'Can be used to control how many cpu core are utilized simultaneously.'
    },
    sequential: {
        alias: 's',
        desc: 'Compile all assets sequentially. Useful if your system has low memory or cpu. This option will ignore parallelism option if used.'
    },
    plugins: {
        alias: 'p',
        type: 'array',
        requiresArg: true,
        desc: 'Comma separated list of plugins to compile. If this option is provided then only provided plugins will be compiled.'
    },
    doNotWatch: {
        desc: 'Assets compiler will not watch for changes. Compiler will compile once and exit.'
    },
    doNotCompileOnStartup: {
        desc: 'Do not compile on startup, if "doNotWatch" option is also used then the operation is noop.'
    },
    repo: {
        alias: 'r',
        type: 'string',
        requiresArg: true,
        desc: 'Which repo to include in compilation'
    }
};

