---
name: api-reference-docs
description: Rules and linter for SDK class/method API reference pages (a class page plus one page per method, each with a parameter table, Validation, Behavior, and Example sections). Load this instead of the general doc-standards templates when the doc being written or audited is this shape. For every other doc type (conceptual guide, feature doc, getting started, how-to, kickstarter, migration guide, setup guide), use types/common-rules.md and the matching template in types/ instead.
---

# API reference docs

## Is this the right doc type

A doc is an API reference page, and this folder applies, when it is organized as one page per
class plus one page per method, and each method page has a parameter table, a `Returns` line, and
worked code examples. A Method Index (a table of every method on a class page, linking to that
method's own page) is the clearest single signal.

The doc type has three page shapes, classified by filename, matching the three CMS content types in
the reference chain: `usage_guide.md` is the one standalone entry page for an SDK,
`class_reference.md` is a class page, and anything under `methods/` is a method page. A usage guide
owns an H1 and carries no trailing rule, like a class page, but its section set and its two
navigation tables (Class Overview and Task Index) are its own, which is why the `UG-*` rules exist
separately from the `AR-*` ones.

If the doc is prose organized around a task or a concept instead (a guide, a getting-started walkthrough,
a migration path, a setup procedure), it is not this doc type. Use `types/common-rules.md`
plus the matching template in `types/` (`conceptual-guide.md`, `feature-doc.md`, `getting-started.md`,
`how-to-guide.md`, `kickstarter.md`, `migration-guide.md`, or `setup-guide.md`) and lint with the
root `scripts/lint-doc.js`.

Do not mix the two. A conceptual guide does not need a Method Index or a Validation section. An API
reference method page does not need an Overview or a Prerequisites section. Applying the wrong doc
type's structural rules is a common and avoidable review mistake.

## Where everything actually lives

This folder holds this file and nothing else. The templates, rules and linter for the doc type all
live in the shared tree:

| What | Where |
|---|---|
| Method page template (parameter table, Returns line, Validation, Behavior, Example, Additional Resource) | `api-ref/api-ref-method-v2.md` |
| Class page template (constructor or properties table, Class-Level Notes, Method Index, Class-Level Snippet) | `api-ref/api-ref-class-v2.md` |
| Usage guide template (Before you begin, Class Overview table, Task Index, Usage Patterns, SDK-Wide Notes, SDK Limitations) | `api-ref/api-ref-usage-guide-v2.md` |
| How the usage guide shape was derived | `api-ref/usage-guide-derivation.md` |
| The `AR-01` to `AR-10` and `UG-01` to `UG-13` structural rules | `scripts/data/rules-registry.json`, tagged `docTypes: ["api-ref"]` |
| The structural check that emits them | `scripts/checks/api-ref-structure.js` |
| The linter | `scripts/lint-api-ref.js` |

Everything that is not about this doc type's structure comes from the root and applies unchanged:
banned phrases, the no-dash rule, passive voice, metaphors, periphrasis, sentence concision, numeric
error codes as inline code, embedded questions, bolding a retry count, and every other entry in the
`types/common-rules.md`.

`lint-api-ref.js` exists as a separate runner because `detectDocType` in `lint-doc.js` classifies a
method page as a conceptual guide, which floods the report with missing-Overview findings. It reuses
the root `scripts/checks/*.js` content checks directly and drops the eight that are meaningless for
this shape. The reason for each exclusion is recorded in a comment at the top of that file.

If you want to add a rule here that is really about wording or tone rather than this doc type's
structure, it belongs in the `types/common-rules.md` instead, so every doc type benefits from it.

To add a structural rule, compute the next free ID rather than guessing it:

```
node scripts/probe-corpus.js --next-id=AR
```

## Running the linter

```
node scripts/lint-api-ref.js <file-or-dir> [--format=text|json] [--tiers=1,2] [--baseline=<canonical doc-set root>]
```

Same flags and exit codes as the root `scripts/lint-doc.js` (0 clean, 1 on a tier-1 finding, 2 on a
usage error). Point it at a class page, a methods folder, or a whole reviewed doc-type directory.
Unlike `lint-doc.js`, it accepts a directory and scans it recursively for `class_reference.md` and
`methods/*.md`, sorting class pages ahead of their methods.

Use this rather than `sweep-docs.js` for API reference pages. The sweep runs `lint-doc.js` per file,
which misclassifies them.

## Why the rules sit in the root registry, not in this folder

Splitting the `AR-*` rules into a folder of their own was tried and reverted, so this file exists to
route a reader rather than to own anything.

The registry is validated as one artifact. `lib/rules-registry.js` cross-checks
`rules-registry.json` against `data/check-sources.json` and against the check modules themselves: a
tier-3 rule may not name a `checkId`, a tier-1 or tier-2 rule must name one, and no check may emit
an ID another check owns. A second registry in a subfolder sits outside all of that, which is how a
rule ships advertising coverage that never existed. `test/gap-loop.test.js` guards the invariant and
records the one incident where it happened.

So the isolation is expressed as data, `docTypes: ["api-ref"]` on each rule, and the routing is
expressed here in prose. If you are deciding which rules apply to a page, read this file. If you are
changing a rule, edit the root registry and run `npm test` in `scripts/`.
