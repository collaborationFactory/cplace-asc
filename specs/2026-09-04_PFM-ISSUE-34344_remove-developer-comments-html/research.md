---
date: 2026-09-07T00:00:00+02:00
git_commit: f08786c34b940e3264548d6f1510057e8624b65c
branch: fix/PFM-ISSUE-34344-Remove-developer-comments-in-3.0.x
topic: 'Production-build stripping of developer comments from asc-compiled HTML templates (pentest finding 4.1.1)'
tags:
    [
        research,
        security,
        pentest,
        information-disclosure,
        cplace-asc,
        webpack,
        terser,
        html-comments,
    ]
status: complete
last_updated: 2026-09-07
---

# Research: Comment stripping in cplace-asc — asc share

**Date**: 2026-09-07
**Git Commit**: `f08786c34b940e3264548d6f1510057e8624b65c` (base: `origin/3.0.x`, version `3.0.1`)
**Branch**: `fix/PFM-ISSUE-34344-Remove-developer-comments-in-3.0.x`

> **Split note.** This is the `cplace-asc` share of a three-repo change. The build configuration for
> server-side engine templates lives in `cplace-customer-repo-skeleton` under the same topic
> directory; the originating research and the verification fixtures live in `main`
> (`specs/2026-09-04_PFM-ISSUE-34344_remove-developer-comments-html/research.md`, commit
> `6d46db7c570e46ff9a22538f535031d9f54bdafc`), which remains the cross-repo index.

## Research Question

Pentest finding 4.1.1 (cirosec APP-21233, CVSS 4.0 = 6.9 Medium) concerns developer comments shipping
in server-side HTML. That finding lives entirely in cplace's own template engine, which `cplace-asc`
cannot reach. asc is nonetheless in scope by explicit decision, as **defense in depth**:

> "I want to strip out comments from `.html` | `.htm` files that are being processed by server side
> rendering engine and `.html` files that are compiled with cplace-asc (just in case someone adds some
> comments in those as well)."

This repo's question: **where in asc's pipeline does a comment strip belong, what does it cover, and
what does it actually remove today?**

## Summary

**1. asc reaches 59 templates across 4 repos, and they contain exactly one comment.** This is
prophylactic work, not remediation. The one comment lives in a repo that will not receive this fix.

**2. Templates reach output by two independent routes**, so a single hook is insufficient:
`copyStaticFiles()` copies them verbatim, and a `raw-loader` rule inlines them into bundles.

**3. The extension set is already defined and is exactly ours**: `STATIC_IMPORT_EXTENSIONS = 'html|htm'`.

**4. `this.isProduction` already exists** and is already threaded through the compiler, so the gating
requirement needs no new plumbing.

**5. Nothing in the ecosystem consumes asc 3.x.** Every repo pins `~2.3` or older. A 3.0.x-only change
therefore has no active effect anywhere today — this was decided knowingly and is recorded as a risk,
not an oversight.

## Detailed Findings

### 1. The asc pipeline and the two routes templates take

`src/compiler/CplaceTypescriptCompiler.ts` (on `3.0.x`):

```
:35   public  static readonly DEST_DIR = 'generated_js';
:36   private static readonly ENTRY = 'app.js';
:37   private static readonly STATIC_IMPORT_EXTENSIONS = 'html|htm';
:51   isProduction: boolean          (constructor parameter)
:58   isProduction,                  (assigned to the instance)
:99   await this.copyStaticFiles();
:218  if (!this.isProduction) { … }  (existing production branch)
:257  private async copyStaticFiles(): Promise<void> { … }
:259  const srcGlob = `${tsAssetsPath}/**/*.+(${CplaceTypescriptCompiler.STATIC_IMPORT_EXTENSIONS})`;
```

**Route 1 — verbatim copy.** `copyStaticFiles()` (`:257-281`) globs
`assets/ts/**/*.+(html|htm)` and runs `copyFiles([srcGlob, dest], options, cb)` into
`assets/generated_js/`. No transformation whatsoever. This is why `assets/generated_js/` is a
byte-identical mirror of the templates in `assets/ts/**`.

