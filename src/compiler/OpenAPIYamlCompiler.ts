import {CompilationResult, ICompiler} from "./interfaces";
import {cerr, formatDuration, GREEN_CHECK} from "../utils";
import * as cpx from "cpx";
import * as rimraf from "rimraf";
import * as path from "path";
import spawn = require("cross-spawn");

export class OpenAPIYamlCompiler implements ICompiler {

    constructor(private readonly pluginName: string,
                private readonly dependencyPaths: string[],
                private readonly assetsPath: string,
                private readonly mainRepoDir: string) {
    }

    /**
     * Gets path of node_modules executables
     */
    private static getNodeModulesBinPath(): string {
        return path.resolve(__dirname, '../../', 'node_modules/.bin/');
    }

    /**
     * Executes provided array of promises sequentially.
     * @param promises Provided array of promises.
     */
    private static async executePromisesSequentially(promises: Array<() => Promise<any>>): Promise<any> {
        for(const promise of promises) {
            await promise();
        }
    }

    /**
     * Compiles OpenAPI yaml
     */
    public compile(): Promise<CompilationResult> {
        console.log(`⟲ [${this.pluginName}] starting OpenAPI YAML compilation...`);
        const start = new Date().getTime();
        return this.buildPluginTypes(this.pluginName)
            .then(() => {
                let end = new Date().getTime();
                console.log(GREEN_CHECK, `[${this.pluginName}] OpenAPI YAML finished (${formatDuration(end - start)})`);
                return CompilationResult.CHANGED;
            })
            .catch((err) => {
                console.error(cerr`${err}`);
                throw Error(`[${this.pluginName}] Failed to write OpenAPI YAML output`);
            });
    }

    /**
     *  Builds types for a provided plugin. First it generates types, than it
     *  copies types in plugin/assets/ts/api folder, and at the end it cleans
     *  the distribution folder.
     * @param plugin Provided plugin
     */
    private buildPluginTypes(plugin: string): Promise<any> {
        return OpenAPIYamlCompiler.executePromisesSequentially([
            this.generatePluginTypes.bind(this, plugin),
            this.copyPluginTypes.bind(this, plugin),
            this.removePluginDist.bind(this, plugin),
            this.removeGeneratedOpenAPIFiles.bind(this, plugin)
        ]).catch(err => {
            console.error(cerr`${err}`);
        });
    }

    /**
     * Generates types from the API specification and place them in plugin/api/dist/openapi
     * folder. For generation it uses openapi-generator-cli.
     * @param plugin Provided plugin for which types should be generated
     */
    private generatePluginTypes(plugin: string): Promise<any> {
        return new Promise((resolve) => {
            const pluginPath = this.getPluginPath(plugin);
            const cli = path.resolve(OpenAPIYamlCompiler.getNodeModulesBinPath(), 'openapi-generator-cli');
            const yaml = path.resolve(`${pluginPath}/api/API.yaml`);
            const dist = path.resolve(`${pluginPath}/api/dist/openapi`);
            const vmArgs = 'version-manager set 5.0.0'.split(' ');
            const vmRes = spawn.sync(cli, vmArgs, {
                stdio: ['pipe', 'pipe', process.stderr]
            });
            const genArgs = `generate -i ${yaml} -g typescript-angular -o ${dist} --additional-properties=ngVersion=6.1.7,npmName=restClient,supportsES6=true,npmVersion=6.9.0,withInterfaces=true`.split(' ');
            const genRes = spawn.sync(cli, genArgs, {
                stdio: ['pipe', 'pipe', process.stderr]
            });
            if (vmRes.status !== 0 || genRes.status !== 0) {
                throw Error(`[${this.pluginName}] OpenAPI YAML compilation failed...`);
            }
            resolve(true);
        });
    }

    /**
     * Copies plugin types from plugin/api/dist/openapi to plugin/assets/ts/api
     * folder. For copying it uses cpx node module.
     * @param plugin Provided plugin for which types should be copied on the right location.
     */
    private copyPluginTypes(plugin: string): Promise<any> {
        return new Promise((resolve) => {
            const pluginPath = this.getPluginPath(plugin);
            const files = path.resolve(`${pluginPath}/api/dist/openapi/model/**/*.ts`);
            const dist = path.resolve(`${pluginPath}/assets/ts/api/`);
            cpx.copy(files, dist, err => {
                if (err) {
                    throw Error(`[${this.pluginName}] OpenAPI YAML compilation failed...`);
                }
                resolve(true);
            });
        });
    }

    /**
     * Removes plugin/api/dist/openapi folder. For deletion it uses rimraf node module.
     * @param plugin Provided plugin for which dist/openapi folder should be removed.
     */
    private removePluginDist(plugin: string): Promise<any> {
        return new Promise((resolve) => {
            const pluginPath = this.getPluginPath(plugin);
            const dist = path.resolve(`${pluginPath}/api/dist/openapi`);
            rimraf(dist, err => {
                if (err) {
                    throw Error(`[${this.pluginName}] OpenAPI YAML compilation failed...`);
                }
                resolve(true);
            });
        });
    }

    /**
     * Removes auto generated OpenAPI files. For deletion it uses rimraf node module.
     * @param plugin Provided plugin for which auto generated OpenAPI files should be removed.
     */
    private removeGeneratedOpenAPIFiles(plugin: string): Promise<any> {
        return new Promise((resolve) => {
            const dist = path.resolve(`${this.mainRepoDir}/openapitools.json`);
            rimraf(dist, err => {
                if (err) {
                    throw Error(`[${this.pluginName}] OpenAPI YAML compilation failed...`);
                }
                resolve(true);
            });
        });
    }

    /**
     * Gets the plugin path
     * @param plugin Provided plugin name
     */
    private getPluginPath(plugin): string {
        return path.resolve(this.mainRepoDir, this.pluginName);
    }
}
