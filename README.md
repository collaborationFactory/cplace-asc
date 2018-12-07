# cplace-asc

`cplace-asc` is the cplace assets compiler toolchain used to compile TypeScript and LESS sources into their JavaScript and CSS counterparts.

## Usage

The assets compiler supports multiple parameters:

```
$ cplace-asc --help

  cplace assets compiler

  Usage:
      $ cplace-asc

  Options:
      --plugin, -p <plugin>   Run for specified plugin (and dependencies)
      --watch, -w             Enable watching of source files (continuous compilation)
      --onlypre, -o           Run only preprocessing steps (like create tsconfig.json files)
      --clean, -c             Clean generated output folders at the beginning
      --verbose, -v           Enable verbose logging
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
        <td><code>--plugin / -p</code<</td>
        <td><code>string</code> (*empty*)</td>
        <td>Specify the name of a single plugin for which the assets compiler should be started.<br>Will also compile dependencies of this plugin.</td>
    </tr>
    <tr>
        <td><code>--watch / -w</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled the compiler will watch for changes in any source files and trigger recompilation. All plugins that depend on the modified plugin will also be recompiled.</td>
    </tr>
    <tr>
        <td><code>--onlypre / -o</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When active only preprocessing steps like generating the <code>tsconfig.json</code> files or cleaning the output directories (<code>--clean</code>) will be executed but no compilation.</td>
    </tr>
    <tr>
        <td><code>--clean / -c</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled the assets compiler will first clean any output directories where compiled assets are placed (e.g. <code>generated_js</code> and <code>generated_css</code>).</td>
    </tr>
    <tr>
        <td><code>--verbose / -v</code<</td>
        <td><code>boolean</code> (<code>false</code>)</td>
        <td>When enabled verbose logging statements are output in order to facilitate debugging.</td>
    </tr>
    </tbody>
</table>

## Details

- The compiler will spawn at most `X` number of compile processes in parallel where `X` equals the number of cores available on the system.
- Compilation is run inside a subprocess via a scheduler. Cancelling the assets compiler may leave intermediate processing steps running for a short time in the background.