**Route 2 — bundled via `raw-loader`.** The webpack module rule at `:157-169`:

```js
{
    test: new RegExp(`\.(${CplaceTypescriptCompiler.STATIC_IMPORT_EXTENSIONS})$`),   // :160
    use: [ { loader: path.dirname(require.resolve('raw-loader')) } ],                // :164-167
}
```

Templates `import`ed from TypeScript are inlined as strings into the bundle. A strip on Route 1 alone
would leave these unprocessed, and vice versa — hence both hooks are needed.

`STATIC_IMPORT_EXTENSIONS = 'html|htm'` is a useful accident: the extension set asc already treats as
static imports is precisely the set this ticket targets, so no new glob has to be invented.

### 2. Production gating already exists

`isProduction` arrives as a constructor parameter (`:51`), is stored on the instance (`:58`) and is
already branched on at `:218`. asc is invoked in production mode by the external
`cf.cplace.build:cplace-gradle-plugin` (`AscTask`) as:

```
node_modules/.bin/cplace-asc --clean --production --noparents --cplaceversion <version>
```

So a production-gated strip fires in a real `./gradlew build` with no plugin change and no new flag.

### 3. What asc actually reaches — the corpus

Templates under `assets/ts/**` across the entire local workspace:

| Repo                      | Templates | Files with comments | Comments |
| ------------------------- | --------- | ------------------- | -------- |
| `cplace-forms-wizard`     | 34        | **1**               | **1**    |
| `main`                    | 20        | 0                   | 0        |
| `cplace-mini`             | 4         | 0                   | 0        |
| `cplace-project-planning` | 1         | 0                   | 0        |
| **Total**                 | **59**    | **1**               | **1**    |

The single comment is in
`cplace-forms-wizard/cf.cplace.formsWizard/assets/ts/wizard-manager/wizardManager.html`.

Two consequences worth stating plainly:

-   **`main` has zero comments in its 20 asc-world templates**, so an asc strip is a no-op for the repo
    the ticket targets. The originating research reached the same conclusion and called `cplace-asc`
    "the wrong lever" for the pentest finding — which is correct; asc is included here for future
    protection, not for this finding.
-   The one comment that exists is in `cplace-forms-wizard`, which pins asc `~2.3` and therefore will
    not receive a 3.0.x change. **After this ticket, the only comment asc could strip today still
    ships.**

### 4. Version lines and who consumes them

| Ref             | `package.json` version         |
| --------------- | ------------------------------ |
| `origin/3.0.x`  | **3.0.1** ← this branch's base |
| `origin/2.3.x`  | 2.3.8                          |
| `origin/master` | 2.3.6                          |

Tags: `v3.0.1` plus `v3.0.1-rc.1` … `rc.5`, then `v2.3.8` downward.

`origin/3.0.x` and `origin/master` are **divergent, both-maintained lines**: 110 commits on 3.0.x not
on master, 29 on master not on 3.0.x. Both received the immediately preceding ticket on the same day —
`PFM-ISSUE-33498 Remove orphaned angular-digest-hud license fixture`, 2026-09-03, on master as
`9277c24` and on 3.0.x as `f08786c`. So the established convention for that ticket was **both lines**.

**Consumer pins across the workspace:**

| Version spec | Repos                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `~2.3`       | `cplace-customer-repo-skeleton`, `cplace-arorian-codebeamer`, `cplace-citizen-ai`, `cplace-forms-wizard`, `cplace-integration-all-products`, `cplace-jira`, `cplace-loomeo`, `cplace-pro-code-training`, `cplace-project-planning`, `cplace-remote-filesystem`, `cplace-resource-management`, `cplace-rest`, `cplace-rest-client`, `cplace-scim2`, `cplace-soap` (15) |
| `2.3.8`      | `main`                                                                                                                                                                                                                                                                                                                                                                |
| `2.3.3`      | `cplace-paw`                                                                                                                                                                                                                                                                                                                                                          |
| `~2.1`       | `cplace-time-bounded-values`, `cplace-workflow`                                                                                                                                                                                                                                                                                                                       |
| **3.x**      | **none**                                                                                                                                                                                                                                                                                                                                                              |

