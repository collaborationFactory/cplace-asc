import * as path from 'path';
import { ImlParser } from './ImlParser';
import { debug } from '../utils';
import { PluginDescriptor } from './PluginDescriptor';
import { DescriptorParser } from './DescriptorParser';

export class ImlDescriptorParser implements DescriptorParser {

    private readonly descriptor: PluginDescriptor;

    constructor(
        pluginDir: string, 
        pluginName: string, 
        excludeTestDependencies: boolean
    ) {
        this.descriptor = this.parseFile(
            pluginDir, 
            pluginName,
            excludeTestDependencies);
    }

    public getPluginDescriptor(): PluginDescriptor {
        return this.descriptor;
    }

    private parseFile(
        pluginDir: string,
        pluginName: string,
        excludeTestDependencies: boolean
    ): PluginDescriptor {
        const pathToIml = path.join(pluginDir, `${pluginName}.iml`);
        const imlParser = new ImlParser(pathToIml);

        const dependencies = imlParser
            .getReferencedModules()
            .filter((module) => {
                const includeDependency =
                    !excludeTestDependencies || !module.isTestScoped;
                if (!includeDependency) {
                    debug(
                        `(DependencyParser) [${pluginName}] excluding test dependency: ${module.moduleName}`
                    );
                }
                return includeDependency;
            })
            .map((module) => {
                return {
                    name: module.moduleName
                } as PluginDescriptor
            });

        return {
            name: pluginName,
            dependencies: dependencies
        } as PluginDescriptor;
    }
}