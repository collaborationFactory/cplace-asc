import path = require('path');
import * as fs from 'fs';
import { cerr } from '../utils';

export interface IExtraTypes {
    definitions: string[];
    externals: { [importName: string]: string };
}

export class ExtraTypesReader {
    public static getExtraTypes(
        pluginDir: string,
        dependencyPaths: string[]
    ): IExtraTypes | null {
        const pluginName = path.basename(pluginDir);
        const assetsDir = this.findAssetsDir(pluginDir);
        const typesPath = path.resolve(assetsDir, 'ts', 'extra-types.json');
        let result: IExtraTypes;

        if (fs.existsSync(typesPath)) {
            const content = fs.readFileSync(typesPath, { encoding: 'utf8' });
            try {
                result = JSON.parse(content);
            } catch (e) {
                console.error(
                    cerr`[${pluginName}] Cannot read extra types: ${typesPath}`
                );
                return null;
            }
        } else {
            result = {
                definitions: [],
                externals: {},
            };
        }

        if (!result.definitions) {
            result.definitions = [];
        } else {
            result.definitions = result.definitions.map((p) =>
                path.resolve(assetsDir, 'ts', p)
            );
        }

        if (!result.externals) {
            result.externals = {};
        }

        dependencyPaths
            .map((dep) => {
                return this.getExtraTypes(dep, []);
            })
            .forEach((r) => {
                if (r !== null) {
                    result.definitions = [
                        ...result.definitions,
                        ...r.definitions,
                    ];
                    result.externals = {
                        ...result.externals,
                        ...r.externals,
                    };
                }
            });

        return result;
    }

    private static findAssetsDir(pluginDir: string) {
        if (fs.existsSync(path.resolve(pluginDir, 'assets'))) {
            return path.resolve(pluginDir, 'assets');
        } else {
            return pluginDir;
        }
    }
}
