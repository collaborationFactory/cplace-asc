import * as path from "path";
import * as fs from "fs";
import {cerr} from "../utils";

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

    private readonly pathToDescriptor: string;
    private readonly descriptor: PluginDescriptor;

    constructor(private pluginDir: string) {
        this.pathToDescriptor = path.join(pluginDir, PluginDescriptorParser.DESCRIPTOR_FILE_NAME);
        if (!fs.existsSync(this.pathToDescriptor)) {
            console.error(cerr`(PluginDescriptor) Failed to find plugin descriptor for ${path.basename(pluginDir)}`);
            throw Error(`PluginDescriptor ${this.pathToDescriptor} does not exist`);
        }
        this.descriptor = this.parseFile();
    }

    public getPluginDescriptor(): PluginDescriptor {
        return this.descriptor;
    }

    private parseFile(): PluginDescriptor {
        const content = fs.readFileSync(this.pathToDescriptor, {encoding: 'utf8'});
        return JSON.parse(content) as PluginDescriptor;
    }
}
