import * as path from 'path';
import * as fs from 'fs';
import { cerr } from '../utils';

export interface PluginDescriptor {
    /**
     * Name of the plugin
     */
    readonly name: string;
    /**
     * Group id of the plugin
     */
     readonly group: string;
     /**
     * Name of the plugin's repository
     */
    readonly repoName: string;
    // additional info such as hasAssets, hasLess, hasVendors etc.
    /**
     * List of descriptors of plugins that this plugin depends on for production
     */
    readonly dependencies?: PluginDescriptor[];
    /**
     * List of descriptors of plugin that this plugin depends on for production
     */
    readonly testDependencies?: PluginDescriptor[];
}

export class PluginDescriptorParser {
    public static readonly DESCRIPTOR_FILE_NAME = 'pluginDescriptor.json';
    public static readonly BUILD_GRADLE_FILE_NAME = 'build.gradle';

    private readonly pathToDescriptor: string;
    private readonly descriptor: PluginDescriptor;

    constructor(private pluginDir: string) {
        this.pathToDescriptor =
            PluginDescriptorParser.getPathToDescriptor(pluginDir);
        if (!fs.existsSync(this.pathToDescriptor)) {
            console.error(
                cerr`(PluginDescriptor) Failed to find plugin descriptor for ${path.basename(
                    pluginDir
                )}`
            );
            console.error();
            console.error(
                cerr`(PluginDescriptor) Try running "gradle generatePluginDescriptor" in the containing repository`
            );
            console.error();
            throw Error(
                `PluginDescriptor ${this.pathToDescriptor} does not exist`
            );
        }
        this.descriptor = this.parseFile();
    }

    private static getPathToDescriptor(pluginDir) {
        return path.join(
            pluginDir,
            PluginDescriptorParser.DESCRIPTOR_FILE_NAME
        );
    }

    private static getPathToBuildGradle(pluginDir) {
        return path.join(
            pluginDir,
            PluginDescriptorParser.BUILD_GRADLE_FILE_NAME
        );
    }

    public static isCplacePluginWithGradleAndContainsPluginDescriptor(
        pluginDir: string
    ): boolean {
        return (
            fs.existsSync(this.getPathToDescriptor(pluginDir)) &&
            fs.existsSync(this.getPathToBuildGradle(pluginDir))
        );
    }

    public getPluginDescriptor(): PluginDescriptor {
        return this.descriptor;
    }

    private parseFile(): PluginDescriptor {
        const content = fs.readFileSync(this.pathToDescriptor, {
            encoding: 'utf8',
        });
        const pluginDescriptor = JSON.parse(content) as PluginDescriptor;
        if (pluginDescriptor?.dependencies?.length && 
            (typeof pluginDescriptor.dependencies[0] === 'string' || pluginDescriptor.dependencies[0] instanceof String)) {
                
                const newDependencies: PluginDescriptor[] = [];
                pluginDescriptor.dependencies.forEach(dependency => {
                    newDependencies.push({
                        name: dependency + ""
                    } as PluginDescriptor);
                });
                pluginDescriptor.dependencies.splice(0);
                pluginDescriptor.dependencies.push(...newDependencies);
        }

        return pluginDescriptor;
    }
}
