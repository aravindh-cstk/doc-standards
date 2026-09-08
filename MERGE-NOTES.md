# Merge Notes

This folder is a merged, deduplicated canonical version of five independent `doc-standards` folders found on the Desktop on 2026-07-21:

- `CS Assets/doc-standards`
- `cursor/doc-standards`
- `skills/doc-standards`
- `Agentic AI/doc-standards`
- `Dynamic URL/doc-standards`

All five copies started from one shared template and were edited independently over time. `common-rules.md` in particular ranged from 20 KB to 41 KB across the five copies, each revision adding rules the others never received. This folder consolidates every unique rule from every copy into one source of truth. The five original folders were left untouched, this folder is new.

## Decisions made by the user during the merge

- **Overview style:** the Overview section definition in `common-rules.md` uses problem-first framing (lead with the problem or limitation, then state what the feature enables, do not open with the API or SDK name). This was the `Dynamic URL` copy's rewrite. The other four copies used gain-first framing ("state what the developer achieves or gains"). Problem-first was chosen as canonical.
- **Migration guide Prerequisites:** `migration-guide.md` keeps both a Mandatory and an Optional subsection in Prerequisites. The `CS Assets` copy had a rule forbidding an Optional subsection entirely. That rule was not carried into the merged file.
- **Originals:** the five source folders were left completely untouched. Nothing in them was edited or deleted.

## Default resolutions applied to common-rules.md (not asked, applied as sensible defaults)

- Restored the `CS Assets`-only exception allowing a Note callout in a migration guide's Overview when one change requires significantly more effort than the rest. Every later revision had silently dropped it.
- Restored the `Agentic AI`-only "write for a developer audience" rule in C3 (Language and Tone). The `Dynamic URL` revision had dropped it. It is kept as a distinct rule from C8's tone principle since it concerns assumed reader competence and level, not marketing language.
- Kept the `Dynamic URL` revision's broadened no-dash rule (extends to en dashes and table cells, adds parentheses and colon as remedies) as canonical, since it is a strict superset of the older, narrower wording.
- Consolidated two overlapping C5 (Cross-References) rules, "remove duplicate cross-references" and "point to exactly one canonical section", into one combined rule rather than keeping them as two near-parallel rules.
- Relocated the Quick Reference table completeness requirement out of the Section Definitions prose (where the `Dynamic URL` copy had left it as an oddly placed inline rule) into C6 (Content Accuracy and Grouping), for structural consistency with every other rule in the document.
- Kept C8 (Developer Tone, present in 3 of 5 copies) and C9 (API Reference Completeness, unique to `Dynamic URL`) in full. Both are purely additive with no conflicts against anything else in the corpus.

## Migration-guide.md structural resolution

The `CS Assets` copy and the other four copies disagreed on migration-guide.md's section order and on the name of the type-mapping table. The merged file:

- Reinstates "What You'll Learn" as a required section (present in the four-copy version, absent from `CS Assets`).
- Renames "Breaking Changes Reference" (the `CS Assets` name) to "Type Mapping Reference" to match `section-matrix.md` and four of the five copies.
- Keeps "Minimal Migration Path" as an added section, unique to the `CS Assets` copy, and adds a corresponding row to `section-matrix.md`.
- Keeps all of the `CS Assets` copy's additional rigor that did not conflict with the above: the effort-outlier callout in the Overview, the Quick Decision Guide "concrete codebase signals" rule, the Main Content "compile blockers first" ordering rule, three-part Troubleshooting entries tagged Compile blocker or Behavior change, and the Pre-Upgrade Checklist "verification tool, not sequence guide" framing.
- Merges both variants' Theory Sections exceptions (a one-sentence Overview orientation, or a one-sentence consequence statement before a Before/After block) since they are non-contradictory alternatives rather than a conflict.

## Other file merges

- `feature-doc.md`: based on the `Dynamic URL` copy (the only one with the SEO Front Matter Format section). One label was renamed from "Decision Guide" to "Quick Decision Guide" to match the term used everywhere else.
- `section-matrix.md`: based on the larger variant (`CS Assets`, `cursor`, `Dynamic URL`, the only version with the Get Started Guide column), plus one new row for Minimal Migration Path.
- `getting-started.md`, `conceptual-guide.md`, `how-to-guide.md`, `setup-guide.md`, `kickstarter.md`: identical content across all five source folders, carried over with no content changes.
- `writing-guide-agent-skills.md`: carried over from `skills/doc-standards/.writing-guide.md` (the only copy that had it), made visible by dropping the leading dot, with a scope note added at the top clarifying it is specific to Agent Skills documentation and supplements, rather than replaces, `common-rules.md` C3 and C8.

