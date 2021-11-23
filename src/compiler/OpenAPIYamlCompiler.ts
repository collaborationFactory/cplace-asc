import * as path from "path";
import * as rimraf from "rimraf";
import { cerr, debug, formatDuration, GREEN_CHECK } from "../utils";
import { CompilationResult, ICompiler } from "./interfaces";
import spawn = require("cross-spawn");
import * as fs from "fs";

export class OpenAPIYamlCompiler implements ICompiler {
  constructor(
    private readonly pluginName: string,
    private readonly dependencyPaths: string[],
    private readonly assetsPath: string,
    private readonly mainRepoDir: string
  ) {}

  /**
   * Gets path of node_modules executables
   */
  private static getNodeModulesBinPath(): string {
    return path.resolve(__dirname, "../../", "node_modules/.bin/");
  }

  /**
   * Executes provided array of promises sequentially.
   * @param promises Provided array of promises.
   */
  private static async executePromisesSequentially(
    promises: Array<() => Promise<any>>
  ): Promise<any> {
    for (const promise of promises) {
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
        console.log(
          GREEN_CHECK,
          `[${this.pluginName}] OpenAPI YAML finished (${formatDuration(
            end - start
          )})`
        );
        return CompilationResult.CHANGED;
      })
      .catch((err) => {
        return this.cleanup(this.pluginName).finally(() => {
          console.error(cerr`${err}`);
          throw Error(
            `[${this.pluginName}] Failed to write OpenAPI YAML output`
          );
        });
      });
  }

  /**
   * Removes generated data
   * @param plugin Plugin name
   * @private
   */
  private cleanup(plugin: string): Promise<any> {
    return Promise.all([
      //   this.removeGeneratedOpenAPIFiles(plugin),
      this.removePluginDist(plugin),
    ]);
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
      this.convertPluginTypesEOL.bind(this, plugin),
      this.cleanup.bind(this, plugin),
    ]);
  }

  /**
   * Generates types from the API specification and place them in plugin/api/dist/openapi
   * folder. For generation it uses openapi-generator-cli.
   * @param plugin Provided plugin for which types should be generated
   */
  private generatePluginTypes(plugin: string): Promise<any> {
    return new Promise((resolve) => {
      const pluginPath = this.getPluginPath(plugin);
      const cli = path.resolve(
        OpenAPIYamlCompiler.getNodeModulesBinPath(),
        "openapi-generator-cli"
      );
      const yaml = path.resolve(`${pluginPath}/api/API.yaml`);
      const dist = path.resolve(`${pluginPath}/api/dist/openapi`);

      const genArgs =
        `generate -i ${yaml} -g typescript-angular -o ${dist} --additional-properties=ngVersion=6.1.7,npmName=restClient,supportsES6=true,npmVersion=6.9.0,withInterfaces=true`.split(
          " "
        );
      const genRes = spawn.sync(cli, genArgs, {
        stdio: ["pipe", "pipe", process.stderr],
        env: {
          ...process.env,
          PWD: path.resolve(__dirname, "..", ".."),
        },
      });
      if (genRes.status !== 0) {
        const errorMessage = genRes.stdout;
        debug(
          `(OpenAPIYamlCompiler) [${this.pluginName}] OpenAPI YAML compilation failed with error ${errorMessage}`
        );
        throw Error(`[${this.pluginName}] OpenAPI YAML compilation failed...`);
      }
      resolve(true);
    });
  }

  /**
   * Converts EOL from generated files into CRLF in case platform is Windows
   * @param plugin Plugin name
   * @private
   */
  private convertPluginTypesEOL(plugin: string): Promise<any> {
    return new Promise((resolve) => {
      const isWindows = process.platform === "win32";
      if (isWindows) {
        const files = path.join(
          this.getRelativeRepoPath(),
          `${plugin}`,
          "/assets/ts/api/*.ts"
        );
        const eolConverter = path.resolve(
          OpenAPIYamlCompiler.getNodeModulesBinPath(),
          "eolConverter"
        );
        const res = spawn.sync(eolConverter, ["crlf", files], {
          stdio: ["pipe", "pipe", process.stderr],
        });
        if (res.status !== 0) {
          debug(
            `(OpenAPIYamlCompiler) [${this.pluginName}] OpenAPI YAML compilation failed with error ${res.stdout}`
          );
          throw Error(
            `[${this.pluginName}] OpenAPI YAML compilation failed...`
          );
        }
      }
      resolve(true);
    });
  }

  /**
   * Copies plugin types from plugin/api/dist/openapi to plugin/assets/ts/api
   * folder.
   * @param plugin Provided plugin for which types should be copied on the right location.
   */
  private copyPluginTypes(plugin: string): Promise<any> {
    return new Promise((resolve) => {
      const pluginPath = this.getPluginPath(plugin);
      const dist = path.resolve(`${pluginPath}/assets/ts/api/`);
      const modelFolderPath = path.resolve(`${pluginPath}/api/dist/openapi/model`);
      const modelFolderContent = fs.readdirSync(modelFolderPath);
      const files = modelFolderContent.filter( file => file.match(new RegExp(`.*\.(ts)`, 'ig')));
      if (files && files.length) {
        files.forEach(file => {
          const filePath = path.resolve(modelFolderPath, file);
          fs.copyFileSync(filePath, path.resolve(dist, file));
        });
      }
      resolve(true);
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
      rimraf(dist, (err) => {
        if (err) {
          debug(
            `(OpenAPIYamlCompiler) [${this.pluginName}] OpenAPI YAML compilation failed with error ${err.message}`
          );
          throw Error(
            `[${this.pluginName}] OpenAPI YAML compilation failed...`
          );
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
      const dist = path.resolve(`${process.cwd()}/openapitools.json`);
      rimraf(dist, (err) => {
        if (err) {
          debug(
            `(OpenAPIYamlCompiler) [${this.pluginName}] OpenAPI YAML compilation failed with error ${err.message}`
          );
          throw Error(
            `[${this.pluginName}] OpenAPI YAML compilation failed...`
          );
        }
        resolve(true);
      });
    });
  }

  /**
   * Gets relative repository path
   * @private
   */
  private getRelativeRepoPath(): string {
    const repo = path.basename(this.getRepoPath());
    const workingDir = path.basename(path.resolve(process.cwd()));
    return repo !== workingDir ? path.join("..", repo) : "";
  }

  /**
   * Gets absolute repo path
   * @private
   */
  private getRepoPath(): string {
    const workingDir = path.resolve(process.cwd());
    if (this.assetsPath.includes(workingDir)) {
      return workingDir;
    } else {
      return path.join(this.assetsPath, "../..");
    }
  }

  /**
   * Gets the plugin path
   * @param plugin Provided plugin name
   */
  private getPluginPath(plugin): string {
    return path.resolve(this.getRepoPath(), this.pluginName);
  }
}