Note that the skeleton itself pins `~2.3`, so newly created customer repos also start on 2.3.x. When
the ecosystem does migrate to asc 3.x, that bump belongs in the skeleton's `package.json`.

### 5. Tooling already in asc

From `3.0.x` `package.json` devDependencies:

```
terser-webpack-plugin  5.3.6      ← terser is already here
raw-loader             4.0.2      ← the template loader
uglify-loader          3.0.0
css-loader             6.7.3
less-loader            7.3.0
sass-loader            12.6.0
script-loader          0.7.2
source-map-loader      3.0.2
expose-loader          1.0.3
file-loader            6.2.0
imports-loader         1.2.0
```

**There is no HTML minifier.** `html-minifier-terser` — the tool chosen for the server-side share —
would be a new dependency here, though terser itself is already present, and asc is already a
Node/webpack project, so the tool is a natural fit rather than a foreign one.

Using the same tool with the same configuration in both worlds is the point: it keeps one rule rather
than two implementations that can disagree.

### 6. The agreed comment model, and why asc's corpus makes it easy

The rule settled during design:

-   Strip `<!-- … -->` anywhere in the file.
-   Inside `<script>` / `<style>` blocks, additionally strip `//` (to end of line) and `/* … */`.

On the server side this rule needed careful validation because of three load-bearing constructs. **In
asc's corpus none of them are present:**

| Construct                                             | Server-side (`main`, 681 files)                 | asc-world (59 files)                            |
| ----------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `<script …><!-- … //--></script>` script-hiding idiom | 2 files                                         | **0**                                           |
| `<!--[if …]>` conditional comments                    | 0 (all were in the out-of-scope Thymeleaf file) | **0**                                           |
| `//` as displayed content in `<pre>`                  | 1 file (`getHelpMarkup.htm`)                    | **0**                                           |
| `<script type="text/ng-template">` markup blocks      | 132 blocks                                      | not surveyed; corpus is 59 files with 1 comment |

Verified directly: a multi-line scan for `<script\b[^>]*>\s*<!--` across all 20 of `main`'s asc-world
templates returns zero hits.

So asc's strip carries materially less risk than the server-side one — its corpus is 59 files with a
single comment and none of the hazardous shapes.

### 7. Why asc cannot help with the pentest finding itself

asc's visibility is limited to `assets/**`. The 681 server-side templates in
`cf.cplace.platform/src/main/resources/**` are never seen by it under any configuration, and they are
where all of the pentest's cited leaks live:

```
htmlPageHeader.htm:5,7                       _debug_timing / _debug_times comments
templateJavaScript.htm:7-9                   FRONTEND CORE SQUAD ownership hint
templateJavaScript.htm:23-29                 iteratorSome JSDoc
templateJavaScript.htm:79,106                globals.d.ts / AdditionalAngularModulesExtension
mainPage.htm:10                              MainPage.java / allBodyClassesAsString
angularControlComponents.htm:6               cross-template reuse note
angularTemplates.htm:24                      TODO
angularBuiltInControls.htm:358,445,479
```

None of these are reachable from this repo. That boundary is why the change is split across three
repos rather than implemented here alone.

## Code References

**This repo (`3.0.x`):**

