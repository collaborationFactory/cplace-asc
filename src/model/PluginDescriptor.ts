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
    /**
     * List of descriptors of plugins that this plugin depends on for production
     */
    readonly dependencies: PluginDescriptor[];
    /**
     * List of descriptors of plugin that this plugin depends on for production
     */
    readonly testDependencies?: PluginDescriptor[];
}