## 2026-09-07: the Studio and MCP Profile Hub forks

The two working copies that had moved furthest ahead of this repo were `Desktop/Studio/doc-standards` and `Desktop/MCP Profile Hub/doc-standards`. This commit merges both into the canonical set. `Region Endpoints/doc-standards` was checked and holds nothing this repo lacks.

This commit is not the union of every copy on the machine. `SDK Project` and `CLI Project` were merged after it, in the section below.

Neither fork was simply ahead of the other. Each held work the other never received:

| Fork | What only it had |
|---|---|
| Studio | `check-links.js`, the emoji, italics and table integrity checks, the dash and anchor repair passes in `fix/`, `lib/prose-mask.js`, `lib/slugify.js`, `lib/table-shape.js`, and blockquote-aware fence masking in `lib/parse-markdown.js` |
| MCP Profile Hub | the paragraph cohesion and forward-reference checks, the tier-3 rules `C3-23` and `C3-25` through `C3-26`, the passage-judging mode in `judge-tone.js`, and the stdin fix in `lib/claude-runner.js` that stops a nested `claude -p` call hanging until its timeout |

The rule text and every wordlist here is a superset of what this repo carried before. Two literals moved rather than disappeared: `powerful` and `seamless` left `banned-phrases/superlatives.json` for `banned-phrases/marketing.json`, because the wordlist hygiene test refuses to let two rules claim the same literal.

The suite is now 400 tests, all passing, none skipped.

### Rule ID collisions, and how they were resolved

Both forks hand-counted their next rule ID, and both landed on the same numbers for different rules. Three IDs collided:

| ID | Studio assigned it to | MCP Profile Hub assigned it to |
|---|---|---|
| `C2-09` | table integrity | paragraph cohesion |
| `C3-23` | no emoji | naming a documented concept |
| `C3-24` | no italics | forward-pointing demonstrative |

The MCP Profile Hub numbering is canonical, because its IDs are cited in rule prose and in the tier-3 judge prompts, while the three Studio rules were referenced only inside check modules. So Studio's three moved:

- table integrity: `C2-09` becomes `C2-10`
- no emoji: `C3-23` becomes `C3-27`
- no italics: `C3-24` becomes `C3-28`

`test/gap-loop.test.js` now asserts the invariant that `nextRuleId` returns one past the highest number a prefix holds, rather than asserting a hardcoded literal. Both forks carried a literal there, and a literal is what let each of them reuse an ID without noticing. Anyone syncing these changes back into `Studio/doc-standards` has to renumber the same three rules to match.

### The API reference rules move into the root registry

The 2026-08-20 sync gave `doc-types/api-reference/` its own `rules-registry.json`, `lib/`, linter and tests. Studio reverted that, and this commit follows the revert. The ten `AR-01` to `AR-10` rules now live in `scripts/data/rules-registry.json` tagged `docTypes: ["api-ref"]`, the linter is `scripts/lint-api-ref.js`, the templates are in `api-ref/`, and `doc-types/api-reference/SKILL.md` is left as the file that routes a reader to all of it.

The reason is that `lib/rules-registry.js` validates the registry as one artifact. It cross-checks the rules against `data/check-sources.json` and against the check modules: a tier-3 rule may not name a `checkId`, a tier-1 or tier-2 rule must name one, and no check may emit an ID another check owns. A second registry in a subfolder sits outside all of that, which is how a rule ships advertising coverage that never existed.

### Test fixtures are vendored

`test/api-ref-structure.test.js` read its negative-control pages from a sibling checkout called `python-delivery-pr-217`, so three tests skipped on every clone that did not happen to have it. The control was missing exactly where the suite runs as a gate. Those pages already existed in this repo under the old api-reference folder, so they are now vendored at `scripts/test/fixtures/api-ref-good/` and the three tests run.

### Corpus paths

