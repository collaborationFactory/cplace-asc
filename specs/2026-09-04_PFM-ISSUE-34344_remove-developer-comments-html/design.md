# Comment stripping in cplace-asc - Design Approach

> **Revision note.** This document replaces an earlier design of the same name, written 2026-09-07
> 08:52, which chose `html-minifier-terser`. A corpus diff disqualified that tool and planning was
> halted to revisit; this revision is the result. Both measurements are reproduced under "Evidence"
> below, and where this design contradicts `research.md` the contradiction is stated explicitly under
> "Corrections to inputs" rather than silently resolved.

> **Split note.** This is the `cplace-asc` share of a change spanning three repos: this repo strips
> comments from `assets/ts/**` templates during production compilation;
> `cplace-customer-repo-skeleton` carries the Gradle + npm configuration that strips server-side
> engine templates; `main` carries template edits plus the verification harness for that corpus.
> **This share is self-contained** — nothing in the other two repos is a prerequisite, and by decision
> (Dimension 3) its implementation is deliberately independent of theirs.

## Overview

Add a production-gated comment strip to asc's template handling, so `.html`/`.htm` files under
`assets/ts/**` reach `generated_js/` — and therefore the webpack bundles — without developer comments.

The strip uses real parsers (`htmlparser2`, `acorn`) **only to report byte offsets of comments**, then
produces its output by splicing those ranges out of the original string. It never parses-and-
re-serializes, so it has no mechanism by which it could alter a non-comment byte. Measured over the
real 59-file corpus: **58 files byte-identical, 1 changed, and that one change is exactly the one
comment the corpus contains.**

## Problem Statement

Pentest finding 4.1.1 (cirosec APP-21233, CVSS 4.0 = 6.9 Medium) concerns developer comments shipping
in server-side HTML. **asc cannot reach any of those templates** — its visibility stops at
`assets/**`, while every cited leak lives in `cf.cplace.platform/src/main/resources/**`. asc is in
scope by explicit decision, as defense in depth against comments being added to asset templates in
future:

> "…and `.html` files that are compiled with cplace-asc (just in case someone adds some comments in
> those as well)."

The corpus asc reaches is 59 templates across 4 repos containing exactly **one** comment. This is
prophylactic work, and the design is written on that basis.

The binding constraint was set by the user during this design session:

> "Most important is to keep production code intact. Striping comments only"

and reiterated when choosing to preserve conditional comments:

> "Keep conditional comments to be sure nothing worthy is lost"

That reframed the risk axis. The danger is not reformatting — it is **false positives**: deleting
something that merely looks like a comment. Every decision below was judged on that.

### Requirements

-   `.html`/`.htm` under `assets/ts/**` must contain no developer comments in production build output.
-   Output must be **byte-identical to the input apart from removed comment spans**. No reformatting,
    no attribute rewriting, no whitespace collapsing, no minification of any kind.
