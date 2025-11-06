#!/usr/bin/env node

import { parseArgs } from 'util';
import { RegistryInitializer } from './RegistryInitializer';
import { RegistryCredentials } from "./RegistryCredentials";

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
                            Generates configuration for all accessible private npm scopes
  -h, --help                Display this help message

Examples:
  registry-initializer
  registry-initializer --destination /path/to/.npmrc
  registry-initializer -d /path/to/.npmrc --scoped
  registry-initializer -s
`;

interface CliOptions {
    destination?: string;
    scoped: boolean;
    help: boolean;
}

/**
 * Parse and validate command line arguments.
 *
 * @returns Parsed CLI options
 * @throws Error if arguments are invalid
 */
function parseCliArguments(): CliOptions {
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

    const destination = values.destination;
    const scoped = values.scoped ?? false;
    const help = values.help ?? false;

    // Validate destination if provided
    if (destination !== undefined && destination.trim() === '') {
        throw new Error('--destination cannot be empty');
    }

    return {
        destination,
        scoped,
        help,
    };
}

/**
 * Execute the registry initialization with the provided options.
 *
 * @param options CLI options for registry initialization
 */
async function executeRegistryInitialization(options: CliOptions): Promise<void> {
    const registryInitializer = new RegistryInitializer();
    await registryInitializer.initRegistry(options.destination, options.scoped);
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
    try {
        const options = parseCliArguments();

        if (options.help) {
            console.log(helpText);
            process.exit(0);
        }

        await executeRegistryInitialization(options);
    } catch (error: any) {
        if (error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
            console.error(`Error: ${error.message}`);
            console.log(helpText);
            process.exit(1);
        }

        // Re-throw validation errors with proper formatting
        if (error.message.includes('--destination')) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }

        throw error;
    }
}

// Execute main function only when run as a script
if (require.main === module) {
    main();
}

export { RegistryInitializer, RegistryCredentials, parseCliArguments, executeRegistryInitialization };
