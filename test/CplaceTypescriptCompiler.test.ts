import * as webpack from 'webpack';
import { CplaceTypescriptCompiler } from '../src/compiler/CplaceTypescriptCompiler';

describe('IgnorePlugin of the cplace TypeScript compiler', () => {
    const pluginName = 'cf.cplace.platform';
    const assets = '/repos/main/cf.cplace.platform/assets';

    const isIgnored = (resource: string, context: string): boolean => {
        const compiler = new CplaceTypescriptCompiler(
            pluginName,
            [],
            assets,
            '/repos/main',
            false
        );
        const config = (
            compiler as any
        ).getWebpackConfig() as webpack.Configuration;
        const plugin = config.plugins!.find(
            (p) => p instanceof webpack.IgnorePlugin
        ) as webpack.IgnorePlugin;
        // checkIgnore returns false when webpack drops the import.
        return (
            plugin.checkIgnore({ request: resource, context } as any) === false
        );
    };

    test('ignores the plugin vendor.js and index.js', () => {
        expect(isIgnored('./vendor.js', `${assets}/generated_js`)).toBe(true);
        expect(isIgnored('../index.js', `${assets}/generated_js/foo`)).toBe(
            true
        );
    });

    test('keeps vendor.js imported by a library under node_modules', () => {
        expect(
            isIgnored(
                '../../util/vendor.js',
                `${assets}/node_modules/echarts/lib/chart/line`
            )
        ).toBe(false);
        expect(
            isIgnored(
                '../../util/vendor.js',
                String.raw`C:\repos\main\cf.cplace.platform\assets\node_modules\echarts\lib\chart\line`
            )
        ).toBe(false);
    });

    test('keeps other files and other plugins', () => {
        expect(isIgnored('./app.js', `${assets}/generated_js`)).toBe(false);
        expect(
            isIgnored(
                './vendor.js',
                '/repos/main/cf.cplace.other/assets/generated_js'
            )
        ).toBe(false);
    });
});
