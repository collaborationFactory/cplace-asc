import * as path from 'path';
import * as fs from 'fs';
import { cerr } from '../utils';
import { PluginDescriptor } from './PluginDescriptor';
import { DescriptorParser } from './DescriptorParser';
import CplacePlugin from './CplacePlugin';

export class PluginDescriptorParser implements DescriptorParser {
    private readonly pathToDescriptor: string;
    private readonly descriptor: PluginDescriptor;

    constructor(private pluginDir: string) {
        this.pathToDescriptor = CplacePlugin.getPathToDescriptor(pluginDir);
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

    public getPluginDescriptor(): PluginDescriptor {
        return this.descriptor;
    }

    private parseFile(): PluginDescriptor {
        const content = fs.readFileSync(this.pathToDescriptor, {
            encoding: 'utf8',
        });
        const pluginDescriptor = JSON.parse(content) as PluginDescriptor;
        if (
            pluginDescriptor?.dependencies?.length &&
            (typeof pluginDescriptor.dependencies[0] === 'string' ||
                pluginDescriptor.dependencies[0] instanceof String)
        ) {
            const newDependencies: PluginDescriptor[] = [];
            pluginDescriptor.dependencies.forEach((dependency) => {
                newDependencies.push({
                    name: dependency + '',
                } as PluginDescriptor);
            });
            pluginDescriptor.dependencies.splice(0);
            pluginDescriptor.dependencies.push(...newDependencies);
        }

        return pluginDescriptor;
    }
}
