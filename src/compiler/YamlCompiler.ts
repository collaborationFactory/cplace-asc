import {CompilationResult, ICompiler} from "./interfaces";
import {cerr, formatDuration, GREEN_CHECK} from "../utils";
import * as cpx from "cpx";
import * as rimraf from "rimraf";
import * as path from "path";
import {exec} from "child_process";

export class YamlCompiler implements ICompiler {

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
     * Compiles yaml
     */
    public compile(): Promise<CompilationResult> {
        console.log(`⟲ [${this.pluginName}] starting YAML compilation...`);
        const start = new Date().getTime();
        return new Promise<CompilationResult>((resolve) => {
            return this.buildPluginTypes(this.pluginName)
                .then(() => {
                    let end = new Date().getTime();
                    console.log(GREEN_CHECK, `[${this.pluginName}] YAML finished (${formatDuration(end - start)})`);
                    resolve(CompilationResult.CHANGED);
                })
                .catch((err) => {
                    console.error(cerr`${err}`);
                    throw Error(`[${this.pluginName}] Failed to write YAML output`);
                });
        });
    }

    /**
     *  Builds types for a provided plugin. First it generates types, than it
     *  copies types in plugin/assets/ts/api folder, and at the end it cleans
     *  the distribution folder.
     * @param plugin Provided plugin
     */
    private buildPluginTypes(plugin: string): Promise<any> {
        return YamlCompiler.executePromisesSequentially([
            this.generatePluginTypes.bind(this, plugin),
            this.copyPluginTypes.bind(this, plugin),
            this.removePluginDist.bind(this, plugin),
            this.removeGeneratedOpenAPIFiles.bind(this, plugin)
        ]);
    }

    /**
     * Generates types from the API specification and place them in plugin/api/dist/openapi
     * folder. For generation it uses openapi-generator-cli.
     * @param plugin Provided plugin for which types should be generated
     */
    private generatePluginTypes(plugin: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const pluginPath = this.getPluginPath(plugin);
            const cli = path.resolve(YamlCompiler.getNodeModulesBinPath(), 'openapi-generator-cli');
            const yaml = path.resolve(`${pluginPath}/api/API.yaml`);
            const dist = path.resolve(`${pluginPath}/api/dist/openapi`);
            const cmd = `${cli} version-manager set 5.0.0 && ${cli} generate -i ${yaml} -g typescript-angular -o ${dist} --additional-properties=ngVersion=6.1.7,npmName=restClient,supportsES6=true,npmVersion=6.9.0,withInterfaces=true`;
            exec(cmd, err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(true);
            });
        });
    }

    /**
     * Copies plugin types from plugin/api/dist/openapi to plugin/assets/ts/api
     * folder. For copying it uses cpx node module.
     * @param plugin Provided plugin for which types should be copied on the right location.
     */
    private copyPluginTypes(plugin: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const pluginPath = this.getPluginPath(plugin);
            const files = path.resolve(`${pluginPath}/api/dist/openapi/model/**/*.ts`);
            const dist = path.resolve(`${pluginPath}/assets/ts/api/`);
            cpx.copy(files, dist, err => {
                if (err) {
                    reject(err);
                    return;
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
        return new Promise((resolve, reject) => {
            const pluginPath = this.getPluginPath(plugin);
            const dist = path.resolve(`${pluginPath}/api/dist/openapi`);
            rimraf(dist, err => {
                if (err) {
                    reject(err);
                    return;
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
        return new Promise((resolve, reject) => {
            const dist = path.resolve(`${this.mainRepoDir}/openapitools.json`);
            rimraf(dist, err => {
                if (err) {
                    reject(err);
                    return;
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
