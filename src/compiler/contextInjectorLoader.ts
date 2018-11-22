/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import { loader } from 'webpack';

export default function(this: loader.LoaderContext, content: string) {
    // @ts-ignore
    if (this.resourcePath === path.resolve(this.rootContext, this.query.entry)) {
        const requireContext = '\n//=====================================================\n' +
            'exports.default = require.context(".", true, /.js$/);\n' +
            '//=====================================================\n';

        return content + requireContext;
    }
    return content;
};

/*

                        {
                            loader: path.resolve('./assets-compiler/contextInjectorLoader.js'),
                            options: {
                                entry: defaultEntry
                            }
                        }

*/
