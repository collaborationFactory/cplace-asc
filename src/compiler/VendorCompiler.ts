import {CompilationResult, ICompiler} from "./interfaces";
import * as fs from 'fs';
import * as path from "path";
import {NPMResolver} from "../model/NPMResolver";
import {cgreen, formatDuration} from "../utils";
import {Configuration} from "webpack";
import * as webpack from "webpack";
import spawn = require("cross-spawn");
import * as crypto from "crypto";
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');

export class VendorCompiler implements ICompiler {
    public static readonly DEST_JS_DIR = 'generated_js';
    public static readonly DEST_CSS_DIR = 'css';
    private static readonly VENDOR_ENTRY = 'index.js';
    private static readonly VENDOR_ENTRY_HASH = 'index.js.hash';
    private static readonly VENDOR_JS_FILE = 'vendor.js';
    private static readonly VENDOR_CSS_FILE = 'vendor.css';
    private static readonly JAVASCRIPT_TO_BE_COMPRESSED = 'javaScriptIncludesToBeCompressed.txt';
    private static readonly CSS_IMPORTS = 'imports.css';

    constructor(private readonly pluginName: string,
                private readonly dependencyPaths: string[],
                private readonly assetsPath: string,
                private readonly mainRepoDir: string) {
    }

    /**
     * Compiles plugin vendors
     */
    public async compile(): Promise<CompilationResult> {
        console.log(`⟲ [${this.pluginName}] starting vendors compilation...`);
        const startTime = new Date().getTime();

        const dependenciesWereUpdated = await NPMResolver.installPluginDependenciesAndCreateHash(this.pluginName, this.assetsPath);

        this.tscPluginIndex();

        const oldIndexHash = this.readIndexHash();
        const newIndexHash = this.createIndexHashFile();

        if (oldIndexHash === newIndexHash && !dependenciesWereUpdated) {
            console.log(cgreen`✓`, `[${this.pluginName}] vendors are up to date`);
            return Promise.resolve(CompilationResult.CHANGED);
        }

        await this.bundlePluginVendors();
        this.prepareVendorJSForCompression();
        this.prepareVendorCSSForCompression();

        const endTime = new Date().getTime();
        console.log(cgreen`✓`, `[${this.pluginName}] vendors compiled (${formatDuration(endTime - startTime)})`);

        return Promise.resolve(CompilationResult.CHANGED);
    }

    /**
     * Compiles plugin index.ts
     * @private
     */
    private tscPluginIndex(): void {
        const tsc = path.resolve(__dirname, '../../', 'node_modules/.bin/tsc');
        const index = path.join(this.assetsPath, 'index.ts');
        if (!fs.existsSync(index)) {
            throw Error(`[${this.pluginName}] index.ts not found!`);
        }
        const res = spawn.sync(tsc, [path.join(this.assetsPath, 'index.ts'), `--outDir`, path.resolve(this.assetsPath, VendorCompiler.DEST_JS_DIR)]);
        if (res.status !== 0) {
            throw Error(`[${this.pluginName}] index.ts TS compilation failed!`);
        }
    }

