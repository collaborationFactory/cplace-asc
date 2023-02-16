import { CompilationResult, ICompiler } from './interfaces';
import * as fs from 'fs';
import * as path from 'path';
import { NPMResolver } from '../model/NPMResolver';
import { cerr, cgreen, debug, formatDuration } from '../utils';
import * as webpack from 'webpack';
import { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import * as crypto from 'crypto';
import * as eol from 'eol';
import { CompressCssCompiler } from './CompressCssCompiler';
import { CplaceTypescriptCompiler } from './CplaceTypescriptCompiler';
import spawn = require('cross-spawn');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

export class VendorCompiler implements ICompiler {
    public static readonly DEST_CSS_DIR = 'generated_css';
    private static readonly VENDOR_ENTRY = 'index.js';
    private static readonly VENDOR_ENTRY_HASH = 'index.js.hash';
    private static readonly VENDOR_JS_FILE = 'vendor.js';
    private static readonly VENDOR_CSS_FILE = 'vendor.css';
    private static readonly JAVASCRIPT_TO_BE_COMPRESSED =
        'javaScriptIncludesToBeCompressed.txt';
    private static readonly CSS_IMPORTS = 'imports.css';
    private static readonly PLUGIN_SPECIFIC_VENDOR_CONFIG = 'vendor.config.js';

    private compressCssCompiler: CompressCssCompiler;

    constructor(
        private readonly pluginName: string,
        private readonly dependencyPaths: string[],
        private readonly assetsPath: string,
        private readonly mainRepoDir: string,
        private readonly isProduction: boolean
    ) {
        this.compressCssCompiler = new CompressCssCompiler(
            this.pluginName,
            this.dependencyPaths,
            this.assetsPath,
            this.mainRepoDir,
            this.isProduction
        );
    }

    /**
     * Compiles plugin vendors
     */
    public async compile(): Promise<CompilationResult> {
        console.log(`⟲ [${this.pluginName}] starting vendors compilation...`);
        const startTime = new Date().getTime();

        const dependenciesWereUpdated = NPMResolver.installPluginDependencies(
            this.pluginName,
            this.assetsPath,
            this.isProduction
        );

        const pluginIndexExists = this.tscPluginIndex();

        if (!pluginIndexExists) {
            console.log(
                cgreen`⇢`,
                `[${this.pluginName}] index.ts not found. Bundling skipped!`
            );
            debug(
                `(VendorCompiler) [${this.pluginName}] To bundle plugin vendors, please add the index.ts file!`
            );
            this.removeVendors();
            this.prepareVendorJSForCompression();
            await this.prepareVendorCSSForCompression();
            return Promise.resolve(CompilationResult.UNCHANGED);
        }

        const oldIndexHash = this.readIndexHash();
        const newIndexHash = this.createIndexHashFile();

        debug(`(VendorCompiler) [${this.pluginName}] comparing hash files...`);
        if (oldIndexHash === newIndexHash && !dependenciesWereUpdated) {
            console.log(
                cgreen`✓`,
                `[${this.pluginName}] vendors are up to date`
            );
            return Promise.resolve(CompilationResult.UNCHANGED);
        }
        debug(`(VendorCompiler) [${this.pluginName}] hash files changed`);

        await this.bundlePluginVendors();
        this.prepareVendorJSForCompression();
        await this.prepareVendorCSSForCompression();

        const endTime = new Date().getTime();
        console.log(
            cgreen`✓`,
            `[${this.pluginName}] vendors compiled (${formatDuration(
                endTime - startTime
            )})`
        );

        return Promise.resolve(CompilationResult.CHANGED);
    }

    /**
     * Compiles plugin index.ts
     * @private
     */
    private tscPluginIndex(): boolean {
        debug(`(VendorCompiler) [${this.pluginName}] compiling index.ts...`);
        const tsc = path.resolve(__dirname, '../../', 'node_modules/.bin/tsc');
        const index = path.join(this.assetsPath, 'index.ts');
        if (!fs.existsSync(index)) {
            return false;
        }
        const res = spawn.sync(tsc, [
            path.join(this.assetsPath, 'index.ts'),
            `--skipLibCheck`,
            `--outDir`,
            path.resolve(this.assetsPath, CplaceTypescriptCompiler.DEST_DIR),
        ]);
        debug(
            `(VendorCompiler) [${this.pluginName}] index.ts tsc return code: ${res.status}`
        );
        if (res.status !== 0) {
            debug(
                `(VendorCompiler) [${
                    this.pluginName
                }] index.ts compilation failed with error ${res.output.toString()}`
            );
            throw Error(`[${this.pluginName}] index.ts compilation failed!`);
        }
        debug(`(VendorCompiler) [${this.pluginName}] index.ts compiled`);
        return true;
    }

    /**
     * Reads index.js.hash
     * @private
     */
    private readIndexHash(): string | null {
        const hashPath = this.getIndexHashFilePath();
        if (fs.existsSync(hashPath)) {
            return fs.readFileSync(hashPath, { encoding: 'utf8' });
        } else {
            return null;
        }
    }

    /**
     * Creates index.js.hash file
     * @private
     */
    private createIndexHashFile(): string {
        const hash = this.getHash4Index();
        fs.writeFileSync(this.getIndexHashFilePath(), hash, {
            encoding: 'utf8',
        });
        return hash;
    }

    /**
     * Gets index.js hash
     * @private
     */
    private getHash4Index(): string {
        const hash = crypto.createHash('sha256');
        const data = fs.readFileSync(
            path.join(
                this.assetsPath,
                CplaceTypescriptCompiler.DEST_DIR,
                VendorCompiler.VENDOR_ENTRY
            )
        );
        hash.update(data);
        return hash.digest('hex');
    }

    /**
     * Gets index.js.hash file path
     * @private
     */
    private getIndexHashFilePath(): string {
        return path.join(
            this.assetsPath,
            CplaceTypescriptCompiler.DEST_DIR,
            VendorCompiler.VENDOR_ENTRY_HASH
        );
    }

    /**
     * Load plugin specific webpack config file in the assets of a plugin
     * @private
     */
    private getPluginSpecificWebpackConfig(): Configuration {
        const pluginSpecificConfigFile = path.join(
            this.assetsPath,
            VendorCompiler.PLUGIN_SPECIFIC_VENDOR_CONFIG
        );
        if (!fs.existsSync(pluginSpecificConfigFile)) {
            return {};
        }

        console.log(
            `⟲ [${this.pluginName}] loading custom vendor webpack configuration...`
        );
        try {
            return require(pluginSpecificConfigFile);
        } catch (e) {
            console.error(
                cerr`Error while loading configuration ${pluginSpecificConfigFile}`
            );
            throw e;
        }
    }

    /**
     * Gets plugin webpack config
     * @private
     */
    private getPluginWebpackConfig(): Configuration {
        return {
            mode: 'production',
            entry: {
                vendor: path.resolve(
                    this.assetsPath,
                    CplaceTypescriptCompiler.DEST_DIR,
                    VendorCompiler.VENDOR_ENTRY
                ),
            },
            externals: {
                jquery: 'jQuery',
            },
            output: {
                path: path.resolve(
                    this.assetsPath,
                    CplaceTypescriptCompiler.DEST_DIR
                ),
                filename: '[name].js',
            },
            resolveLoader: {
                modules: [path.resolve(__dirname, '../../', 'node_modules')],
            },
            resolve: {
                modules: [
                    path.resolve(this.assetsPath, 'node_modules'),
                    path.resolve(this.assetsPath, 'js'),
                    path.resolve(this.assetsPath, '3rdParty'),
                ],
            },
            optimization: {
                minimize: true,
                minimizer: [
                    new CssMinimizerPlugin({
                        parallel: true,
                        minimizerOptions: {
                            preset: [
                                'default',
                                {
                                    discardComments: { removeAll: true },
                                },
                            ],
                        },
                    }),
                    new UglifyJsPlugin({
                        extractComments: true,
                        parallel: true,
                        uglifyOptions: {
                            output: {
                                comments: false,
                            },
                        },
                    }),
                ],
            },
            devtool: false,
            plugins: [
                new MiniCssExtractPlugin({
                    filename: `../${VendorCompiler.DEST_CSS_DIR}/${VendorCompiler.VENDOR_CSS_FILE}`,
                }),
            ],
            module: {
                rules: [
                    {
                        test: /\.css$/,
                        use: [MiniCssExtractPlugin.loader, 'css-loader'],
                    },
                    {
                        test: /\.(sass|scss)$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            'css-loader',
                            'sass-loader',
                        ],
                    },
                    {
                        test: /\.less$/,
                        use: [
                            MiniCssExtractPlugin.loader,
                            'css-loader',
                            'less-loader',
                        ],
                    },
                    {
                        test: /\.(woff(2)?|ttf|eot|svg|png|jpe?g|gif)$/i,
                        use: ['file-loader'],
                    },
                ],
            },
        };
    }

    /**
     * Bundles plugin vendors
     * @private
     */
    private bundlePluginVendors(): Promise<any> {
        const startTime = new Date().getTime();
        console.log(`⟲ [${this.pluginName}] bundling vendors...`);
        return new Promise<any>((resolve, reject) => {
            const config = this.getPluginWebpackConfig();
            const pluginSpecificConfig = this.getPluginSpecificWebpackConfig();

            this.removeVendors();

            const entryFile = path.resolve(
                this.assetsPath,
                CplaceTypescriptCompiler.DEST_DIR,
                VendorCompiler.VENDOR_ENTRY
            );
            const buffer = fs.readFileSync(entryFile);

            if (!buffer.length) {
                // if entry file is empty, there is no need to bundle
                resolve();
                return;
            }

            const mergedConfig = merge(config, pluginSpecificConfig);
            webpack(mergedConfig, (err, stats) => {
                if (err) {
                    reject(`${err.message}`);
                } else if (stats.hasErrors()) {
                    reject(`${stats.toString()}`);
                } else {
                    const endTime = new Date().getTime();
                    console.log(
                        cgreen`✓`,
                        `[${this.pluginName}] vendors bundled (${formatDuration(
                            endTime - startTime
                        )})`
                    );
                    resolve();
                }
            });
        });
    }

    /**
     * Removes previously generated webpack bundle if exists
     * @private
     */
    private removeVendors(): void {
        const vendorJsFile = path.resolve(
            this.assetsPath,
            CplaceTypescriptCompiler.DEST_DIR,
            VendorCompiler.VENDOR_JS_FILE
        );
        const vendorCssFile = path.resolve(
            this.assetsPath,
            VendorCompiler.DEST_CSS_DIR,
            VendorCompiler.VENDOR_CSS_FILE
        );
        this.removeFileIfExists(vendorJsFile);
        this.removeFileIfExists(vendorCssFile);
    }

    /**
     * Writes vendor.js import to javaScriptIncludesToBeCompressed.txt
     * @private
     */
    private prepareVendorJSForCompression(): void {
        const vendorJsPath = path.resolve(
            this.assetsPath,
            CplaceTypescriptCompiler.DEST_DIR,
            VendorCompiler.VENDOR_JS_FILE
        );
        const javaScriptToBeCompressedPath = path.join(
            this.assetsPath,
            VendorCompiler.JAVASCRIPT_TO_BE_COMPRESSED
        );
        const pathToInclude = `/${CplaceTypescriptCompiler.DEST_DIR}/${VendorCompiler.VENDOR_JS_FILE}`;

        debug(
            `(VendorCompiler) [${this.pluginName}] cleaning JS vendor imports...`
        );
        const noJsVendor = this.cleanVendor(
            vendorJsPath,
            javaScriptToBeCompressedPath,
            pathToInclude
        );
        debug(
            `(VendorCompiler) [${this.pluginName}] JS vendor imports cleaned`
        );

        if (noJsVendor) {
            return;
        }
        this.writeVendorImport(javaScriptToBeCompressedPath, pathToInclude);
    }

    /**
     * Writes vendor.css import to imports.css file
     * @private
     */
    private prepareVendorCSSForCompression(): Promise<any> {
        const vendorCssPath = path.join(
            this.assetsPath,
            VendorCompiler.DEST_CSS_DIR,
            VendorCompiler.VENDOR_CSS_FILE
        );
        const cssFolder = path.join(this.assetsPath, 'css');
        const cssImportsPath = path.join(cssFolder, VendorCompiler.CSS_IMPORTS);
        const pathToInclude = `@import url("../${VendorCompiler.DEST_CSS_DIR}/${VendorCompiler.VENDOR_CSS_FILE}");`;

        if (!fs.existsSync(cssFolder)) {
            fs.mkdirSync(cssFolder);
        }

        debug(
            `(VendorCompiler) [${this.pluginName}] cleaning CSS vendor imports...`
        );
        const noCssVendor = this.cleanVendor(
            vendorCssPath,
            cssImportsPath,
            pathToInclude
        );
        debug(
            `(VendorCompiler) [${this.pluginName}] CSS vendor imports cleaned`
        );

        if (noCssVendor) {
            /*
                If there is no css vendor, css compiler has to be started to clean the css outputs.
             */
            return this.compressCssCompiler.compile();
        }
        const cssEntryBeforeWriteExists = fs.existsSync(cssImportsPath);
        this.writeVendorImport(cssImportsPath, pathToInclude);
        const cssEntryAfterWriteExists = fs.existsSync(cssImportsPath);
        if (!cssEntryBeforeWriteExists && cssEntryAfterWriteExists) {
            /*
                If css entry file doesn't exist at the time cplace-asc started, css watch will not be automatically fired.
                Instead, css compiler has to be triggered manually.
             */
            return this.compressCssCompiler.compile();
        }
        return Promise.resolve(true);
    }

    /**
     * Writes vendor.(css|js) import to correct file
     * @param fileToWrite File the import needs to be written
     * @param pathToInclude Import path to include
     * @private
     */
    private writeVendorImport(
        fileToWrite: string,
        pathToInclude: string
    ): void {
        let buffer = '';

        debug(
            `(VendorCompiler) [${this.pluginName}] Writing vendor imports...`
        );
        if (fs.existsSync(fileToWrite)) {
            buffer = fs.readFileSync(fileToWrite, 'utf8');

            if (buffer.includes(pathToInclude)) {
                let includedPaths = buffer.replace(/\r/g, '').split('\n');
                includedPaths = includedPaths.map((line, index) => {
                    if (index === includedPaths.length - 1) {
                        return line.trim();
                    }
                    return line;
                });
                const index = includedPaths.indexOf(pathToInclude);
                // removes included path if already exists
                includedPaths.splice(index, 1);
                buffer = includedPaths.join('\n');
            }
        }

        const content = this.convertLineEndings(`${pathToInclude}\n` + buffer);
        fs.writeFileSync(fileToWrite, content);
        debug(`(VendorCompiler) [${this.pluginName}] Vendor imports written`);
    }

    private convertLineEndings(content: string): string {
        const isWindows = process.platform === 'win32';
        if (isWindows) {
            return eol.crlf(content);
        }
        return content;
    }

    /**
     * Cleans vendor imports
     * @param vendorFilePath Generated vendor file path
     * @param fileToWrite File to write vendor import
     * @param pathToInclude Import path to include
     * @private
     */
    private cleanVendor(
        vendorFilePath: string,
        fileToWrite: string,
        pathToInclude: string
    ): boolean {
        if (!fs.existsSync(vendorFilePath)) {
            // if there is no file to write import to, skip further process
            if (!fs.existsSync(fileToWrite)) {
                return true;
            }

            let buffer = fs.readFileSync(fileToWrite, 'utf8');

            // if file to write import to, doesn't have any content, remove the file
            if (!buffer.length) {
                this.removeFileIfExists(fileToWrite);
                return true;
            }

            if (buffer.includes(pathToInclude)) {
                // removes included path if already exists
                const includedPaths = buffer.split('\n');
                const index = includedPaths.indexOf(pathToInclude);
                // if file to write imports to, includes vendor import and there is no vendor, remove the import line
                includedPaths.splice(index, 1);
                buffer = includedPaths.join('\n');
                if (!buffer.length) {
                    this.removeFileIfExists(fileToWrite);
                    return true;
                }
                fs.writeFileSync(fileToWrite, buffer);
            }
            return true;
        }
        return false;
    }

    /**
     * Removes the file, if the file exists
     * @param filePath File to remove
     * @private
     */
    private removeFileIfExists(filePath: string): void {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}
