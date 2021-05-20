import {lessEscapePlugin} from "./LessEscapePlugin";

/**
 * Exports all the less plugins
 * @param pluginName Plugin name
 */
export function lessPlugins(pluginName: string) {
    return [
        {
            install: (less, pluginManager) => {
                pluginManager.addPreProcessor(lessEscapePlugin(pluginName), 2000)
            },
            minVersion: [2, 7, 1]
        }
    ];
}
