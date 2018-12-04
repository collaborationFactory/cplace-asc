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

|      Option      |   Type (Default)    |                                                                               Description                                                                               |
| ---------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--plugin / -p`  | `string` (*empty*)  | Specify the name of a single plugin for which the assets compiler should be started.<br>Will also compile dependencies of this plugin.                                  |
| `--watch / -w`   | `boolean` (`false`) | When enabled the compiler will watch for changes in any source files and trigger recompilation. All plugins that depend on the modified plugin will also be recompiled. |
| `--onlypre / -o` | `boolean` (`false`) | When active only preprocessing steps like generating the `tsconfig.json` files or cleaning the output directories (`--clean`) will be executed but no compilation.      |
| `--clean / -c`   | `boolean` (`false`) | When enabled the assets compiler will first clean any output directories where compiled assets are placed (e.g. `generated_js` and `generated_css`).                    |
| `--verbose / -v` | `boolean` (`false`) | When enabled verbose logging statements are output in order to facilitate debugging.                                                                                    |
## Details

- The compiler will spawn at most `X` number of compile processes in parallel where `X` equals the number of cores available on the system.
- Compilation is run inside a subprocess via a scheduler. Cancelling the assets compiler may leave intermediate processing steps running for a short time in the background.
