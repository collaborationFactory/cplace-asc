import * as path from "path";
import * as fs from "fs";
import { cerr } from "../utils";

export interface PluginDescriptor {
    /**
     * Name of the plugin
     */
    readonly name: string;
    /**
     * List of plugin names this plugin depends on for production
     */
    readonly dependencies?: string[];
    /**
     * List of plugin names this plugin depends on for production
     */
    readonly testDependencies?: string[];
}

export class PluginDescriptorParser {
    public static readonly DESCRIPTOR_FILE_NAME = 'pluginDescriptor.json';
    public static readonly BUILD_GRADLE_FILE_NAME = 'build.gradle';

    private readonly pathToDescriptor: string;
    private readonly descriptor: PluginDescriptor;

    constructor(private pluginDir: string) {
        this.pathToDescriptor = PluginDescriptorParser.getPathToDescriptor(pluginDir);
        if (!fs.existsSync(this.pathToDescriptor)) {
            console.error(cerr`(PluginDescriptor) Failed to find plugin descriptor for ${path.basename(pluginDir)}`);
            console.error();
            console.error(cerr`(PluginDescriptor) Try running "gradle generatePluginDescriptor" in the containing repository`);
            console.error();
            throw Error(`PluginDescriptor ${this.pathToDescriptor} does not exist`);
        }
        this.descriptor = this.parseFile();
    }

    public static getPathToDescriptor(pluginDir) {
        return path.join(pluginDir, PluginDescriptorParser.DESCRIPTOR_FILE_NAME);
    }

    public static getPathToBuildGradle(pluginDir) {
        return path.join(pluginDir, PluginDescriptorParser.BUILD_GRADLE_FILE_NAME);
    }

    public static isCplacePluginWithGradleAndContainsPluginDescriptor(pluginDir: string): boolean {
        return fs.existsSync(this.getPathToDescriptor(pluginDir)) && fs.existsSync(this.getPathToBuildGradle(pluginDir));
    }

    public getPluginDescriptor(): PluginDescriptor {
        return this.descriptor;
    }

    private parseFile(): PluginDescriptor {
        const content = fs.readFileSync(this.pathToDescriptor, {encoding: 'utf8'});
        return JSON.parse(content) as PluginDescriptor;
    }
}