Every script that defaulted to a specific project's docs folder now defaults to `../../docs`, since this repo carries no docs corpus of its own. Pass the corpus explicitly when running a sweep, a probe, or a judge pass against a real doc set.

## 2026-09-07: SDK Project and CLI Project

Both were merged after the two forks above, in that order. Every copy of `doc-standards` on the machine has now been folded in, and `Region Endpoints` was verified to hold nothing new.

### The usage guide page shape, from SDK Project

The api-ref doc type had two page shapes here and three there. `UG-01` to `UG-13` joined the root registry, `api-ref-structure.js` gained the eight usage-guide checks, and `lint-api-ref.js` learned to collect `usage_guide.md` and sort it above the class folders the way the CMS renders the chain. `AR-07` now says class pages and usage guides carry no trailing rule, which is the same rule restated for the shape that did not exist here.

The good usage guide fixture was not clean under this repo's rules, which are stricter than SDK Project's. One of the two findings was a real defect in this repo's check: `passive-voice` reported "Get Started" inside a link to a published guide, because its patterns are written lowercase and matched case-insensitively, so the title satisfies the get-passive shape. The suggested fix would have renamed a real page. An all-capitalized match is now exempt as a name, while a sentence-initial passive capitalizes only its auxiliary and still reports. The other finding was genuine passive voice in a page whose job is to model the conventions, so the fixture was rewritten actively.

### The CLI doc-type family, from CLI Project

Four new doc types (`cli-command-reference`, `cli-task-runbook`, `cli-module-reference`, `cli-plugin-guide`) with their rule files in `cli-templates/`, 32 rules, six check modules, and the `absent-docs` wordlist. `section-matrix.md` is CLI Project's version, which carries all seven original columns plus one per CLI type.

Five rule IDs collided the way Studio and MCP Profile Hub collided, with entirely different rules sharing a number. This repo's numbering wins, so CLI Project's five moved:

| CLI Project | Here | Rule |
|---|---|---|
| `C2-07` | `C2-11` | the four permitted callout labels |
| `C2-08` | `C2-12` | split a paragraph that mixes kinds of information |
| `C3-07` | `C3-29` | rewrite conditional framing as a direct statement |
| `C6-04` | `C6-06` | one heading name and table shape per recurring category |
| `C6-05` | `C6-07` | collapse a lone subsection into its parent |

`C6-06` there, on verifying quantitative claims, became `C6-08`. `PLG1` to `PLG5` became `PLG-01` to `PLG-05`, because the registry's `ID_RE` requires the dash.

Three constraints in this repo that CLI Project's registry did not enforce had to be satisfied rather than relaxed:

- A tier-3 rule may not name a `checkId`. `C2-12`, `C6-07`, `C6-08` and `MIG-09` are tier 3 here and name none. `unverified-claims.js` still ships and still emits tier-3 findings for `C6-08`, which the validator allows for a rule that claims no check.
- A tier-1 or tier-2 rule must name a `checkId` that exists. Fifteen CLI rules are tier 1 or 2 with no check written, so each has an `unimplemented` check-sources entry, the idiom this repo already uses for `AR-10` and the `C9` heuristics. Their tiers are preserved rather than demoted, because the tier is a claim about severity and the missing check is a gap in coverage.
- `CLI-19` and `PLG-05` are the section-order rule for their doc types and report as `C1-01` does, so both join `UNEMITTED_BASELINE` alongside the four section-structure entries already there for that reason.

Front matter is the one place the two corpora genuinely disagree and neither side is wrong. The SDK set requires `seo_title`, `seo_description` and `url`. The CLI set requires `title`, `description` and `url`, and its CMS-generated pages carry `uid`, `seo_title` and `seo_description` instead. Unifying them would report `FM-01` on every page of one corpus, so `checks/front-matter.js` scopes the required set by doc type and accepts the mirror shape for a CLI page.

`CLI-05` and `CLI-19` bind on a doc's subject rather than its type, because a CLI page typed `setup-guide` or `migration-guide` is rendered by the same platform. That needed CLI Project's `isCliDoc`, and its version treated any `csdx` anywhere in the body as proof. That held in a corpus where every doc was a CLI doc and does not hold here: `clean-feature-doc.md` shows one `csdx plugins:install` line in its Installation section, and it was retyped as a command reference, reported six errors against a template it does not use, and was told to delete a Troubleshooting section that is correct for a feature doc. A passing mention is no longer enough. The signal is the title naming the CLI, or a `Commands` section, which a page documenting commands carries and a page merely invoking one does not. The four CLI docs typed under a product-wide template all name the CLI in their titles, so the case the heuristic exists for still works.

