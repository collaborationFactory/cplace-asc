/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

import * as path from 'path';
import {LoaderContext} from 'webpack';

/*
    This file is configured by `TypescriptCompiler` as a loader for Webpack
 */

export default function (this: LoaderContext<any>, source: string, map: any) {
    // @ts-ignore
    if (this.resourcePath === path.resolve(this.rootContext, this.query.entry)) {
        const requireContext = '\n//======================================================\n' +
            'exports.default = require.context(".", true, /.js$/);\n' +
            '//======================================================\n';

        source = source + requireContext;
    }
    this.callback(null, source, map);
};
