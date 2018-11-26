/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import {Compiler, Plugin} from 'webpack';
import {isFromLibrary} from '../model/utils';

export class CReplacePlugin implements Plugin {
    constructor() {
    }

    apply(compiler: Compiler) {
        compiler.hooks.compilation.tap('CPlaceResolverPlugin', compilation => {
            // @ts-ignore
            compilation.hooks.dependencyReference.tap('CPlaceResolverPlugin', (_, { module }) => {
                const { externalType, userRequest } = module;
                const isALibrary = isFromLibrary(userRequest);

                if (isALibrary) {
                    const moduleReplacement = userRequest
                    // @ts-ignore
                        .replace(/(^@)([\w.]*)(.+)/gi, (match, _, folder, path) => {
                            const resolver = folder.replace(/\./g, '_');
                            const module = `.${path}.js`;
                            return `window['$${resolver}']('${module}')`;
                        });

                    module.externalType = '';
                    module.request = moduleReplacement;
                }
            });
        });
    }
}
