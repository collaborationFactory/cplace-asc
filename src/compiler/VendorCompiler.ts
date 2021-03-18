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

export class VendorCompiler implements ICompiler {
    public static readonly DEST_JS_DIR = 'generated_js';
    public static readonly DEST_CSS_DIR = 'generated_css';
    private static readonly VENDOR_ENTRY = 'index.js';
    private static readonly VENDOR_ENTRY_HASH = 'index.js.hash';
    private static readonly VENDOR_JS_FILE = 'vendor.js';
    private static readonly VENDOR_CSS_FILE = 'vendor.css';
    private static readonly JAVASCRIPT_TO_BE_COMPRESSED = 'javaScriptIncludesToBeCompressed.txt'

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

        const oldHash = this.readIndexHash();
        const newHash = this.createIndexHashFile();

        if (oldHash === newHash && !dependenciesWereUpdated) {
            console.log(cgreen`✓`, `[${this.pluginName}] vendors are up to date`);
            return Promise.resolve(CompilationResult.CHANGED);
        }

        await this.bundlePluginVendors();
        await this.prepareVendorsForCompression(this.assetsPath);

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
            resolve: {
                modules: ['node_modules']
            },
            optimization: {
                minimize: true
            },
            devtool: false,
            plugins: [
                new MiniCssExtractPlugin({
                    filename: path.resolve(this.assetsPath, `${VendorCompiler.DEST_CSS_DIR}/${VendorCompiler.VENDOR_CSS_FILE}`)
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
            const bundleFile = path.resolve(this.assetsPath, VendorCompiler.DEST_JS_DIR, VendorCompiler.VENDOR_JS_FILE)
            if (fs.existsSync(bundleFile)) {
                fs.unlinkSync(bundleFile);
            }

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
     * @param assetsPath Provided assets path
     * @private
     */
    private prepareVendorsForCompression(assetsPath: string): Promise<any> {

        return new Promise<any>((resolve, reject) => {
            const javaScriptToBeCompressedPath = path.join(assetsPath, VendorCompiler.JAVASCRIPT_TO_BE_COMPRESSED);

            fs.readFile(javaScriptToBeCompressedPath, 'utf8', (err, buff) => {

                if (err) {
                    reject(`Error reading ${javaScriptToBeCompressedPath}`);
                }

                const pathToInclude = `/${VendorCompiler.DEST_JS_DIR}/${VendorCompiler.VENDOR_JS_FILE}`;
                if (buff.includes(pathToInclude)) {
                    // removes included path if already exists
                    const includedPaths = buff.split('\n');
                    const index = includedPaths.indexOf(pathToInclude);
                    includedPaths.splice(index, 1);
                    buff = includedPaths.join('\n');
                }

                const content = buff + `\n${pathToInclude}`;

                fs.writeFile(javaScriptToBeCompressedPath, content, (e) => {
                    if (e) {
                        reject(`Error writing ${pathToInclude} to ${javaScriptToBeCompressedPath}`);
                    }
                    resolve(true);
                });
            });
        });
    }
}