Every test in the suite passed a doc type explicitly, so none of them could see that regression. `test/cli-doc-types.test.js` now asserts the detection directly.

The suite is 443 tests, all passing, none skipped. `section-order.json` and `section-matrix.json` regenerate identically from the rule files here.

## 2026-09-07 (evening): Studio's second round

Studio kept moving while the merges above were landing, and gained 20 new files plus edits to sixteen more. All of it is now in.

New tooling: `classify-doc-type.js` with `lib/corpus-class.js` and `data/corpus-classes.json`, `judge-reading.js`, `sync-mirror.js`, `lib/markdown-links.js`, the `fix/fix-acronym-first-use.js` and `fix/fix-anthropomorphism.js` passes, and a `chapter-index` doc type with its own rule file.

Three new rules, and all three collided again, because Studio still carries the literal-based `nextRuleId` test rather than the invariant one committed here:

| Studio | Here | Rule |
|---|---|---|
| `C2-10` | `C2-13` | a stated count matches the structure it counts |
| `C2-11` | `C2-14` | a link label names its destination |
| `C3-25` | `C3-30` | do not use a typographic character in place of a word |

Two changes here are worth knowing about because they fix findings that were mostly self-inflicted:

- **An Overview may be a lede.** `C1-01` looked for an H2 literally named "Overview". One page in 272 carries that heading, while 170 published pages open with a lede paragraph under the H1, and all 170 were reported as missing an Overview. Either form now satisfies the rule. An H1 followed straight by an H2 is still a finding, which is one page. `checks/section-structure.js` here is the two-way merge of that change with the `isCli` work from CLI Project.
- **A declared `doc_type:` in front matter wins over the heuristic.** The heuristic answered `conceptual-guide` for 327 of 355 files, and it was circular: the `setup-guide` branch reads text from the doc's own Overview, so a page without one could never be classified as a setup guide, and `conceptual-guide` then requires an Overview. `C1-01` was manufacturing most of its own findings.

Also merged: the "Next Steps or See also" row rename across the seven rule files, with `lib/section-index.js` splitting an "A or B" row so both headings satisfy it (the corpus has 10 pages with one and 157 with the other), a `Chapter Index` column in `section-matrix.md`, and rule-id exemptions by corpus class so page-shape rules stop firing on files that are never published.

`typographic-substitutes` is wired into `lint-doc.js`. `numeric-consistency` and `link-label-fidelity` are not, because they produce judge candidates rather than findings. They are not unwired, though: see "Where the two candidate generators actually run" below.

Two things carry Studio's own corpus paths and a consuming project overrides them: `data/corpus-classes.json` keys its patterns on `studio-docs/`, and `sync-mirror.js` hardwires that repo's `skills/src` to `docs/prompts` mirror, so it is kept as a script but left out of `npm run gate`.

The suite is 605 tests, all passing, none skipped.

## 2026-09-08: the last two project-specific pieces generalized

Two things came out of the Studio merge still tied to that one corpus. Both are now general, because a rule set that only works for the corpus it was written in is not a shared standard.

### Corpus classes

`data/corpus-classes.json` decides which page-shape rules apply to a file, and its patterns were written against the workspace root with a project directory name in them (`studio-docs/docs/prompts/`). That matched exactly one corpus. A file at the same path in any other project matched nothing, fell to the default, and quietly lost its exemptions, so simply sharing this repo was enough to break it.

Patterns are now relative to a project's own root, so `docs/prompts/` means that path inside whichever project is being linted. `lib/corpus-class.js` resolves a path to its project and strips the project directory, and the standards tree itself classifies as internal by its own directory name rather than by a hardcoded one.

The conventional patterns cover `docs/`, `docs/prompts/`, `prompts/`, `skills/`, `.claude/`, any `docs/_*` working directory, `docs/adr/`, `docs/assets/`, and the contributor files `AGENTS.md`, `CLAUDE.md`, `README.md` and `CONTRIBUTING.md`.

