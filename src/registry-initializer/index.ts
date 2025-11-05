#!/usr/bin/env node

import { parseArgs } from 'util';
import { RegistryInitializer } from './RegistryInitializer';

const helpText = `
registry-initializer - Initialize cplace npm registry in a .npmrc file

Description:
  A tool for initializing the cplace npm registry in a .npmrc file. The tool can
  generate a global .npmrc file in the user's home folder, or a local one in a
  specified location. By default it initializes the virtual cplace registry. If
  using the --scoped parameter, it will generate a configuration for all npm
  scopes to which the user has read access.

Usage: registry-initializer [options]

Options:
  -d, --destination <path>  Destination path for the .npmrc file (optional)
                            If not specified, uses the global .npmrc location
  -s, --scoped              Use scoped registry configuration (optional, default: false)
                            Generates configuration for all accessible npm scopes
  -h, --help                Display this help message

Examples:
  registry-initializer
  registry-initializer --destination /path/to/.npmrc
  registry-initializer -d /path/to/.npmrc --scoped
  registry-initializer -s
`;

try {
    const { values } = parseArgs({
        options: {
            destination: {
                type: 'string',
                short: 'd',
            },
            scoped: {
                type: 'boolean',
                short: 's',
                default: false,
            },
            help: {
                type: 'boolean',
                short: 'h',
                default: false,
            },
        },
        strict: true,
    });

    if (values.help) {
        console.log(helpText);
        process.exit(0);
    }

    const destination = values.destination;
    const scoped = values.scoped ?? false;

    // Validate destination if provided
    if (destination !== undefined && destination.trim() === '') {
        console.error('Error: --destination cannot be empty');
        process.exit(1);
    }

    const registryInitializer = new RegistryInitializer();
    registryInitializer.initRegistry(destination, scoped);
} catch (error: any) {
    if (error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
        console.error(`Error: ${error.message}`);
        console.log(helpText);
        process.exit(1);
    }
    throw error;
}

export { RegistryInitializer };
