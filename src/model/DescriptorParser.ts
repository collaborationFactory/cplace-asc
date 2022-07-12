import { PackageVersion } from './PackageVersion';
import { PluginDescriptor } from './PluginDescriptor';
import { PluginDescriptorParser } from './PluginDescriptorParser';
import { ImlDescriptorParser } from './ImlDescriptorParser';

export interface DescriptorParser {
    getPluginDescriptor(): PluginDescriptor;
}

export function getDescriptorParser(pluginDir: string, pluginName: string, excludeTestDependencies: boolean): DescriptorParser {
    if (PackageVersion.get().major < 3) {
        return new ImlDescriptorParser(pluginDir, pluginName, excludeTestDependencies)
    } else {
        return new PluginDescriptorParser(pluginDir);
    }
}