-   `generated_js/` must be comment-free when a production build finishes ("generated_js in production
    build, should already be without comments").
-   Templates inlined into webpack bundles must equally be comment-free.
-   Only production builds strip; developer builds are untouched.
-   Comment model: HTML comments file-wide, plus JS comments (`//`, `/* … */`) inside JS-typed
    `<script>`.

### Constraints

-   **Byte preservation is a hard requirement**, so any parse-and-re-serialize tool is disqualified by
    construction. This is not a preference; it is the finding that caused this revision.
-   `generated_js/` is currently a byte-identical mirror of `assets/ts/**`; in production it becomes
    "identical apart from comments", and that must be provable rather than hoped for.
-   asc is invoked by the external `cf.cplace.build:cplace-gradle-plugin` (`AscTask`) as
    `cplace-asc --clean --production --noparents --cplaceversion <version>`. That invocation is out of
    this repo's reach and cannot change.
-   A runtime dependency must go in `dependencies`, not `devDependencies`: `tools/scripts/build.ts:20`
    sets `PACKAGE_JSON_PROPS_TO_REMOVE = ['devDependencies', 'jest', 'scripts']`, stripping
    devDependencies from the published package.
-   asc targets `assets/**` only and has no knowledge of the templating engine, so it cannot be the
    single implementation for both build worlds.
-   The 59-file corpus lives in four _sibling repos_ that CI cannot see, so committed tests must be
    self-contained in this repo.

## Design Decisions Summary

1. **Locate comments with real parsers; produce output by splicing the original string.** Add
   `htmlparser2` for HTML comment offsets and `acorn` for JS comment offsets inside JS-typed
   `<script>` blocks. Neither is used to build a DOM, an AST-to-source pass, or any serialization.
    - The only operation performed on the source is "skip a byte range", so there is **no code path
      that can rewrite a byte**. Byte preservation is structural, not a tested-for behavior.
    - `acorn` resolves the single hardest case correctly and for free: `//` inside a string
      (`"http://x.com/a"`), inside a template literal, and the regex-literal-versus-division ambiguity
      (`/a\/\/b/` versus `1/2/3`). This is what tipped the choice away from a hand-rolled scanner.
    - Both packages `require()` cleanly under asc's `"module": "commonjs"` tsconfig and **ship their own
      type declarations** — no `@types/*` package needed.
2. **Every span the strip deletes is located by a parser; none by hand-rolled code.** This is the
   governing principle, and it decides the scope boundaries rather than being derived from them.
    - `<style>` blocks are **out of scope**: `acorn` cannot parse CSS, and hand-rolling a CSS scanner
      would violate the principle to cover zero occurrences.
    - JS stripping applies only to `<script>` with no `type` or a JavaScript `type`. Any other type —
      notably `text/ng-template` — is skipped and passes through byte-identical.
    - If `acorn` fails to parse a script body, that block is kept verbatim and a note is logged.
3. **Conditional comments are preserved, in both their forms.** A comment whose body begins `[if` or
   is an `<![endif]` marker is left byte-identical.
    - The ordinary form `<!--[if lt IE 9]><script src="shiv.js"></script><![endif]-->` hides real
      markup inside a single comment; removing it deletes that markup.
    - The downlevel-revealed form `<!--[if !IE]>--><p>live</p><!--<![endif]-->` wraps content that is
      live in every modern browser.
    - Accepted cost: a developer comment nested inside a conditional comment survives. Zero
      occurrences, and recursing would mean re-parsing comment bodies as HTML — against decision 2.
4. **An unterminated `<!--` aborts that file, untouched, with a warning.** `htmlparser2` treats EOF as
   a comment terminator, which would delete everything to end-of-file.
    - This is the only case where the transform would otherwise remove real markup, so it is the one
      place worth failing closed.
    - Failing closed is free here: because the strip post-processes an already-copied file (decision 5),
      "leave it untouched" is already the correct on-disk state.
5. **One hook, not two: post-process `generated_js/**/\*.{html,htm}`after`copyFiles`.\*\* The webpack
   configuration is not modified at all, and no custom loader is added.
    - `doPostProcessing()` (`CplaceTypescriptCompiler.ts:98-101`) runs `copyStaticFiles()` **before**
      `runWebpack()`, and `getWebpackConfig()` sets `context` to `generated_js/` — not `assets/ts/`.
      So `raw-loader` reads this hook's output; covering the copy covers the bundle.
    - Leaving `copyFiles` itself untouched means `options.up` path-flattening semantics are never
      re-derived, which is where a layout regression would come from.
6. **Independent of the skeleton share, by decision.** asc never globs `src/main/resources/**`, so
   sharing an implementation would couple two repos that do not share a pipeline.
    - The alignment mechanism the previous design relied on ("same tool, same pinned version") is gone
      and is not replaced. Divergence is accepted, not treated as debt.
7. **Verify with unit tests, a temp-tree integration test, and byte-identity fixtures.**
    - The false-positive hazard suite developed during this session becomes the unit suite: one test
      per decision above.
    - A `tmp.dirSync` integration test covers the wiring and the production gate — the half unit tests
      cannot reach, and the most consequential untested behavior given production-only stripping.
    - `huiContentHeader.htm` and `huiWorkspaceMenu.htm` are vendored into `test/fixtures/` with
      byte-identity assertions. These are the two files the rejected tool structurally corrupted;
      freezing them turns that finding into a permanent CI guard.
    - A one-line assertion that `getWebpackConfig().context` resolves to `DEST_DIR` pins decision 5's
      coupling without running webpack.

This means:

-   A developer adding a comment to an asset template still sees it locally, and it never reaches
    production output — via either route, because there is only one physical route.
-   The design is materially **smaller** than the one it replaces: one hook instead of two, no custom
    loader, no webpack change. Two risks the prior design carried are eliminated rather than mitigated —
    its Risk 4 (tool reformats non-comment bytes) and Risk 5 (hook 2's webpack mechanism unresolved).
-   The success criterion the prior design _failed_ is now met by construction rather than by
    measurement: `main`'s 20 comment-free templates come through byte-identical because splicing zero
    ranges is the identity function.
-   The two structurally corrupted platform templates that caused this revision become permanent
    regression fixtures, so the failure cannot recur silently.

Major trade-offs we're accepting:

1. **Permanent divergence from the skeleton share.** One comment rule, two implementations, two
   release cadences, and nothing detecting drift. Accepted because asc has no visibility into the
   engine templates the skeleton's share targets, so a shared module would be coupling without a
   shared pipeline.
2. **`<style>`/CSS comments are not stripped.** A gap against the comment model as originally
   stated, accepted because the corpus contains zero `<style>` blocks and closing it would mean
   hand-rolled deletion logic — the thing decision 2 exists to prevent.
3. **Two new runtime dependencies** in a package installed into every consuming repo, for a corpus of
   59 files containing one comment. Mitigated by both being widely-used, typed, CJS-compatible, and
   used only as offset locators.
4. **Route 2's coverage is inherited, not enforced.** It holds because webpack's `context` is
   `generated_js/`. A future `resolve.alias` pointing at `assets/ts/` would bypass the strip. Pinned
   by an assertion rather than by a second implementation.
5. **Production-only means developers never exercise the strip**, so the committed tests carry the
   entire burden of proving it works.
6. **Two writes per template** (copy, then rewrite), and each file briefly exists on disk with its
   comments. Irrelevant for a one-shot production build; would matter if this ever ran in watch mode.
7. **A developer comment nested inside a conditional comment survives**, as the price of decision 3.

What we're NOT doing (out of scope):

-   **Anything touching server-side engine templates.** asc cannot see
    `cf.cplace.platform/src/main/resources/**`, where every cited pentest leak lives.
-   **Sharing an implementation with the skeleton share**, in either direction — including exporting the
    transform from `@cplace/asc-local` for the skeleton to consume. See Dimension 3.
-   **Stripping CSS comments** in `<style>` blocks.
-   **Removing conditional comments.**
-   **Any webpack change** — no custom loader, no modification to `getWebpackConfig()`.
-   **Minifying anything.** No whitespace collapsing, attribute rewriting, quote normalization,
    mangling, or compression.
-   **Consuming the whitespace a removed comment leaves behind.** Trailing indentation stays; deleting
    it would mean deleting a non-comment byte.
-   **Landing on `master` or `2.3.x`.** See Dimension 7.
-   **Automating the 59-file cross-repo corpus check.** It stays a pre-merge measurement recorded
    under "Evidence"; CI cannot see the sibling repos.

Success criteria:

-   Running the strip over all 59 asc-world templates leaves **58 byte-identical** and changes exactly
    one file by exactly one comment span. (Measured; see "Evidence".)
-   `huiContentHeader.htm` and `huiWorkspaceMenu.htm` pass through byte-identical — the two files the
    rejected tool corrupted.
-   A template with a deliberately added comment emerges comment-free from `generated_js/` **and** from
    the bundle after a production build; a non-production build leaves it intact.
-   Every false-positive hazard is covered by a passing test: `//` in a string, in a template literal,
    regex-literal-versus-division, `<!--` inside a JS string, `<!--` inside an attribute value, `//`
    inside `<pre>`, `text/ng-template` blocks, and both conditional-comment forms.
-   `npm test` passes.

## Design Decisions - Details

### Dimension 1: Transform implementation

**Chosen Approach:** `htmlparser2` + `acorn` as offset locators; output produced by splicing the
original string.

**Rationale:** It is the only approach measured to satisfy the byte-preservation requirement on real
input, and it is _simpler_ than the alternative rather than merely safer. The decisive evidence, over
the same 59-file corpus:

|                              | `html-minifier-terser@7.2.0` | `htmlparser2` + `acorn`, splice-only |
| ---------------------------- | ---------------------------- | ------------------------------------ |
| Byte-identical               | 29/59                        | **58/59**                            |
| Changed                      | 30                           | **1**                                |
| Changed _by comment removal_ | 0                            | **1 (all of them)**                  |
| Structurally corrupted       | **2**                        | **0**                                |
| Threw                        | —                            | 0                                    |

`acorn` handling regex-literal-versus-division correctly is what makes this simpler than hand-rolling:
that disambiguation is the hardest part of a scanner, and it is the part most likely to be got wrong
in a way that silently deletes code.

**Alternatives Considered:**

-   **Hand-rolled single-pass scanner (no dependency)**: _Recommended, then superseded by measurement._
    It was recommended on the assumption that a tokenizer could not be made conservative and that
    avoiding a dependency in a published package was worth owning the detection logic. The user set the
    condition "if C is solving the problem, if it is simplest to implement go with this… otherwise A",
    and the hazard suite showed the parser approach both solves it and is simpler. Retained as the
    fallback if a parser defect ever emerges.
-   **Regex replacement** (`/<!--[\s\S]*?-->/g` plus script/style regexes): rejected — stateless, so it
    cannot honor the byte-preservation requirement. `<!--` inside a JS string, an attribute value, or an
    `ng-template` block is matched and everything to the next `-->` deleted. Correct on today's corpus
    only because that corpus is empty of hazards.
-   **`html-minifier-terser`** (the prior design's choice): rejected on measured evidence — 30/59 files
    changed with zero changes attributable to comment removal, and two live platform templates
    structurally corrupted. Four option variants all changed the same 30 files, so the behavior is a
    property of the re-serializer and not reachable by configuration.
-   **`clean-css@5.3.2`** (already a direct dependency) for the CSS half: rejected — it re-serializes,
    the exact failure mode being avoided.

**Implications:**

-   `htmlparser2` and `acorn` go in `dependencies`, since `devDependencies` are stripped from the
    published package.
-   The transform's contract is "return the input minus a set of ranges", which makes it trivially
    unit-testable and makes byte-identity assertions meaningful.
-   Nothing in the transform needs `ignoreCustomFragments`-style protection for `$…$` engine
    placeholders or Angular `{{ }}` interpolation: bytes outside a located comment range are copied
    verbatim by construction.

---

### Dimension 2: Edge-case policy

**Chosen Approach:** `<style>` out of scope; conditional comments preserved; unterminated `<!--`
aborts the file.

**Rationale:** Each follows from the governing principle — a parser locates every deleted span — plus
the user's conservative tiebreaker. The corpus contains zero `<script>`, zero `<style>`, zero
conditional comments and zero `<pre>`, so all three are contracts being chosen rather than behaviors
being fixed; that argues for choosing the safe side of each.

**Alternatives Considered:**

-   **Small conservative CSS scanner for `<style>` (~25 lines)**: _Recommended, then overturned on user
    override._ The assumption that tipped the recommendation was that the comment model as originally
    stated was a requirement to satisfy now, so a `<style>` gap read as a shortfall against something
    already agreed. It is instead the general rule, honored where it applies — and with zero
    occurrences, hand-rolled deletion logic buys nothing while contradicting the reason a parser-based
    approach was chosen over a hand-rolled one.
-   **`postcss` for CSS offsets**: rejected — a third parser dependency for zero current occurrences.
-   **Removing conditional comments** (they are, formally, comments): _Recommended, then overturned on
    user override._ The recommendation assumed a conditional comment is definitionally a comment and
    that IE being unsupported makes any markup inside it worthless. That conflated two different shapes:
    the ordinary form hides real markup inside one comment, and the downlevel-revealed form wraps
    content live in every modern browser. Deleting markup is precisely what this design exists not to do.
-   **Accepting truncation on an unterminated `<!--`** (it matches browser behavior): rejected — it is
    the one case where the transform deletes real markup, and failing closed costs nothing given
    Dimension 4's post-process placement.

**Implications:**

-   The comment model in the design is HTML comments file-wide plus JS comments inside JS-typed
    `<script>`. This is a **revision** of the model as originally stated ("HTML + JS comments in
    script/style"), not an adoption of it.
-   `<script type="text/ng-template">` blocks — 132 of them exist on the server side, and the shape may
    appear here — pass through byte-identical without needing a special case, because their `type` is
    not a JavaScript type.
-   Skips and parse failures should be logged at debug level so a silently-unstripped block is
    discoverable.

---

### Dimension 3: Cross-repo consistency

**Chosen Approach:** Independent implementations. Cross-referenced documents, no shared code, no
shared tool.

**Rationale:** asc targets `assets/**` and has no knowledge of the templating engine. The skeleton's
share strips `src/main/resources/**` via Gradle `processResources` — a corpus and a pipeline asc never
touches. Sharing code would create a release-cadence coupling between two repos that share no build
step.

**Alternatives Considered:**

-   **Export the transform from `@cplace/asc-local` for the skeleton to consume**: this looked
    attractive because the skeleton already pins `@cplace/asc-local: "~3.0"`, and because the
    splice approach suits the server corpus better than `html-minifier-terser` does — the hazard suite
    shows `ng-template` blocks and `//` inside `<pre>` (`getHelpMarkup.htm`) passing through untouched,
    and `$…$` placeholder protection becoming unnecessary by construction. Rejected on the user's
    reasoning that asc does not target the templating engine: the skeleton would be importing asc code
    for a corpus asc never processes, which is coupling without a shared pipeline.
-   **Diverge now, converge later** (ship independence, record the shared module as a follow-up):
    _Recommended, then overturned on user override._ The recommendation assumed the shared module was
    architecturally desirable and therefore worth putting on the record. The override removes that
    premise rather than deprioritizing it — recording it as a follow-up would enshrine a design that is
    wrong for the reason above.

**Implications:**

-   The prior design's alignment mechanism is gone and is **not replaced**. Drift between the two
    comment rules is accepted and unmonitored; it is a stated trade-off, not a risk with a mitigation.
-   Both design documents should cross-reference each other so a reader of either knows the other
    exists and differs deliberately.

---

### Dimension 4: Hook mechanism for the copy route

**Chosen Approach:** Post-process `generated_js/**/*.{html,htm}` after `copyFiles`, gated on
`this.isProduction`.

**Rationale:** It delivers the stated requirement literally — `generated_js/` is comment-free when the
build finishes — while touching no path-computation logic. `copyStaticFiles()`
(`CplaceTypescriptCompiler.ts:257-281`) is a single `copyFiles([srcGlob, dest], options, cb)` call
whose `options.up` is derived from source-tree depth; leaving it alone means the `generated_js/` layout
cannot regress. It also makes Dimension 2's abort-on-unterminated-comment a no-op instead of a
special case, since the verbatim copy is already the correct fallback state.

**Alternatives Considered:**

-   **Replace `copyFiles` with an enumerate-transform-write loop** (`glob` is already a dependency):
    rejected — it requires reimplementing `copyfiles`' `up` flattening semantics by hand, and getting
    that subtly wrong changes `generated_js/` layout, a worse regression than the problem being solved.
    Its only advantage is that comments never touch the disk.
-   **Transform into a temp tree, then copy from temp**: rejected — `options.up` is computed from
    `tsAssetsPath` depth, so a temp tree of different depth needs the count adjusted, reintroducing the
    same fragility indirectly, plus a third full copy of every template for no observable difference.

**Implications:**

-   The post-process must be reachable from a test, which means extracting it as its own function rather
    than an inline block inside `copyStaticFiles()`. This is a design constraint imposed by testability
    and is intentional.
-   Only `.html`/`.htm` are globbed. webpack also emits into `generated_js/`, but only `.js`/`.css`, so
    there is no collision.
-   Reuse `STATIC_IMPORT_EXTENSIONS = 'html|htm'` (`:37`) as the extension set, so the strip tracks any
    future change to that constant.

---

### Dimension 5: Hook mechanism for the bundle route

**Chosen Approach:** None needed. The bundle route consumes the copy route's output.

**Rationale:** Verified directly in the code and against the real workspace:

-   `doPostProcessing()` (`:98-101`) awaits `copyStaticFiles()` **then** `runWebpack()`.
-   `getWebpackConfig()` (`:130`) sets `context: path.resolve(this.assetsPath, DEST_DIR)` — that is
    `generated_js/`, not `assets/ts/`.
-   All **59** template imports across the four repos are relative and stay inside the tree
    (`'./huiDropdown.htm'`, `'../wizardModal.html'`), and `copyStaticFiles`' `up` flattening reproduces
    that layout — confirmed by all 20 of `main`'s templates being physically present in
    `generated_js/`.

So `raw-loader` reads already-stripped files. This is why `copyStaticFiles()` exists in the first
place: to place templates next to the compiled JS for webpack to resolve.

**Alternatives Considered:**

-   **A custom loader appended after `raw-loader`, as defense in depth**: rejected — it would be two
    expressions of one rule inside a single repo, which is what Dimension 3's reasoning argues against.
    It costs a new loader file, `dist` build wiring, and the `use`-array ordering subtlety (webpack runs
    the array right-to-left, and `raw-loader` emits `export default "…"`, so a transform must be
    appended _after_ it to execute _before_ it) — all to defend against a hypothetical config change
    that a cheap assertion already catches. Every template would also be stripped twice, so the second
    pass's behavior would never be observable.
-   **Stripping in the loader only, leaving `generated_js/` verbatim**: rejected outright — fails the
    stated requirement that `generated_js/` be comment-free.

**Implications:**

-   `getWebpackConfig()` is not modified. The prior design's Risk 5 ("hook 2's webpack mechanism is
    unresolved") is eliminated rather than managed.
-   The coupling must be pinned: assert that `getWebpackConfig().context` resolves to `DEST_DIR`, so a
    future `resolve.alias` or `context` change fails a test instead of silently bypassing the strip.

---

### Dimension 6: Verification

**Chosen Approach:** Hazard-suite unit tests, a temp-tree integration test covering the production
gate, byte-identity fixtures for the two previously-corrupted templates, and a `context` assertion.

**Rationale:** Production-only stripping means no developer build exercises this path, so committed
tests carry the whole burden — and the production gate itself is the most consequential thing to get
wrong. The hazard suite is the highest-value asset because each case is a guard against a specific
false positive, which is the failure mode that matters. The vendored fixtures are the sharpest check
available: they are the exact files the rejected tool destroyed.

**Alternatives Considered:**

-   **Unit tests only**: rejected — proves the transform but not the wiring or the production gate.
-   **A real webpack bundle assertion**: rejected on cost — it needs an `app.js` entry, tsconfig and
    externals fixture, to pin a coupling that a one-line assertion on `getWebpackConfig().context`
    covers for free.
-   **Automating the 59-file corpus check in CI**: rejected — the corpus lives in four sibling repos CI
    cannot see. It stays recorded evidence.

**Implications:**

-   Follow the established conventions: jest 29.7.0 + ts-jest with `rootDir: "test"`, production code
    imported as `../src/...`, fixtures read via `path.join(process.cwd(), 'test/...')` (the suite uses
    `process.cwd()`, not `__dirname`), and temp trees via `tmp.dirSync({ unsafeCleanup: true })` in
    `beforeEach` with `removeCallback()` in `afterEach`, per `test/AssetsCompiler.test.ts`.
-   No existing test touches `CplaceTypescriptCompiler`, so this is new coverage for that class.
-   The integration test must assert both directions of the gate: production strips, non-production
    does not.

---

### Dimension 7: Which version line

**Chosen Approach:** `3.0.x` only. Carried forward unchanged from the prior design; not re-opened in
this session.

**Rationale:** It is the newest line (3.0.1) and the forward-looking home for asc changes.

**Alternatives Considered:**

-   **`3.0.x` + `2.3.x`, releasing 2.3.9 and bumping `main`**: recommended in the prior design, then
    overturned on user override — the assumption that tipped it was that this ticket must deliver the
    effect on `master`, making a 3.0.x-only change dormant. The override treats `3.0.x` as simply the
    correct home, with a cherry-pick to a near-EOL 2.3.x line being the wasted work instead.
-   **`3.0.x` + `master`, following the PFM-ISSUE-33498 precedent**: rejected — `master` is at 2.3.6 and
    is not a line any consumer uses.

**Implications:**

-   Consuming repos receive this behaviour when they move to asc 3.x. Per the correction below, repos
    seeded from the skeleton's 26.4 line already pin `~3.0`, so this is less dormant than the prior
    design assumed.

## Evidence

Both tools were measured against the same corpus before the choice was made. The numbers in
Dimension 1 come from these runs; this section records how they were produced and what the failures
looked like, so the central decision — refusing the tool the skeleton share uses — can be audited
rather than taken on trust.

### Method

Corpus enumerated as:

```bash
find <workspace>/repos -path "*/assets/ts/*" \( -name "*.html" -o -name "*.htm" \) \
  -not -path "*/node_modules/*"
```

59 files across `main` (20), `cplace-forms-wizard` (34), `cplace-mini` (4), `cplace-project-planning`
(1). A file is classed **structural** if its sequence of tag names (`/<\/?[a-zA-Z][a-zA-Z0-9-]*/g`,
lowercased) differs between input and output; **cosmetic** if the tag sequence is identical but the
bytes are not.

-   `html-minifier-terser@7.2.0` was run with `removeComments: true`, `minifyJS: { compress: false, mangle: false, format: { comments: false } }`, `ignoreCustomFragments: [/\$[^$]*\$/]`.
-   The chosen approach was prototyped with `htmlparser2@10.1.0` (`oncomment` →
    `parser.startIndex`/`endIndex`; `onopentag`/`ontext`/`onclosetag` → script and style content
    ranges) and `acorn@8.18.0` (`parse(..., { onComment })` → JS comment ranges inside JS-typed script
    bodies only). Output is the input minus those ranges.

Neither tool was installed into this repo during measurement; both ran from a scratch directory.

### The two structural corruptions under `html-minifier-terser`

Both are live platform templates in `main`, and both are why the tool was rejected outright rather
than reconfigured.

`cf.cplace.platform/assets/ts/huiContentHeader/huiContentHeader.htm` — 72 tags → **67**. First
divergence at tag index 38, where an `</a>` is dropped:

```
src  ... </span <a <i </i </a <span </span <span <div </div <a </a
out  ... </span <a <i </i      <span </span <span <div </div <a </a <div
```

and the file's final three `</div>` closers are never emitted:

```
src tail:   </hui-dropdown> </span> </span> </div> </div> </div> </div>
out tail:   </hui-dropdown> </span>         </div>
```

`cf.cplace.platform/assets/ts/huiLNavigation/huiWorkspaceMenu/huiWorkspaceMenu.htm` — 76 tags →
**74**. The closing run `</li></ul></div></div></div>` is re-emitted as `</span></span></div>`.

This is DOM restructuring of shipped markup, not reformatting. `<span>`/`</span>` counts are balanced
in both sources (8/8 and 9/9), so the cause is the parser's content-model auto-closing during
re-serialization, not malformed input.

### Configuration cannot fix it

The other 28 changed files were attribute-whitespace collapsing, quote normalization (`'click'` →
`"click"`), boolean-attribute expansion (`disabled` → `disabled="disabled"`), void-element slash
removal (`<br />` → `<br>`), and attribute-name lowercasing (`columnModel` → `columnmodel`). Four
option variants were measured, and **all four changed the same 30 files**:

| Variant                      | changed |
| ---------------------------- | ------- |
| A — as configured above      | 30/59   |
| B — A + `caseSensitive`      | 30/59   |
| C — B + `keepClosingSlash`   | 30/59   |
| D — C + `preserveLineBreaks` | 30/59   |

Attribute-whitespace collapsing and tree rebalancing are properties of the re-serializer and are not
reachable by configuration. That is what makes this a disqualification rather than a tuning problem.

### False-positive suite for the chosen approach

The failure mode that matters is deleting something that is not a comment. Each row below becomes a
unit test (Dimension 6):

| Case                                                           | Measured outcome                           |
| -------------------------------------------------------------- | ------------------------------------------ |
| `<!-- secret note -->`                                         | removed                                    |
| `var u = "http://x.com/a"; // real comment`                    | string's `//` **kept**, comment removed    |
| `var r = /a\/\/b/; var q = 1/2/3; // gone`                     | regex literal and division **kept**        |
| `` var t = `x // y ${a} /* z */`; // bye ``                    | template literal **kept**, comment removed |
| `var s = "<!-- not a comment -->";`                            | **byte-identical**                         |
| `<div title="<!-- literal -->">`                               | **byte-identical**                         |
| `<pre>http://example.com // not code</pre>`                    | **byte-identical**                         |
| `<script type="text/ng-template">…<!-- tpl --></script>`       | **byte-identical** (skipped, non-JS type)  |
| `<!--[if lt IE 9]><script src="shiv.js"></script><![endif]-->` | **byte-identical** (preserved)             |
| `<!--[if !IE]>--><p>live</p><!--<![endif]-->`                  | **byte-identical** (preserved)             |
| `<style>/* css note */</style>`                                | **byte-identical** (out of scope)          |
| `<div>a</div><!-- unterminated`                                | tail deleted → design aborts the file      |

The third row is the decisive one: regex-literal-versus-division disambiguation is the hardest part
of a hand-rolled scanner, and `acorn` resolves it correctly for free. That is what made the parser
approach _simpler_ than hand-rolling rather than merely safer.

### Corpus result for the chosen approach

58 of 59 files byte-identical, 0 thrown, 0 skipped. The one changed file is
`cplace-forms-wizard/.../wizard-manager/wizardManager.html`, a single range at offset 1696 of 79
bytes, verified to match `/^<!--[\s\S]*-->$/`:

```diff
-    <!-- The order is reversed because we are using flex-direction: row-reverse -->
+
```

Both templates the rejected tool corrupted pass through byte-identical.

### Corpus facts verified while measuring

-   **Zero `<script>` and zero `<style>` blocks** across all 59 files (`grep -oiE "<(script|style)\b"`
    returns no matches), so the JS half of the model has nothing to act on today. Also zero conditional
    comments, zero `<pre>`, and zero occurrences of the `<script><!-- … //--></script>` idiom.
-   **Exactly one comment** in the whole corpus, in a repo (`cplace-forms-wizard`) that pins asc `~2.3`
    and so will not receive this change.

## Corrections to inputs

This design contradicts its own inputs in three places. Each was verified during this session.

1. **`research.md` §1 and prior design Decision 1 — "both hooks are needed".** Research states that
   "a strip on Route 1 alone would leave these unprocessed, and vice versa". This is **wrong**: the
   routes are sequential, not independent. `copyStaticFiles()` runs before `runWebpack()`, and
   webpack's `context` is `generated_js/`, so Route 2 consumes Route 1's output. One hook suffices.
2. **`research.md` §4 and prior design Risk 1 — "zero present benefit".** Both state the skeleton pins
   asc `~2.3`. On `origin/next/version/26.4` — the branch this ticket targets — `package.json:21`
   pins `"@cplace/asc-local": "~3.0"`. Repos seeded from that line start on asc 3.x and do receive
   this change, so "protects nothing today" was overstated.
3. **The comment model as originally stated.** Agreed earlier as "HTML + JS comments in
   script/style". This design **revises** it: `<style>` is out of scope (Dimension 2).

Additionally, `research.md` §5 lists `terser-webpack-plugin` and `raw-loader` under devDependencies;
they are in fact direct `dependencies`. The distinction matters only in that it confirms runtime deps
belong there.

## Overall Architecture

### Key Components

1. **`src/compiler/stripHtmlComments.ts`** (new) — the transform. Exposes a pure
   `string -> string` function plus, for testability, the range-locating step. Uses `htmlparser2` for
   HTML comment offsets and script/style block boundaries, and `acorn` (via its `onComment` callback)
   for JS comment offsets inside JS-typed script bodies. Returns the input minus those ranges.
2. **`copyStaticFiles()` (`CplaceTypescriptCompiler.ts:257-281`)** — unchanged in its copy behavior;
   followed by a new, separately-testable post-process step gated on `this.isProduction`.
3. **`getWebpackConfig()` (`:130-235`)** — **unchanged.** Listed because its `context` value is
   load-bearing for correctness and is pinned by a test.
4. **`package.json`** — adds `htmlparser2` and `acorn` to `dependencies`.
5. **`test/`** — hazard-suite unit tests, a temp-tree integration test, `test/fixtures/` holding
   `huiContentHeader.htm` and `huiWorkspaceMenu.htm`, and the `context` assertion.

### Data Flow

```
assets/ts/**/*.{html,htm}                     (comments present — developers see these)
  │
  │  doPostProcessing()
  ├─ copyStaticFiles()
  │     glob assets/ts/**/*.+(html|htm)
  │     → copyFiles (verbatim, options.up flattening)
  │     → assets/generated_js/**
  │     → [isProduction] stripHtmlComments over generated_js/**/*.{html,htm}   ◄── the only hook
  │
  └─ runWebpack()
        context = assets/generated_js/          ◄── reads the stripped tree
        rule /\.(html|htm)$/ → raw-loader → inlined string in bundle
```

Both outputs — the files in `generated_js/` and the strings inlined into the bundle — are comment-free
in production, from a single transform applied once.

The server-side world runs entirely in parallel and never intersects:
`src/main/resources/**/*.{htm,html}` → `processResources` (skeleton configuration) → JAR →
distribution zip.

### Integration Points

-   **`this.isProduction`** (`:51,58`) — existing gate; no new flag and no plumbing. `AscTask` already
    passes `--production`.
-   **`STATIC_IMPORT_EXTENSIONS = 'html|htm'`** (`:37`) — existing constant, reused as the target set.
-   **`getWebpackConfig().context`** — an implicit dependency of Dimension 5, made explicit by a test.
-   **`AscTask` in `cplace-gradle-plugin`** — unchanged and unaware.
-   **`cplace-customer-repo-skeleton`** — the companion share; deliberately uncoupled (Dimension 3).

## Known Risks

1. **A parser defect deletes a non-comment range.** The design's guarantee is that only located ranges
   are removed; it does not guarantee the locations are right. _Mitigation_: the hazard suite covers
   every known false-positive shape; the vendored fixtures assert byte-identity on real platform
   markup; the hand-rolled scanner remains the pre-agreed fallback.
2. **A future `resolve.alias` or `context` change silently bypasses the strip for bundled templates.**
   _Mitigation_: the `getWebpackConfig().context` assertion fails the build's tests if it moves.
3. **Configuration drift from the skeleton share.** Two repos, two cadences, one rule, no detection.
   _Mitigation_: none beyond cross-referenced documents — this is accepted as a trade-off rather than
   mitigated, per Dimension 3.
4. **`<style>` blocks are silently unstripped.** If a `<style>` block with comments is added to an
   asset template, this design does not strip it. _Mitigation_: log the skip at debug level; the gap
   is documented in the out-of-scope list rather than left to be discovered.
5. **A `<script>` body that `acorn` cannot parse is silently unstripped.** _Mitigation_: log the parse
   failure; a kept-verbatim block is the safe direction.
6. **Production-only means the code path is not exercised in day-to-day development**, so a regression
   could sit unnoticed until a release build. _Mitigation_: the integration test asserts both sides of
   the gate.
7. **`cplace-forms-wizard`'s 34 templates are the largest asc-world corpus** and hold the only comment
   asc could strip, but that repo pins `~2.3`. _Mitigation_: the corpus measurement already covers
   those files (20 of the 34 changed under the rejected tool; 0 under this design); re-run before asc
   3.x adoption reaches it.

## Next Steps

1. Review this design document
2. Refine if needed based on feedback
3. Proceed to implementation planning:
   `/spec-driven-development:create_plan specs/2026-09-04_PFM-ISSUE-34344_remove-developer-comments-html/design.md`

## References

-   Original ticket: [PFM-ISSUE-34344](https://base.cplace.io/pages/vd590k6fgqqfbomkh4qiqkwv9/PFM-ISSUE-34344-Remove-developer-comments)
-   Pentest source: cirosec APP-21233, Finding 4.1.1 "HTML comments", final 2026-04-02
-   This repo's research: [research.md](./research.md)
-   Skeleton share (deliberately independent implementation):
    `cplace-customer-repo-skeleton:specs/2026-09-04_PFM-ISSUE-34344_remove-developer-comments-html/`
-   Originating research (cross-repo index):
    `main:specs/2026-09-04_PFM-ISSUE-34344_remove-developer-comments-html/research.md`
-   Procedural precedent for a `main` + `cplace-asc` change:
    `main:specs/2026-09-03_PFM-ISSUE-33498_remove-angular-dragdrop-digest-hud/`