-   `src/compiler/CplaceTypescriptCompiler.ts:35` — `DEST_DIR = 'generated_js'`
-   `src/compiler/CplaceTypescriptCompiler.ts:37` — `STATIC_IMPORT_EXTENSIONS = 'html|htm'`
-   `src/compiler/CplaceTypescriptCompiler.ts:51,58,218` — `isProduction` plumbing and existing branch
-   `src/compiler/CplaceTypescriptCompiler.ts:99` — `await this.copyStaticFiles()`
-   `src/compiler/CplaceTypescriptCompiler.ts:157-169` — the `raw-loader` module rule (**hook 2**)
-   `src/compiler/CplaceTypescriptCompiler.ts:257-281` — `copyStaticFiles()` (**hook 1**)
-   `package.json` — version `3.0.1`; `terser-webpack-plugin`, `raw-loader`; no HTML minifier

**Consumers:**

-   `main/package.json:22`, `main/package-lock.json:121` — `@cplace/asc-local` pinned `2.3.8`
-   `cplace-customer-repo-skeleton/package.json` — pins `~2.3`
-   `cplace-forms-wizard/cf.cplace.formsWizard/assets/ts/wizard-manager/wizardManager.html` — the one
    comment in the entire asc-world corpus

**Invocation (external):**

-   `cf.cplace.build:cplace-gradle-plugin:3.4.+` `AscTask` —
    `cplace-asc --clean --production --noparents --cplaceversion <version>`

## Architecture Insights

1. **Two independent frontend build worlds that never meet.** Server-side `.htm` templates (~1,092
   across 19 repos, Java-rendered at runtime) and `assets/ts/**` templates (59 across 4 repos,
   asc/webpack-bundled). Any statement about "the build" has to say which. The pentest finding lives
   wholly in the first; this repo lives wholly in the second.

2. **`generated_js/` being a byte-identical mirror is a property worth preserving.** `copyStaticFiles()`
   copies verbatim today, which makes the output trivially auditable. Introducing a transform there
   changes that contract, so the transform must be the only difference and must be verifiable as such.

3. **One rule, two implementations, is the risk this split creates.** The server-side share and this one
   express the same comment model in different repos with different release cadences. Pinning the same
   tool at the same exact version in both is the only thing keeping them aligned; nothing enforces it.

4. **asc is a prophylactic here, and prophylactics need a consumer.** A strip on a line nothing
   consumes protects nothing. The value of this share is realized only when the ecosystem moves to asc
   3.x.

## Related Research

-   `cplace-customer-repo-skeleton`:
    `specs/2026-09-04_PFM-ISSUE-34344_remove-developer-comments-html/` — server-side build configuration
-   `main`: `specs/2026-09-04_PFM-ISSUE-34344_remove-developer-comments-html/research.md` — originating
    research, cross-repo index
-   `main`: `specs/2026-09-03_PFM-ISSUE-33498_remove-angular-dragdrop-digest-hud/` — the immediately
    preceding ticket, which also spanned `main` + `cplace-asc`; its `plan.md` Phase 4 documents the asc
    fixture cleanup and a worktree workaround, the closest procedural precedent

## Open Questions

1. **Does a 3.0.x-only change deliver anything?** No repo consumes asc 3.x, and the single comment asc
   could strip today is in a repo pinned to `~2.3`. Decided knowingly; revisit if the asc 3.x migration
   is not imminent.
2. **Should `master` also receive it**, following the PFM-ISSUE-33498 precedent of landing on both
   lines? Not decided; note `master` is at 2.3.6 and is not the line consumers use either.
3. **Which webpack mechanism for hook 2** — chain a loader ahead of `raw-loader`, replace `raw-loader`
   with `html-loader` configured to minimize, or post-process in the plugin phase? Not evaluated.
4. **Does the strip belong before or after `copyFiles`** in hook 1 — transform in a temp location, or
   post-process the copied output in `generated_js/`? The latter is simpler but mutates build output in
   place.
5. **Version pinning discipline.** The skeleton and this repo must pin the identical
   `html-minifier-terser` version for the two strips to behave identically. No mechanism enforces
   this today.
6. **`cplace-forms-wizard`'s 34 templates were counted, not inspected** beyond the comment scan. If asc
   3.x adoption starts there, its corpus should get the same diff treatment as `main`'s.