    /**
     * Reads index.js.hash
     * @private
     */
    private readIndexHash(): string | null {
        const hashPath = this.getIndexHashFilePath();
        if (fs.existsSync(hashPath)) {
            return fs.readFileSync(hashPath, {encoding: 'utf8'});
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
        fs.writeFileSync(
            this.getIndexHashFilePath(),
            hash,
            {encoding: 'utf8'}
        );
        return hash;
    }

    /**
     * Gets index.js hash
     * @private
     */
    private getHash4Index(): string {
        const hash = crypto.createHash('sha256');
        const data = fs.readFileSync(path.join(this.assetsPath, VendorCompiler.DEST_JS_DIR, VendorCompiler.VENDOR_ENTRY));
        hash.update(data);
        return hash.digest('hex');
    }

    /**
     * Gets index.js.hash file path
     * @private
     */
    private getIndexHashFilePath(): string {
        return path.join(this.assetsPath, VendorCompiler.DEST_JS_DIR, VendorCompiler.VENDOR_ENTRY_HASH);
    }


    /**
     * Gets plugin webpack config
     * @private
     */
    private getPluginWebpackConfig(): Configuration {
        return {
            mode: 'production',
            entry: path.resolve(this.assetsPath, VendorCompiler.DEST_JS_DIR, VendorCompiler.VENDOR_ENTRY),
            output: {
                path: path.resolve(this.assetsPath, VendorCompiler.DEST_JS_DIR),
                filename: VendorCompiler.VENDOR_JS_FILE
            },
            resolveLoader: {
                modules: [path.resolve(__dirname, '../../', 'node_modules')]
            },
            resolve: {
                modules: [path.resolve(this.assetsPath, 'node_modules')]
            },
            optimization: {
                minimize: true,
                minimizer: [
                    new OptimizeCSSAssetsPlugin({
                        cssProcessorPluginOptions: {
                            preset: ['default', { discardComments: { removeAll: true } }],
                        }
                    })
                ]
            },
            devtool: false,
            plugins: [
                new MiniCssExtractPlugin({
                    filename: `../${VendorCompiler.DEST_CSS_DIR}/${VendorCompiler.VENDOR_CSS_FILE}`
                })
            ],
            module: {
                rules: [
                    {
                        test: /\.(css|less|scss|sass)$/i,
                        use: [
                            MiniCssExtractPlugin.loader,
                            'css-loader',
                            'less-loader',
                            'sass-loader'
                        ]
                    }
                ]
            }
        }
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

            // remove previously generated webpack bundle if exists (so it does not append)
            const vendorJsFile = path.resolve(this.assetsPath, VendorCompiler.DEST_JS_DIR, VendorCompiler.VENDOR_JS_FILE)
            const vendorCssFile = path.resolve(this.assetsPath, VendorCompiler.DEST_CSS_DIR, VendorCompiler.VENDOR_CSS_FILE);

            this.removeFileIfExists(vendorJsFile);
            this.removeFileIfExists(vendorCssFile);

            webpack(config, (err, stats) => {
                if (err) {
                    reject(`${err.message}`);
                } else if (stats.hasErrors()) {
                    reject(`${stats.toString()}`);
                } else {
                    const endTime = new Date().getTime();
                    console.log(cgreen`✓`, `[${this.pluginName}] vendors bundled (${formatDuration(endTime - startTime)})`);
                    resolve();
                }
            });
        });
    }

    /**
     * Writes vendor.js import to javaScriptIncludesToBeCompressed.txt
     * @private
     */
    private prepareVendorJSForCompression(): void {
        const vendorJsPath = path.resolve(this.assetsPath, VendorCompiler.DEST_JS_DIR, VendorCompiler.VENDOR_JS_FILE);
        const javaScriptToBeCompressedPath = path.join(this.assetsPath, VendorCompiler.JAVASCRIPT_TO_BE_COMPRESSED);
        const pathToInclude = `/${VendorCompiler.DEST_JS_DIR}/${VendorCompiler.VENDOR_JS_FILE}`;

        const noJsVendor = this.cleanVendor(vendorJsPath, javaScriptToBeCompressedPath, pathToInclude);

        if (noJsVendor) {
            return;
        }
        this.writeVendorImport(javaScriptToBeCompressedPath, pathToInclude);
    }

    /**
     * Writes vendor.js import to javaScriptIncludesToBeCompressed.txt
     * @private
     */
    private prepareVendorCSSForCompression(): void {
        const vendorCssPath = path.join(this.assetsPath, VendorCompiler.DEST_CSS_DIR, VendorCompiler.VENDOR_CSS_FILE);
        const cssImportsPath = path.join(this.assetsPath, VendorCompiler.DEST_CSS_DIR, VendorCompiler.CSS_IMPORTS);
        const pathToInclude = `@import url("./${VendorCompiler.VENDOR_CSS_FILE}");`;

        const noCssVendor = this.cleanVendor(vendorCssPath, cssImportsPath, pathToInclude);

        if (noCssVendor) {
            return;
        }
        this.writeVendorImport(cssImportsPath, pathToInclude);
    }

    /**
     * Writes vendor.(css|js) import to correct file
     * @param fileToWrite File the import needs to be written
     * @param pathToInclude Import path to include
     * @private
     */
    private writeVendorImport(fileToWrite: string, pathToInclude: string): void {
        let buffer = '';

        if (fs.existsSync(fileToWrite)) {
            buffer = fs.readFileSync(fileToWrite, 'utf8');

            if (buffer.includes(pathToInclude)) {
                // removes included path if already exists
                const includedPaths = buffer.split('\n');
                const index = includedPaths.indexOf(pathToInclude);
                includedPaths.splice(index, 1);
                buffer = includedPaths.join('\n');
            }
        }

        const content = buffer + `\n${pathToInclude}`;
        fs.writeFileSync(fileToWrite, content);
    }

    /**
     * Cleans vendor imports
     * @param vendorFilePath Generated vendor file path
     * @param fileToWrite File to write vendor import
     * @param pathToInclude Import path to include
     * @private
     */
    private cleanVendor(vendorFilePath: string, fileToWrite: string, pathToInclude: string): boolean {
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
                // if file to write import to includes vendor import and there is no vendor, remove the import line
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
