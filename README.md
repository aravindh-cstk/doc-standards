# doc-standards

The canonical documentation rules for Contentstack, and the toolchain that enforces them.

This repository holds a rule set and its enforcement layer. The first is a set of markdown files stating what a documentation page must look like, one file per doc type plus a shared rule spine. The second is a linter, a rule registry, a corpus sweep, a set of fixers and a test suite that turn those statements into findings a machine can report. A rule that lives only in prose is a suggestion. A rule in the registry with a check behind it is enforced.

Nothing here is published. Every file is either a rule, a template, a script or a test.

## Contents

- [Start here](#start-here)
- [Repository map](#repository-map)
- [Pick a doc type](#pick-a-doc-type)
- [Rule system](#rule-system)
- [Toolchain](#toolchain)
- [Workflows](#workflows)
- [Wider setup](#wider-setup)
- [Known gaps](#known-gaps)
- [Editing this repo](#editing-this-repo)

Two generated companion files hold the exhaustive detail:

- [REFERENCE-RULES.md](REFERENCE-RULES.md) states all 181 rules, with rationale, exception and enforcing check.
- [REFERENCE-CHECKS.md](REFERENCE-CHECKS.md) maps all 86 check IDs to the module that implements each one.

## Start here

Find your job in this table and go to the section it names.

| You want to | Go to |
| --- | --- |
| Write a new documentation page | [Pick a doc type](#pick-a-doc-type), then workflow 1 |
| Fix an existing page against the rules | Workflow 2 |
| Audit a whole documentation corpus | Workflow 3 |
| Look up what a rule ID means | [REFERENCE-RULES.md](REFERENCE-RULES.md) |
| Add a rule, or write a check for one | [Rule system](#rule-system), then workflow 5 |
| Understand why the linter missed something | Workflow 4 |
| Set this up on a new machine | [Wider setup](#wider-setup) |
| Know what is broken today | [Known gaps](#known-gaps) |

### How it is consumed

Four paths, and knowing which one is running matters when a result surprises you.

1. **The editor hooks.** Every `Write` or `Edit` of a markdown file under a `docs/` path in a consuming repo runs the dash check and then the linter. Tier 1 findings block the edit. This path runs on every documentation edit, without anyone invoking it.
2. **The two slash commands.** `/revamp-doc` brings one page into compliance. `/doc-gap` turns a missed violation into a permanent check. Both live outside this repo and read files inside it.
3. **The npm scripts.** Run manually from `scripts/` when auditing a corpus, closing a gap or rebuilding generated data.
4. **Agent context.** An agent working on documentation in another repo loads `types/common-rules.md` and the matching type file as context.

### One copy only

Every `doc-standards` folder on this machine has been merged into this repository. This is the only copy that should be edited. Treat the copies under `Studio/`, `MCP Profile Hub/`, `SDK Project/`, `CLI Project/` and `Region Endpoints/` as read-only history, and point agents and skills at this repository rather than at a per-project copy.

`MERGE-NOTES.md` records how the merge happened, every conflict resolution and every rule-ID renumbering. Read it when you need to know why a rule has the number it has. Read this file when you need to know what the rules are.

## Repository map

| Path | Holds | Edited by |
| --- | --- | --- |
| `types/` | The shared rule spine and eight prose doc types | Anyone changing a prose rule |
| `api-ref/` | Three API reference page shapes, plus one derivation record | Anyone changing an SDK reference page shape |
| `cli-templates/` | The shared CLI rules and four CLI doc types | Anyone changing a CLI rule |
| `doc-types/api-reference/SKILL.md` | A routing file that owns no rules | Rarely, it only points elsewhere |
| `scripts/` | The whole enforcement layer | Anyone adding a check, a fixer or a test |
| `scripts/checks/` | 42 check modules, one concern each | Adding or widening a check |
| `scripts/lib/` | 14 shared parsers and helpers | Adding a primitive two checks need |
| `scripts/data/` | The rule registry, the check map, the wordlists, two generated tables | Adding a rule or a wordlist entry |
| `scripts/fix/` | 10 fixers, deterministic and model-backed | Fixing findings at corpus scale |
| `scripts/build/` | Two generators that produce committed artifacts | After changing a section-order table or a rule |
| `scripts/test/` | 35 test files plus fixtures, 631 tests | Every change to any of the above |
| `MERGE-NOTES.md` | The merge history and the maintenance policy | When merging another fork |
| `REFERENCE-RULES.md` | Generated rule catalog | Never manually, run `npm run build:readme` |
| `REFERENCE-CHECKS.md` | Generated check catalog | Never manually, run `npm run build:readme` |
| `.doc-review/` | Scratch output from the probe, review and judge scripts | Generated, and gitignored |

## Pick a doc type

Twelve types are linted by `lint-doc.js`. Three more page shapes are linted by `lint-api-ref.js`. Getting this choice right matters more than any single rule, because the type determines which sections are required and which are forbidden. A misclassified page produces a long list of findings that are all wrong in the same way.

### Types by subject

| The page is about | Type | Template |
| --- | --- | --- |
| The product's single entry point | `getting-started` | `types/getting-started.md` |
| A concept, behavior or pattern | `conceptual-guide` | `types/conceptual-guide.md` |
| One product feature, from enabling it to configuring it | `feature-doc` | `types/feature-doc.md` |
| One task, titled as an instruction | `how-to-guide` | `types/how-to-guide.md` |
| Configuring an environment or SDK | `setup-guide` | `types/setup-guide.md` |
| A runnable starter application | `kickstarter` | `types/kickstarter.md` |
| Upgrading across a breaking change | `migration-guide` | `types/migration-guide.md` |
| The landing page of a chapter | `chapter-index` | `types/chapter-index.md` |
| The command surface of a CLI plugin | `cli-command-reference` | `cli-templates/cli-command-reference.md` |
| One CLI operation, from first command to verification | `cli-task-runbook` | `cli-templates/cli-task-runbook.md` |
| A CLI lookup table of identifiers | `cli-module-reference` | `cli-templates/cli-module-reference.md` |
| Building and publishing a `csdx` plugin | `cli-plugin-guide` | `cli-templates/cli-plugin-guide.md` |
| An SDK reference landing page | `usage_guide` | `api-ref/api-ref-usage-guide-v2.md` |
| One SDK class | `class_reference` | `api-ref/api-ref-class-v2.md` |
| One SDK method | method page | `api-ref/api-ref-method-v2.md` |

Declare the choice in the page's front matter as `doc_type: <value>`, using the value from the table. A declared type beats the linter's heuristic, which matters: on one corpus of 355 files the heuristic answered `conceptual-guide` for 327 of them, and the section rules then asked all 327 for sections they should never have. `classify-doc-type.js` can declare the whole corpus in one pass.

### Three families

Rule inheritance differs by family, so read the right pair of files.

| Family | Types | Rules that apply | Linter |
| --- | --- | --- | --- |
| Prose | The eight `types/` entries above | `types/common-rules.md` B1, B2, C1 to C9, plus the type file | `lint-doc.js` |
| CLI | The four `cli-templates/` entries | The prose rules, plus `cli-templates/cli-common-rules.md` CLI-C1 to CLI-C15, plus the type file | `lint-doc.js` |
| API reference | `usage_guide`, `class_reference`, method page | The `api-ref/` templates, plus the AR and UG rules | `lint-api-ref.js` |

The API reference family needs its own linter rather than a flag on the shared one. An api-ref method page has no H1 title and no H2 sections, so the shared type detection falls through to `conceptual-guide` and the run fills with findings for a missing Overview and missing Prerequisites that the shape never had.

`types/section-matrix.md` is the cross-type lookup: one table of 26 sections against 12 doc types, each cell Required, Optional or Not used. Use it to answer "does this type take a Troubleshooting section" without opening four files. It does not cover the three api-ref shapes. `doc-types/api-reference/SKILL.md` routes a reader to those, and `api-ref/api-ref-usage-guide-v2.md` and `checks/api-ref-structure.js` also enumerate them. One caveat before relying on the matrix. `data/section-matrix.json` is generated but never read at runtime. `lib/section-index.js` requires it and re-exports it unused, and nothing else in `scripts/` touches it, so the matrix is documentation rather than enforcement.

### Required sections

Generated from `scripts/data/section-order.json`, which is what the linter actually reads.

| Type | Required sections after the title |
| --- | --- |
| `getting-started` | Overview, Role-Based Routing Table, Prerequisites, Quick Start, Documentation Map, Next Steps |
| `conceptual-guide` | Overview, Main Content, Next Steps |
| `feature-doc` | Overview, Main Content, Troubleshooting, Next Steps |
| `how-to-guide` | Overview, Prerequisites, Main Content, Next Steps |
| `setup-guide` | Overview, Prerequisites, Main Content, Troubleshooting, Next Steps |
| `kickstarter` | Overview, Prerequisites, Main Content, Next Steps |
| `migration-guide` | Overview, Prerequisites, Type Mapping Reference, Main Content, Gradual Migration, Troubleshooting, Pre-Upgrade Checklist, Next Steps |
| `chapter-index` | Overview, On this chapter, See also |
| `cli-command-reference` | Overview, Prerequisites, Commands, Examples, Limitations |
| `cli-task-runbook` | Overview, Prerequisites, Steps for Execution, Limitations |
| `cli-module-reference` | Overview, Quick Reference, Main Content |
| `cli-plugin-guide` | Overview, Prerequisites, Plugin Structure, Creating a Plugin, Plugin Registration and Linking, Commands and Flags, Publishing, Next Steps |

Every type also requires SEO front matter with `title`, `description` and `url`. A `migration-guide` requires a fourth key, `version`. An api-ref page is the exception: it carries exactly three keys, `uid`, `seo_title` and `seo_description`, and a method page leaves both SEO fields empty because it is a fragment rather than a standalone URL.

### What each type forbids

The forbidden list is the more useful half, because a page that carries a section belonging to another type competes with that type.

| Type | Must not contain |
| --- | --- |
| `chapter-index` | Troubleshooting, Prerequisites, Quick Start, Role-Based Routing Table, Documentation Map. It is navigation, so a fact a reader can learn only from the index is on the wrong page. |
| `kickstarter` | Theory sections. The page exists to get an application running. |
| `getting-started` | Deep conceptual explanation, exhaustive API detail, more than ten Quick Start steps. |
| `migration-guide` | Theory sections, and any unlabelled statement about a version. Every claim says which version it applies to. |
| `cli-command-reference` | A page-level Troubleshooting section. Link the troubleshooting hub instead. |
| `cli-task-runbook` | A page-level Troubleshooting section, more than one procedure spine, a command shown before the step that runs it. |
| `cli-module-reference` | Prerequisites, Troubleshooting, Limitations. Entries link out rather than duplicating what they link to. |
| `cli-plugin-guide` | A page-level Troubleshooting section. |
| Every CLI type | A heading below H3, because the renderer emits anchors for H2 and H3 only. |
| `usage_guide` | Per-method detail. It states what is true of the whole SDK. |

The chapter index type exists because of this failure mode. Fifteen `index.md` pages were being judged against the get started row, which produced 72 findings asking a chapter index for a Quick Start, a Role-Based Routing Table and a Documentation Map. A chapter index carrying all three would be a second get started guide.

## Rule system

### Groups

A rule ID is a prefix plus a number. The prefix says which group states it and, indirectly, which file owns it.

| Prefix | Governs | Count |
| --- | --- | --- |
| `B1` | The ordered audit checklist. Stop at the first "No". | 11 |
| `B2` | The anti-pattern table. | 9 |
| `C1` | Structure and flow. Do, then understand, then debug. | 6 |
| `C2` | Scannability. Tables, bullets, headings, diagrams, callouts. | 14 |
| `C3` | Language and tone. The largest group. | 30 |
| `C4` | Code versus prose. | 8 |
| `C5` | Cross-references. | 6 |
| `C6` | Content accuracy and grouping. | 8 |
| `C7` | Duplication. | 6 |
| `C8` | Developer tone. No marketing language. | 9 |
| `C9` | CLI command documentation, from the prose side. | 4 |
| `FM` | Front matter. | 2 |
| `RS1` to `RS3` | Get started routing, quick start, exclusions. | 11 |
| `MIG` | Migration guide specifics. | 9 |
| `AR` | API reference page anatomy. | 10 |
| `UG` | Usage guide anatomy. | 13 |
| `CLI` | Shared CLI rules. | 20 |
| `PLG` | Plugin guide specifics. | 5 |

Three more groups exist in prose only and have no registry entry, so nothing enforces them. `CMD1` to `CMD3` in the command reference, `RUN1` to `RUN5` in the task runbook, and `MOD1a` to `MOD4` in the module reference. See [Known gaps](#known-gaps).

IDs are dense but not category-semantic. `C3-13` is the retry-count rule and `C3-14` the ordered-list rule, which are not siblings in meaning. Never infer the next number from a topic.

### Tiers

The tier determines what happens when a rule fires, and it is the concept that explains hook behavior, the gate and the whole review loop.

| Tier | Rules | Behavior |
| --- | --- | --- |
| 1 | 78 | Blocks. The linter's exit code comes from the tier-1 count alone, and the editor hook refuses the edit. |
| 2 | 57 | Advisory. Reported as context, never blocking. |
| 3 | 46 | Needs a reader. No automated check, adjudicated by a human or by a model through the review loop. |

A tier-3 rule must not name a check, and a tier-1 or tier-2 rule must name one. `lib/rules-registry.js` enforces both directions.

### The registry

`scripts/data/rules-registry.json` is the machine-readable source of truth. 181 entries, each with eight fields.

| Field | Meaning |
| --- | --- |
| `id` | The stable identifier a finding reports |
| `source` | The markdown file that states the rule in prose |
| `docTypes` | `all`, or the specific types it is scoped to |
| `rule` | What the rule requires |
| `why` | The rationale, usually the incident that produced it |
| `exception` | When it does not apply |
| `tier` | 1, 2 or 3 |
| `checkId` | The check that enforces it, absent for tier 3 |

`lib/rules-registry.js` validates the registry as one artifact, and this is deliberate. A second registry in a subfolder was tried and reverted, because it sits outside this validation, which is how a rule ships claiming coverage that never existed. The load-bearing invariant is the last one: a check that emits a rule ID owned by a different check reports the wrong rule text to the reader while looking perfectly healthy. That happened once, when the ordered-list check shipped emitting `C3-13`, which belongs to the retry-count rule.

Which file states which group:

| Source file | Rules |
| --- | --- |
| `types/common-rules.md` | 111 |
| `cli-templates/cli-common-rules.md` | 19 |
| `api-ref/api-ref-usage-guide-v2.md` | 13 |
| `types/getting-started.md` | 11 |
| `api-ref/api-ref-method-v2.md` | 10 |
| `types/migration-guide.md` | 9 |
| `cli-templates/cli-plugin-guide.md` | 5 |
| `cli-templates/cli-command-reference.md` | 1 |
| `section-order.json` and `parse-markdown.js` | 2, both synthetic |

### Numbering a new rule

Compute the next ID. Never hand-count it.

```bash
cd scripts
npm run probe -- --next-id=C3
```

This returns one past the highest number the prefix holds. `test/gap-loop.test.js` asserts that as an invariant rather than as a literal, so the guard survives every future rule.

## Toolchain

Everything runs from `scripts/`. Every corpus-taking script defaults to `../../docs`, so the layout it expects is this repository sitting beside a `docs/` folder inside a consuming project. No script names a specific project.

### Entry points

Grouped by job rather than alphabetically.

| Job | Command | What it does |
| --- | --- | --- |
| Lint one prose page | `npm run lint -- <file> --type=<type>` | Runs all 42 checks, prints findings by tier. Exit code from the tier-1 count. |
| Lint an api-ref page | `npm run lint:api-ref -- <file>` | The AR and UG checks, for the three api-ref shapes. |
| Sweep a corpus | `npm run sweep` | Lints every prose doc under a target and aggregates findings by rule, so you see the ranking. |
| Sweep blocking only | `npm run sweep:tier1` | The same, tier 1 only. |
| Check links | `npm run links` | Three-layer link and anchor check across the corpus. |
| Declare doc types | `npm run classify`, then `classify:apply` | Judges each page's type and writes `doc_type:` into its front matter. |
| Judge tone | `npm run judge:tone` | The model-backed judge for the judgment-bearing rules. |
| Judge counts and labels | `npm run reading` | C2-13, a stated count that disagrees with what it counts, and C2-14, a link label that misdescribes its destination. |
| Review tier 3 | `npm run review`, then `judge`, then `--reconcile` | Generate candidates, judge them, reconcile verdicts. |
| Probe for a gap | `npm run probe` | Finds every instance of a phrase and classifies why the linter missed it. |
| Fix dashes | `npm run fix:dashes` | The deterministic C3-05 pass. |
| Audit wordlists | `npm run audit:wordlists` | Finds literal entries that are narrower than their rule. |
| Mirror two folders | `npm run mirror`, `mirror:fix` | Restores byte-identical parity between a source and its mirror. |
| Rebuild section data | `npm run build:section-order` | Regenerates the two generated JSON tables. |
| Rebuild the catalogs | `npm run build:readme` | Regenerates the two REFERENCE files. |
| Everything that gates | `npm run gate` | `test`, then `links`, then `sweep:tier1`. Run before any commit. |
| Run the tests | `npm test` | 631 tests across 35 files. |

The judges and the mirror sit outside `gate` on purpose. The judges cost money per call and need the `claude` CLI, so they must never run on a keystroke. The mirror rewrites files.

### Architecture

```
  npm script
      |
      v
  lint-doc.js  /  lint-api-ref.js  /  sweep-docs.js
      |
      +--> checks/*.js            42 modules, one concern each
      |        |
      |        +--> lib/*.js      14 shared parsers and helpers
      |        +--> data/*.json   wordlists and generated tables
      |
      v
  lib/report.js                   findings keyed by rule ID and tier
      |
      v
  exit code from the tier-1 count
```

`lint-doc.js` answers "is this file clean". `sweep-docs.js` answers "how often does this fire, and where else", which is the question that drives a rule change, because the ranking says which single wordlist entry or widened pattern buys the most.

### Checks

A check module exports a function taking the parsed document and returning findings. `lint-doc.js` holds them in one `CHECKS` array, and a new check is wired in by adding it there. The five kinds, from `data/check-sources.json`:

| Kind | Count | Meaning |
| --- | --- | --- |
| `structural` | 39 | Parses the document model and reports on shape, order or completeness. |
| `unimplemented` | 21 | Registered with no module behind it. The rule is stated and tiered, and nothing enforces it. |
| `regex` | 16 | Matches a named pattern against prose, outside code fences. |
| `wordlist` | 8 | Matches entries from a JSON data file, so the rule widens by data rather than by code. |
| `candidate` | 2 | Emits a tier-3 candidate for adjudication rather than a finding. |

Four modules carry a disproportionate share of the rules. `api-ref-structure.js` owns 18 check IDs, which is every AR and UG rule. `banned-phrases.js` addresses 13 rules from wordlist data. `tier3-candidates.js` is the whole tier-3 candidate engine and states the principle the judges follow, that a candidate is a question and a lint failure has to be an answer. `section-structure.js` drives section order off the generated JSON.

Per-check detail is in [REFERENCE-CHECKS.md](REFERENCE-CHECKS.md).

### Shared libraries

These are the reuse surface. Before writing a helper inside a new check, look here, because most of these exist precisely because two checks each carried their own copy and the copies disagreed.

| Module | Provides |
| --- | --- |
| `parse-markdown.js` | The parser. Sections, tables, fences, front matter. |
| `doc-model.js` | Convenience accessors over a parsed document, including prose-only line ranges. |
| `prose-mask.js` | One definition of which characters on a line are prose. The reason no check fires inside a code fence. |
| `section-index.js` | Maps a section-order row to a real heading, handling the rows that are not literal H2 headings. |
| `rules-registry.js` | Registry access, tier and doc-type filtering, `nextRuleId`, and the validation invariants. |
| `report.js` | The Finding shape, and tier semantics. |
| `slugify.js` | One definition of the anchor a heading gets. There were two, and they disagreed on 180 of 3,314 headings. |
| `markdown-links.js` | One definition of how a link is read off a page, shared by the link checker and the label check. |
| `table-shape.js` | Where a table row's cells begin and end. Exists because a punctuation pass corrupted 19 rows and nothing caught it. |
| `similarity.js` | Word-shingle overlap, the shared basis of every duplication check. |
| `phrase-list.js` | The phrase-matching primitives shared by the wordlist checks and the gap probe. |
| `inflect.js` | Generates the surface variants a literal wordlist entry fails to cover. |
| `corpus-class.js` | Which corpus a file belongs to, and therefore which page-shape rules apply. |
| `claude-runner.js` | One place to shell out to the `claude` CLI in headless mode, with a re-prompt on a violated constraint. |

### Data

`data/` holds the registry, the check map, the wordlists and two generated tables.

The wordlist folders are `banned-phrases/` with 12 files, `passive-voice/` with 9, `anthropomorphism/`, `metaphors/`, `periphrasis/`, `vague-reference/` and `house-verbs/`, plus `acronyms.json` and `wordy-connectors.json`. A wordlist rule widens by adding an entry, which is why it needs no code change and why `audit:wordlists` exists to catch entries narrower than their rule.

`section-order.json` and `section-matrix.json` are build output. `build/build-section-order.js` produces them from the `## Section Order` tables in `types/*.md` and `cli-templates/*.md` and from `types/section-matrix.md`. **The linter never parses those markdown files at runtime, it reads only the generated JSON.** Editing a section-order table without rebuilding changes nothing.

`corpus-classes.json` determines which files count as documentation pages. It exists because rules describing a page's shape were firing on files whose shape something else owns. On one corpus, 2,558 of 3,789 tier-1 findings were on files that are never published, including 254 asking for SEO front matter on an agent skill file. Override it per project with the `DOC_STANDARDS_CORPUS_CLASSES` environment variable, which is tried before the built-ins and merged over them. A malformed override is reported and ignored.

### Fixers

Two kinds. A deterministic fixer rewrites text by rule. A model-backed fixer shells out to the `claude` CLI once per finding, because the edit needs judgment.

| Fixer | Rules | Kind |
| --- | --- | --- |
| `fix-dashes.js` | C3-05 | Deterministic. C3-05 was 78 percent of all tier-1 findings on one corpus, 4,497 lines across 169 files, which is far too many for one model call each. |
| `fix-emoji-italics.js` | C3-27, C3-28, C3-30 | Deterministic, with an optional model pass. |
| `fix-acronym-first-use.js` | C8-07 | Deterministic. Expands a closed-list acronym at its first bare use, once per acronym per file. |
| `fix-banned-phrases.js` | The banned-phrase rules | Model-backed. Swapping a phrase in verbatim breaks grammar. |
| `fix-concision.js` | C3-07 | Model-backed. Judging a stacked clause needs reading. |
| `fix-tense.js` | C3-19 | Model-backed. Mechanical swaps break agreement about half the time. |
| `fix-anthropomorphism.js` | C3-18 | Model-backed. Four verbs carried 480 of 648 findings. |
| `repair-anchors.js` | None directly | Keeps links working across a pass that rewrites headings. A heading's anchor comes from its text, and 794 headings on one corpus contained a dash. |
| `finish-dash-pass.js` | None directly | Runs every step that must follow a corpus-wide C3-05 pass, in order. The order is load-bearing, and two of the steps produce no error when run out of sequence. |
| `verify-edit-integrity.js` | None directly | Proves a punctuation pass changed punctuation and nothing else. |

Read that last row before running any fixer at corpus scale. A `--report` showing zero remaining findings proves only that the findings are gone. It says nothing about whether a sentence, a table row, a code sample or a link survived.

### Judges

Three scripts call a model because the rule needs a reader.

| Script | Rules | Note |
| --- | --- | --- |
| `judge-tone.js` | C3-18, C3-21, C2-09, C3-25 | Also has a discovery mode that hunts wording no wordlist covers. |
| `judge-reading.js` | C2-13, C2-14 | A stated count that disagrees with what it counts, and a link label that misdescribes its destination. |
| `classify-doc-type.js` | None. It declares types. | Replaces a heuristic that answered `conceptual-guide` for 327 of 355 files. |

All three need the `claude` CLI and cost money per call. None is in `gate`, and none may ever run inside a check.

### Tests

`npm test` runs `node --test test/*.test.js`. 631 tests across 35 files, all passing, none skipped.

Fixtures work as matched controls: `clean-feature-doc.md` beside `broken-feature-doc.md`, `clean-cli-command-reference.md` beside its broken twin, and `api-ref-good/` beside `api-ref-broken/`. A clean fixture that starts reporting findings is as much a failure as a broken fixture that stops.

The rule that governs a new test comes from the gap loop: a regression test that has never failed is not yet a test. Write the test, watch it fail against the unfixed code, then fix.

## Workflows

### 1. Write a new page

1. Select the type from [Types by subject](#types-by-subject).
2. Read `types/common-rules.md` B1 and B2, then the type file, in full.
3. Declare `doc_type:` in the front matter.
4. Build the page in the section order the type requires.
5. Lint it: `cd scripts && npm run lint -- ../path/to/page.md --type=<type>`.
6. Fix every tier-1 finding. Read the tier-2 findings and fix what is genuinely wrong.

### 2. Revamp an existing page

Run `/revamp-doc` and let it drive. It detects the type, lints, reads the rule files, runs the B1 and B2 audit, then edits in place.

That command handles seven of the twelve types. For a `chapter-index`, any of the four CLI types, or an api-ref page, work manually: identify the type yourself, pass `--type=` explicitly, and read the matching template. See [Known gaps](#known-gaps).

Never write a `-revamped.md` sibling. Confirm the file is clean in `git status` first, then edit in place.

### 3. Audit a corpus

```bash
cd scripts
npm run sweep            # every finding, ranked by rule
npm run sweep:tier1      # blocking findings only
npm run links            # links and anchors
```

Read the ranking rather than the file list. The top rule by count is where a single wordlist entry or a widened pattern buys the most.

### 4. Close a linter gap

Someone spotted a violation the linter did not catch. Run `/doc-gap`, which drives the whole loop. The shape of it:

1. Restate the violation as a probe label.
2. Baseline with `sweep-docs.js`.
3. Seed a probe and run `probe-corpus.js`.
4. Read the corpus manually for meaning-siblings. This is the step no script can do.
5. Widen, and apply the convergence test.
6. Classify the gap as `NOT_A_GAP`, `WORDLIST_GAP`, `REGEX_TOO_NARROW` or `NO_RULE`.
7. Apply the decision rule: add a wordlist entry, or widen a regex, or add a module and an ID. The tie-breaker is that if you have to rewrite the rule sentence, it is a new rule.
8. Codify and test.

### 5. Add or change a rule

1. `npm run probe -- --next-id=<PREFIX>` for the ID.
2. State the rule in prose in the owning markdown file, in the `Rule`, `Why`, `Exception` format.
3. Add the registry entry with all eight fields.
4. Add the `data/check-sources.json` entry.
5. Write the check in `checks/`, and wire it into the `CHECKS` array in `lint-doc.js`.
6. Extend a fixture and add a test. Watch it fail first.
7. `npm run build:readme` to regenerate the catalogs.
8. `npm run gate`.

Skipping step 4 or 7 leaves the registry claiming coverage the catalog does not show, which is the exact failure the validation exists to prevent.

### 6. Adjudicate tier 3

```bash
cd scripts
npm run review           # generate candidates
npm run judge            # ask the model, one candidate at a time
npm run review -- --reconcile
```

Generation only writes candidates and judgment only writes verdicts, one direction each, so regeneration is idempotent and cannot clobber a judgment already made.

### 7. Onboard a consuming repo

1. Place this repository so that `../../docs` from `scripts/` resolves to the project's docs folder, or pass a target explicitly.
2. If the project has non-documentation markdown under `docs/`, write a corpus-class file and point `DOC_STANDARDS_CORPUS_CLASSES` at it. Skipping this is what produces thousands of findings on files nobody publishes.
3. Run `npm run classify` and then `classify:apply` to declare `doc_type:` across the corpus.
4. Baseline with `npm run sweep:tier1`.
5. Confirm the editor hooks are installed, per the next section.

## Wider setup

Three pieces outside this repository make it work. All are per-machine, in `~/.claude/`.

### The slash commands

| File | Does | Known limit |
| --- | --- | --- |
| `~/.claude/commands/revamp-doc.md` | Brings one page into compliance. Detects the type, lints, reads the rule files, audits, edits in place. | Handles seven of the twelve types. |
| `~/.claude/commands/doc-gap.md` | Turns a missed violation into a permanent check with a test. Writes to `checks/`, the registry, the check map and `test/`. | Hardcodes one project's corpus path. |

### The editor hooks

`~/.claude/settings.json` registers a `PostToolUse` hook chain on `Write|Edit`, in this order:

1. `~/.claude/hooks/check_doc_dashes.py`, 15 second timeout. Enforces C3-05 in Python, outside fenced code and inline code spans. Blocks.
2. `~/.claude/hooks/lint_doc_standards.py`, 60 second timeout. Runs the repository's own linter.

The second hook is worth understanding, because its behavior is deliberate at three points.

- It **walks up** from the edited file looking for `doc-standards/scripts/lint-doc.js` rather than hardcoding a path, because the linter is checked into the repository it lints and this repository is not the only consumer.
- Tier 1 blocks so the agent self-corrects. Tier 2 arrives as non-blocking context, because blocking on every passive-voice candidate would make editing documentation impossible.
- It **fails open** everywhere. A hook that fails closed blocks all editing.

It excludes three path markers: `doc-standards/`, `.doc-review/` and `doc-standards/scripts/test/fixtures/`. Fixtures carry violations on purpose, so linting them would block every edit to the test suite.

Note the asymmetry. The dash hook treats `doc-standards/` as a documentation path and so does check this repository's own prose, while the linter hook excludes it.

### The global instructions

`~/.claude/CLAUDE.md` points at `~/.claude/global-instructions/doc-writing-rules.md` for all documentation work, and says to prefer a project-level `doc-standards` folder for anything it covers.

Treat this repository as authoritative. That global file states its own provenance as a static distillation of one of the five July forks, and it has drifted. It hard-states that passive voice is never acceptable, which contradicts C3-10's exception for predicate adjectives, and it adds rules that canonical C3 does not carry.

### New machine setup

```bash
git clone https://github.com/aravindh-cstk/doc-standards.git
cd doc-standards/scripts
npm test                                  # expect 631 passing
```

Then place `revamp-doc.md` and `doc-gap.md` in `~/.claude/commands/`, place both hook scripts in `~/.claude/hooks/`, and add the `PostToolUse` block to `~/.claude/settings.json`. Confirm the chain works by writing a deliberate em dash into a markdown file under a `docs/` path and checking that the edit is refused.

## Known gaps

Accurate as of 2026-09-08. These are documented rather than fixed, so nobody trusts a rule that is not enforced or follows a path that no longer resolves.

### Files breaking their own rules

Counts are the linter's own tier-1 findings, not a raw character scan, so a glyph inside a code fence or an inline code span is already excluded.

| File | Breaks |
| --- | --- |
| `types/getting-started.md` | C3-05, 25 findings across 12 em dashes, 5 en dashes and 11 semicolons |
| `types/common-rules.md` | C3-27, 15 findings across 17 arrow glyphs. C3-28, 1 |
| `types/migration-guide.md` | C3-27, 1 arrow glyph |
| `api-ref/api-ref-method-v2.md` | C3-27, 7 findings across four check marks, one cross mark and two arrows. C3-28, 4 |
| `api-ref/api-ref-class-v2.md` | C3-27, 1 arrow glyph. C3-28, 3. C8, the superlative in its `Optional but powerful` bullet label |
| `api-ref/api-ref-usage-guide-v2.md` | C3-28, 7 |
| `api-ref/usage-guide-derivation.md` | C3-28, 10 |

The 25 C3-28 italics findings fall into two mechanical patterns. The `*(required when X)*` parenthetical idiom accounts for 14 across the three `api-ref` templates, and the italic paragraph lead-in label accounts for 9 in `usage-guide-derivation.md`.

`api-ref/usage-guide-derivation.md` also contains an en dash, a semicolon and four arrows, and the linter correctly reports none of them. They sit inside a fence the author opened deliberately, saying so at line 83: quoted verbatim in a fenced block because the source punctuation does not follow this repository's house style. Whether a fence is an acceptable escape hatch for quoted text is an open question, not a violation.

`MERGE-NOTES.md` claims every file in the folder avoids these characters. That claim is currently false.

### Bugs that produce wrong findings

Every other entry in this section is a missing finding. These three are wrong findings, which costs more trust, and all three are reproducible today.

- **A correct callout label fires a false error.** `checks/callout-taxonomy.js` accepts only the singular `Additional Resource` and emits `C2-11` at tier 1. `AR-06` requires the plural whenever a callout carries two or more links, and `checks/api-ref-structure.js` enforces that agreement. So a callout correctly written `> **Additional Resources:**` for three links is a tier-1 error. `test/fixtures/api-ref-good/Taxonomy/class_reference.md` carries a plural label and escapes only because `lint-api-ref.js` excludes this check.
- **A compliant Quick Reference fires a false error.** `checks/quick-reference-table.js` hard-codes the expected columns as Use case, Section and Key call, and emits `C2-04` at tier 1 for a missing one. `MOD2` in `cli-templates/cli-module-reference.md` specifies a different shape for this type, each module or command mapped to its anchor. A module reference built to its own template fails the linter.
- **The drift form the rule exists to catch is invisible.** The blockquote pattern in `checks/callout-taxonomy.js` matches only the colon-inside-the-bold form, so `> **Note**:` matches nothing and produces no finding, from either `C2-11` or `CLI-09`. `CLI-09` is the rule whose entire purpose is that spelling.

### Stale paths

The nine prose rule files moved from the repository root into `types/` on 2026-09-08, and four references were not updated. Each still points at a root `common-rules.md` or `section-matrix.md` that no longer exists.

- `api-ref/api-ref-usage-guide-v2.md`, line 18, which also still says "the repo root"
- `api-ref/api-ref-method-v2.md`, line 72
- `api-ref/usage-guide-derivation.md`, lines 484 and 487

Line 18 carries a second error in the same sentence. It says the class and method templates apply `common-rules.md` the same way, but `api-ref-class-v2.md` never references that file.

Fourteen more references across nine `types/` files say `common-rules.md` with no path. Those resolve correctly, because the files sit in the same folder, so they are an inconsistency rather than a break. The occurrences in `MERGE-NOTES.md` describe the pre-move layout and are correct as history.

Two paths in `cli-templates/cli-common-rules.md`, at lines 223 and 249, carry a `doc-standards/` prefix that resolves from one directory up rather than from the repository root. The files exist at `scripts/data/banned-phrases/absent-docs.json` and `scripts/checks/internal-link-form.js`.

### Miscited rule ranges

`cli-templates/cli-common-rules.md` defines CLI-C1 to CLI-C15, with no gaps. Three of the four CLI templates tell the reader to apply CLI-C1 to CLI-C14, so CLI-C15 is invisible from them. Only `cli-plugin-guide.md` cites the full range. The shared file returns the favor: its own line 5 lists the per-type files and omits `cli-plugin-guide.md`.

One rule carries two numbers. `cli-command-reference.md` calls the Installation rule `CMD2`, while the registry entry `CLI-07` and `checks/cli-specific.js` both call it `CMD4`.

### Rules with no check

21 entries in `data/check-sources.json` carry `kind: unimplemented`, covering 23 rules between them. Each rule is stated and tiered, and nothing enforces it, so a page can break it and lint clean: `AR-10`, `B1-07`, `B2-07`, `C4-02`, `C4-03`, `C6-03`, `C9-01` to `C9-03`, `CLI-08` to `CLI-15`, `CLI-18`, `CLI-20`, and `PLG-01` to `PLG-04`.

Twelve of those `checkId` values are placeholders that name a different rule than the one they are attached to, which is a trap for whoever writes the check. `CLI-08` is the placeholder-bracket rule but its `checkId` is `cli-flag-prose-heuristic`. `CLI-10` is the no-shell-prompt rule but its `checkId` is `cli-error-entry-heuristic`. Renaming one means editing both the key in `data/check-sources.json` and the `checkId` on the rule, because `lib/rules-registry.js` fails on a mismatch.

Not every one of the 23 can become a check. On inspection, 13 are decidable by a parse or a regex, 7 can only flag candidates and belong at tier 2 or tier 3, and 3 genuinely need a reader and should be retiered: `AR-10`, because a parameter default's provenance is not on the page, `CLI-15`, whose own rationale names the defeating case of a flag that kept its name and changed its meaning, and `RUN3`, because correct step order is a fact about the operation.

A further 18 pairs sit in the unemitted-claims list, where a module owns the rule but never names its ID. Fourteen are legitimate: one emitted finding covers several registry rules, or the ID is built from a variable that the source scan cannot see. Four are real, all under `callout-frequency`. `B1-08` and `C5-01` ask whether every outbound callout has been classified, which needs a reader. `B2-04` and `C5-03` forbid a callout placed mid-flow, which is mechanically checkable and simply unwritten. `test/gap-loop.test.js` freezes the list so it can shrink but not grow unnoticed. Both lists are in [REFERENCE-CHECKS.md](REFERENCE-CHECKS.md).

### Prose-only rules

Four of the twelve linted types have no type-specific registry entries. Nothing cites `cli-templates/cli-task-runbook.md`, `cli-templates/cli-module-reference.md`, `types/chapter-index.md`, `types/section-matrix.md`, `types/writing-guide-agent-skills.md` or `api-ref/api-ref-class-v2.md` as a source, and `cli-command-reference.md` supplies exactly one rule.

Having no registry entry is not the same as having no enforcement. Five of these prose rules are already enforced under another rule's ID, which is why they never needed one:

| Prose rule | Enforced as |
| --- | --- |
| `CMD3` and `RUN5`, no Troubleshooting section | `CLI-19`, and `section-structure.js` keys it off whether the doc is a CLI doc rather than off its type |
| `RUN4`, Limitations is required | `C1-01`, through the required row in `section-order.json` |
| `MOD2`, a Quick Reference must be present | `C1-01`, the same way. Its completeness half is not checked |
| The chapter-index ban on Quick Start, Role-Based Routing Table and Documentation Map | `C1-01`, through the get-started-only forbidden list |

What genuinely has no enforcement: `CMD1`, the other direction of `CMD2`, `RUN1`, `RUN2`, `RUN3`, `MOD1a`, `MOD1b`, the completeness half of `MOD2`, the Prerequisites and Limitations halves of `MOD3`, `MOD4`, and four of the six chapter-index rules. The cheapest of those is `MOD3`, because `section-structure.js` already has the exact per-type forbidden-list shape it needs, and `compareOrder` already computes an `unexpected` array that nothing reads.

### Duplicate rules

- The callout-label rule appears twice in C2 with inconsistent wording. One states four valid labels ending in `Additional Resources`, plural, and has no registry entry. The other states four ending in `Additional Resource`, singular, and is `C2-11`. The implemented check enforces the singular, which is the first of the three bugs above. C2 has a wider bookkeeping problem: 15 prose rules against 14 registry IDs, with two prose rules unregistered and `C2-10` registered with no prose counterpart.
- Three rules state that no CLI doc carries a page-level Troubleshooting section. `CLI-19` at tier 1 covers the command reference, task runbook and module reference. `PLG-05` at tier 1 covers the plugin guide. Both are enforced by `section-structure.js`, so all four CLI types are in fact covered. `CLI-18` restates the same thing at tier 2 across every CLI doc, and its `checkId` is unimplemented, which makes it redundant rather than a coverage hole. It still counts toward the unimplemented list above.

### Tooling drift

- `~/.claude/commands/doc-gap.md` hardcodes `CORPUS="$ROOT/studio-docs/docs"`. That is exactly the project coupling that commit `c353d8b` removed from every script in this repository.
- `~/.claude/commands/revamp-doc.md` handles seven doc types. A CLI page, a chapter index or an api-ref page run through it gets typed and linted as something else.

### Dangling references

`cli-templates/cli-common-rules.md` cites `notes/reports/flag-inventory.json` twice and `scripts/gen_flag_accuracy_report.py` once. Neither exists here, both were CLI Project artifacts. `changelog/`, `troubleshooting/` and `repo/cli-plugins` in the same file are consuming-repo paths, not paths in this repository.

The cost is not even across the two. At line 79 the missing filename is incidental, because the instruction that matters, verify against the `oclif.manifest.json` in the published npm tarball, survives without it. At line 201 the entire "How to check" procedure for CLI-C11 is built on both missing files, so that rule currently ships with no way to satisfy it. Its four defect classes are worth keeping as a manual checklist.

### Duplicated content

`types/writing-guide-agent-skills.md` maintains a second copy of the C8 marketing table, the jargon table with the same per-word fixes, and the acronym list. Its own scope note says it supplements rather than replaces, but the two copies now drift independently.

### Leftovers

`doc-types/api-reference/` holds one file and nothing else. It is named `SKILL.md` and no skill loader reads it, because it sits outside any `.claude/skills` tree. It routes a reader and owns no rules, which its own text says. Splitting the AR rules into a folder of their own was tried and reverted, and this file is what remains.

## Editing this repo

Five conventions.

1. **This prose follows these rules.** No em dashes, no en dashes, no semicolons, per C3-05. No emoji and no arrow glyphs, per C3-27. No italics, per C3-28. The dash hook checks this repository, so a violation blocks the edit.
2. **Edit this copy only.** Every other `doc-standards` folder on the machine is read-only history.
3. **Rebuild after a table change.** Touching a `## Section Order` table means `npm run build:section-order`. The linter reads only the JSON.
4. **Rebuild after a rule change.** Adding or retiering a rule means `npm run build:readme`, or the catalogs drift from the registry.
5. **Gate before committing.** `npm run gate` runs the tests, the link check and the tier-1 sweep.

For more information on how the current rule set was assembled, refer to [MERGE-NOTES.md](MERGE-NOTES.md).
