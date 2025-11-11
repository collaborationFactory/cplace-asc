/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import * as fs from 'fs';
import CplacePlugin, { ICplacePluginResolver } from './CplacePlugin';
import { cerr, cwarn, debug, GREEN_CHECK } from '../utils';
import { AssetsCompiler } from './AssetsCompiler';

/**
 * Generates a 'cplace-plugins.less' file for plugins with less assets.
 * This file contains variables for each dependency plugin, pointing to the path to that plugin.
 */
export class CplacePluginLessGenerator {
    /**
     * Generate a less file named 'cplace-plugins.less' if the plugin has less files.
     * This file will contain a variable for each dependency plugin, pointing to the path to that plugin.
     * Based on the use case (local build or artifact build) the path to the dependency plugin will be different.
     * Any other less file can then reference a file from a dependency plugin through these variables
     * instead of directly with a hardcoded relative path.
     *
     * @param plugin The plugin to generate the less file for
     * @param pluginResolver Function to resolve plugin dependencies
     * @param localOnly Whether to use local-only paths
     */
    public generate(
        plugin: CplacePlugin,
        pluginResolver: ICplacePluginResolver,
        localOnly: boolean
    ): void {
        if (!plugin.hasLessAssets) {
            throw Error(
                `[${plugin.pluginName}] plugin does not have Less assets`
            );
        }

        debug(
            `(CplacePluginLessGenerator) [${plugin.pluginName}] Generating cplace-plugins.less...`
        );
        const dependenciesWithLess = plugin.pluginDescriptor.dependencies
            .map((pluginDescriptor) => {
                const resolvedPlugin = pluginResolver(pluginDescriptor.name);
                if (!resolvedPlugin) {
                    cwarn`Plugin ${pluginDescriptor.name} not found in node_modules. Ignoring...`;
                }
                return resolvedPlugin;
            })
            .filter((p) => p != undefined && p.hasLessAssets) as CplacePlugin[];

        // generate cplace-plugins.less
        const cplacePluginsLessPath = path.join(
            plugin.assetsDir,
            'less',
            'cplace-plugins.less'
        );
        const lessFileContent: string[] = [];
        dependenciesWithLess.forEach((dependencyPlugin) => {
            let lessPath = path.join(
                this.getRelRepoRootPrefix(),
                dependencyPlugin.getPluginPathRelativeFromRepo(
                    plugin.repo,
                    localOnly,
                    AssetsCompiler.isArtifactsBuild()
                )
            );
            // if it's not an artifact build, the less files are in the assets folder of the plugin
            // the same goes for plugins from the same repo during an artifacts build
            if (
                !AssetsCompiler.isArtifactsBuild() ||
                dependencyPlugin.repo === plugin.repo
            ) {
                lessPath = path.join(lessPath, 'assets');
            }
            lessFileContent.push(
                `@plugin-path-${dependencyPlugin.pluginNameKebabCase}: '${lessPath}';`
            );
        });
        if (lessFileContent.length !== 0) {
            fs.writeFileSync(cplacePluginsLessPath, lessFileContent.join('\n'));

            if (!fs.existsSync(cplacePluginsLessPath)) {
                console.error(
                    cerr`[${plugin.pluginName}] Could not generate cplace-plugins.less file...`
                );
                throw Error(
                    `[${plugin.pluginName}] cplace-plugins.less generation failed`
                );
            } else {
                console.log(
                    `${GREEN_CHECK} [${plugin.pluginName}] wrote cplace-plugins.less...`
                );
            }
        }
    }

    private getRelRepoRootPrefix(): string {
        return '../../..';
    }
}
