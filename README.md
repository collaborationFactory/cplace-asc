# Document Control / Repository Information

| Item         | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| Owner        | Stefan Stadler, Slaven Kopic, Jan Dittmar                  |
| Team         | none yet                                                   |
| Project      | none                                                       |
| Parent       | none                                                       |
| Developed by | collaboration Factory AG                                   |
| Description  | Unser Kommandozeilen-Werkzeug um Frontend Assets zu bauen. |

# cplace-asc

`cplace-asc` is the new cplace assets compiler toolchain used to compile, bundle and minimize TypeScript, LESS and YAML
sources into their JavaScript and CSS counterparts.

## Installation

Just run the following command which will install the assets compiler globally:

```
$ npm install -g @cplace/asc
```

## Usage

The assets compiler supports multiple parameters:

```
$ cplace-asc --help
⇢ Checking whether newer version is available... ✓


  cplace assets compiler

  Usage:
      $ cplace-asc

  Options:
        --plugin, -p <plugins>  Run for specified plugins (and dependencies) - comma separated list of plugin names
        --watch, -w             Enable watching of source files (continuous compilation)
        --onlypre, -o           Run only preprocessing steps (like create tsconfig.json files)
        --clean, -c             Clean generated output folders at the beginning
        --threads, -t           Maximum number of threads to run in parallel
        --localonly, -l         Enable to not scan other directories than CWD for plugins
        --noparents, -x         Enable to only run compilation on plugins in current repository (still scans for other sources to be present)
        --packagejson, -j       Generate package.json files (if missing) in the root and each plugin that has assets
        --withYaml, -y          Generates TypeScript files from the OpenAPI YAML specification
        --verbose, -v           Enable verbose logging
        --production, -P        Enable production mode (ignores test dependencies and E2E)
```

<table>
    <thead>
    <tr>
        <th width="20%">Option</th>
        <th width="20%">Type (Default)</th>
        <th>Description</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td><code>--plugin / -p</code>/td>
        <td><code>string</code> (*empty*)</td>
        <td>Specify the name of a single plugin for which the assets compiler should be started.<br>Will also compile dependencies of this plugin.</td>
    </tr>
    <tr>
        <td><code>--watch / -w</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled the compiler will watch for changes in any source files and trigger recompilation. All plugins that depend on the modified plugin will also be recompiled.</td>
    </tr>
    <tr>
        <td><code>--onlypre / -o</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When active only preprocessing steps like generating the <code>tsconfig.json</code> files or cleaning the output directories (<code>--clean</code>) will be executed but no compilation.</td>
    </tr>
    <tr>
        <td><code>--clean / -c</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled the assets compiler will first clean any output directories where compiled assets are placed (e.g. <code>generated_js</code> and <code>generated_css</code>).</td>
    </tr>
    <tr>
            <td><code>--production / -P</code>/td>
            <td><code>boolean</code> (<code>false</code>)</td>
            <td>When enabled the assets compiler will ignore dependencies that are marked as <em>TEST</em> scoped. Furthermore, no source maps will be generated.</td>
        </tr>
    <tr>
        <td><code>--verbose / -v</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled verbose logging statements are output in order to facilitate debugging.</td>
    </tr>
    <tr>
        <td><code>--threads / -t</code>/td>
        <td><code>string</code> (*empty*)</td>
        <td>Defines maximum number of threads to run in parallel.</td>
    </tr>
    <tr>
        <td><code>--localonly / -l</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled it doesn't scan other directories than CWD for plugins.</td>
    </tr>
    <tr>
        <td><code>--noparents / -x</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled it only run compilation on plugins in current repository (still scans for other sources to be present).</td>
    </tr>
    <tr>
        <td><code>--packagejson / -j</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled it generates package.json files (if missing) in the root and each plugin that has assets.</td>
    </tr>
    <tr>
        <td><code>--withYaml / -y</code>/td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled it generates TypeScript files from the OpenAPI YAML specification.</td>
    </tr>
    </tbody>
</table>

The tool will automatically check for updates on every run, so you will be prompted with a large message when a newer version is available:

```
$ cplace-asc --help
⇢ Checking whether newer version is available... ✓
!---------------------------------------------!
! A newer version of @cplace/asc is available !
! -> Please update to the latest version:     !
!    npm install -g @cplace/asc               !
!---------------------------------------------!

...
```

## Publishing a new version

To publish a new version on the NPM registry take the following steps:

1. Manually bump the version number in `package.json` as desired (major / minor / patch).
2. Push the update to GitHub.
3. Create a new Release on GitHub:
    1. Create _a new tag_ matching the version you want to publish, e.g. `v0.20.3`.
    2. Put in the proper release notes as description of the Release.
4. On creating the Release (_not as a draft_) the GitHub workflow will run and publish the package to NPM automatically.

## Source File Requirements

### TypeScript

For each plugin there must be one main entry file `assets/ts/app.ts` which will be used as entry point for bundling. As such any other source file must be imported (transitively) by that file.

If you have additional dependencies to typings files that are placed locally in your plugin you have to include an `extra-types.json` file. This file can have the following strucutre:

```json
{
    "declarations": ["relative/path/to/typings/file", "..."],
    "externals": {
        "nameOfImport": "_variableName"
    }
}
```

As you can see you can specify the relative path (taken from the location of the `extra-types.json` file) to any typings definitions (`.d.ts`) file which will then be taken into account by the TypeScript compiler. Furthermore, in order for Webpack to complete the bundling process you most likely will also have to specify the externals that this typings file provides. These are given in the `externals` object. The key must equal to the name of the import in TypeScript (e.g. for `import * as myXs from 'xs'` the key would be `xs`). The value is equal to the global variable name to be resolved by Webpack.

### LESS

For each plugin there must be one main entry file: either `assets/less/plugin.less` _or_ `assets/less/cplace.less`. The generated CSS file will be called `assets/generated_css/plugin.css` _or_ `assets/generated_css/cplace.css` respectively.

### Compress CSS

For each plugin there must be one main entry file `assets/css/imports.css` which will be used as entry point for combining and compressing CSS code.

### YAML

For each plugin there must be one main entry file `assets/api/API.yaml` which will be used as entry point TypeScript generation.

## Details

-   The compiler will spawn at most `X` number of compile processes in parallel where `X` equals the number of cores available on the system.
-   Compilation is run inside a subprocess via a scheduler. Cancelling the assets compiler may leave intermediate processing steps running for a short time in the background.
-   The TypeScript compiler is the one located in the `main` repository's `node_modules` directory.
-   The `clean-css` compiler is the one located in the `main` repository's `node_modules` directory.

## Known Caveats

### Implicit Dependencies

As of version 3.4 the TypeScript compiler supports _incremental_ compilation. As such it tracks which files have to be recompiled due to changes of other source files. However, this does not cover implicit dependencies. See the following example:

**types.ts**:

```typescript
export interface IComputationResult {
    status: number;
    content: string;
}
```

**utils.ts**

```typescript
import { IComputationResult } from './types';
export function computeValue(input: string): IComputationResult {
    let result: IComputationResult;
    // does some magic
    // ...
    return result;
}
```

**component.ts**

```typescript
import { computeValue } from './utils';

export function componentLogic(): void {
    // does some things...
    const result = computeValue('my complex input');

    console.log(result.status, result.content);
}
```

As you can see in the example above, `component.ts` has an implicit dependency on `types.ts` as it has the `result` variable with an inferred type of `IComputationResult`. Changing the `IComputationResult`, e.g. by renaming content to `output`, will _not_ cause a compilation error if the TypeScript compiler is running in watch mode with incremental compilation (_default behavior_). Only a full recompilation will result in the error to be detected.

In order to mitigate this issue you could use the following workaround by explicitly declaring the type of the variable you store the method result in (IntelliJ provides a quickfix for this: "Specify type explicitly"):

**component.ts**

```typescript
import { computeValue } from './utils';
// !! See the new import making the dependency explicit
import { IComputationResult } from './types';

export function componentLogic(): void {
    // does some things...
    // !! See the explicit variable type
    const result: IComputationResult = computeValue('my complex input');

    console.log(result.status, result.content);
}
```
