import { PackageVersion } from './PackageVersion';
import * as path from 'path';
import { ImlParser } from './ImlParser';
import { PluginDescriptorParser } from './PluginDescriptorParser';
import { debug } from '../utils';

export interface DependencyParser {
    getPluginDependencies(
        pluginDir: string,
        pluginName: string,
        excludeTestDependencies: boolean
    ): string[];
}

export function getDependencyParser(): DependencyParser {
    if (PackageVersion.get().major < 3) {
        return new ImlDependencyParser();
    } else {
        return new PluginDescriptorDependencyParser();
    }
}

class ImlDependencyParser implements DependencyParser {
    public getPluginDependencies(
        pluginDir: string,
        pluginName: string,
        excludeTestDependencies: boolean
    ): string[] {
        const pathToIml = path.join(pluginDir, `${pluginName}.iml`);
        const imlParser = new ImlParser(pathToIml);

        return imlParser
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
            .map((module) => module.moduleName);
    }
}

class PluginDescriptorDependencyParser implements DependencyParser {
    public getPluginDependencies(
        pluginDir: string,
        pluginName: string,
        excludeTestDependencies: boolean
    ): string[] {
        const descriptorParser = new PluginDescriptorParser(pluginDir);
        const pluginDescriptor = descriptorParser.getPluginDescriptor();
        if (pluginName !== pluginDescriptor.name) {
            throw new Error(
                `[DependencyParser] Expected plugin name ${pluginName} does not match descriptor plugin name: ${pluginDescriptor.name}`
            );
        }

        const dependencies = pluginDescriptor.dependencies || [];
        if (excludeTestDependencies) {
            return [...dependencies];
        } else {
            const testDependencies = pluginDescriptor.testDependencies || [];
            return [...dependencies, ...testDependencies];
        }
    }
}
