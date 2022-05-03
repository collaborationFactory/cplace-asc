/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import { Compiler, Plugin } from 'webpack';
import { isFromLibrary } from '../model/utils';

export class CReplacePlugin implements Plugin {
    constructor() {}

    apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap(
            'CPlaceResolverPlugin',
            (compilation) => {
                (compilation.hooks as any).dependencyReference.tap(
                    'CPlaceResolverPlugin',
                    (_, { module }) => {
                        const { externalType, userRequest } = module;
                        if (isFromLibrary(userRequest)) {
                            const moduleReplacement = userRequest.replace(
                                /(^@)([a-zA-Z0-9.]+)(\/.+)/gi,
                                (match, _, folder, path) => {
                                    const resolver = folder.replace(/\./g, '_');
                                    const module = `.${path}.js`;
                                    return `window['$${resolver}']('${module}')`;
                                }
                            );

                            module.externalType = '';
                            module.request = moduleReplacement;
                        }
                    }
                );
            }
        );
    }
}