A project whose layout those do not describe sets `DOC_STANDARDS_CORPUS_CLASSES` to its own JSON file. Its patterns are tried before the built-in ones and its classes merge over them, so a project can add a class or retarget a path without editing this repo. A malformed override is reported and ignored rather than failing the run, because a lint pass should not die on a config typo, and it must not be silent either, or a project believes its exemptions are live when they are not.

`test/corpus-class.test.js` now asserts the same layout classifies identically under four different project names, and that no pattern carries a project directory name.

### The mirror resync

`sync-mirror.js` is a generic "keep two directories byte-identical" tool that had four hardcoded paths, which is why it was excluded from `npm run gate`. It now takes the pair on the command line:

```
node sync-mirror.js <source-dir> <mirror-dir> [--apply] [--index=<file>] [--mirror-only=a.md,b.md]
```

`--index` is for a file mirrored from outside the source directory, which a readdir of the source never reaches, so it has to be named or it silently stops being mirrored. `--mirror-only` names the files that exist only in the mirror by design, so they are not reported as orphans. Missing directories are a usage error rather than an empty run.

`fix/finish-dash-pass.js` had the same problem twice over: it hardcoded the corpus, and its step 2 called `mirror-skills.js`, a script that only exists in the consuming repo and was therefore already failing here. It now takes the corpus as an argument and drives step 2 through `sync-mirror.js`. When no mirror is named the step reports itself as SKIPPED rather than being omitted, because a project that keeps a mirror and forgets the flags would otherwise read a clean summary over a broken mirror.

No executable file in `scripts/` names a specific corpus any more. What remains is the measurement history in `corpus-classes.json`'s `_why` and the sample project names in the tests, both of which are correct to keep.

The suite is 615 tests, all passing, none skipped.

### Where the two candidate generators actually run

Worth recording, because the note above said they were unwired. They are not. Both are in the reading-judge pipeline rather than the mechanical linter, which is where a check that produces candidates for a reader belongs:

| Check | Rule | Runner |
|---|---|---|
| `numeric-consistency` | `C2-13` | `judge-reading.js`, so `npm run reading` |
| `link-label-fidelity` | `C2-14` | `judge-reading.js`, and `check-links.js --layers=labels`, so `npm run links` |

Only `typographic-substitutes` (`C3-30`) is a `lint-doc.js` check, because it is the only one of the three that settles a finding without a reader.

## Maintaining this

Every `doc-standards` copy on the machine is now merged into this repo, and the copies are the reason four rounds of renumbering were needed: each one hand-counted its next rule id and they collided every time.

So this repo is the only copy that should be edited. Point agents and skills at it rather than at a per-project copy, and treat the copies under `Studio/`, `MCP Profile Hub/`, `SDK Project/`, `CLI Project/` and `Region Endpoints/` as read-only history.

Two guards here exist because of that history and matter when a rule is added:

- `npm run probe -- --next-id=<PREFIX>` computes the next free id. Do not hand-count one.
- `test/gap-loop.test.js` asserts `nextRuleId` returns one past the highest number a prefix holds, stated as an invariant rather than a literal. A literal has to be edited every time a rule lands, and that edit is indistinguishable from renumbering the new rule to make the old literal pass, which is the bug itself.

Anyone syncing this repo back into a working copy inherits both. A working copy that keeps the old literal test will keep generating collisions.

### Current layout

The narrative above names files as they were called at each point in the merge, which is not always where they live today. As of 2026-09-08, the nine SDK doc-type rule files (`common-rules.md` and the eight per-type templates, plus `section-matrix.md`, `chapter-index.md` and `writing-guide-agent-skills.md`) moved from the repo root into `types/`, matching the sibling folders `api-ref/` and `cli-templates/`. A mention of `common-rules.md` or `section-matrix.md` elsewhere in this file means `types/common-rules.md` and `types/section-matrix.md` today.

## A note on style

Every file in this folder, including this one, avoids em dashes, en dashes, and semicolons in prose, per the no-dash rule in `types/common-rules.md` C3. Several of the original five copies (especially the older, smaller revisions) used dashes and semicolons throughout. Those were rewritten for internal consistency during the merge. This is a wording change only, not a content change.
