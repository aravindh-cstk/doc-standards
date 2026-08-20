---
name: api-reference-docs
description: Rules and linter for SDK class/method API reference pages (a class page plus one page per method, each with a parameter table, Validation, Behavior, and Example sections). Load this instead of the general doc-standards templates when the doc being written or audited is this shape. For every other doc type (conceptual guide, feature doc, getting started, how-to, kickstarter, migration guide, setup guide), use the repo root's common-rules.md and matching template instead.
---

# API reference docs

## Is this the right doc type

A doc is an API reference page, and this folder applies, when it is organized as one page per
class plus one page per method, and each method page has a parameter table, a `Returns` line, and
worked code examples. A Method Index (a table of every method on a class page, linking to that
method's own page) is the clearest single signal.

If the doc is prose organized around a task or a concept instead (a guide, a getting-started walkthrough,
a migration path, a setup procedure), it is not this doc type. Use the repo root's `common-rules.md`
plus the matching root-level template (`conceptual-guide.md`, `feature-doc.md`, `getting-started.md`,
`how-to-guide.md`, `kickstarter.md`, `migration-guide.md`, or `setup-guide.md`) and lint with the
root `scripts/lint-doc.js`.

Do not mix the two. A conceptual guide does not need a Method Index or a Validation section. An API
reference method page does not need an Overview or a Prerequisites section. Applying the wrong doc
type's structural rules is a common and avoidable review mistake.

## What this folder owns versus what it inherits from the root

This folder holds only what is genuinely specific to the class/method reference shape:

- `api-ref-method-v2.md`: the template for one method's page (parameter table, Returns line,
  Validation, Behavior, Example sections, Additional Resource callout conventions).
- `api-ref-class-v2.md`: the template for a class page (constructor or properties table, Class-Level
  Notes, Method Index, Class-Level Snippet).
- `rules-registry.json`: the ten `AR-01` through `AR-10` structural rules this doc type enforces
  (front matter shape, section order, the Returns line format, Method Index completeness, and so
  on). These IDs exist only here, not in the root registry, since they only apply to this doc type.
- `lint-api-ref.js` and `checks/api-ref-structure.js`: the linter that checks the above.

Everything else, every rule that is not about this doc type's specific structure, comes from the
repo root and applies here unchanged: banned phrases, the no-dash rule, passive voice, metaphors,
periphrasis, sentence concision, numeric error codes as inline code, embedded questions, bolding a
retry count, and every other entry in the root `common-rules.md`. `lint-api-ref.js` reuses the root
`scripts/checks/*.js` content checks directly rather than duplicating their logic. Only the
structural checks these general ones cannot express (front matter shape, section order, the
class/method split) live in this folder.

If you find yourself wanting to add a rule here that is really about wording or tone rather than
this doc type's structure, it almost certainly belongs in the root `common-rules.md` instead, so
every doc type benefits from it, not just this one.

## Running the linter

```
node doc-types/api-reference/lint-api-ref.js <file-or-dir> [--format=text|json] [--tiers=1,2] [--baseline=<canonical doc-set root>]
```

Same flags and exit codes as the root `scripts/lint-doc.js` (0 clean, 1 on a tier-1 finding, 2 on a
usage error). Point it at a class page, a methods folder, or a whole reviewed doc-type directory.

## Why this is a separate folder instead of a docType tag in the root registry

An earlier version of this work kept the `AR-*` rules in the shared root registry, distinguished
only by a `docTypes: ["api-ref"]` field. That made the isolation something only the linter script
knew about. A future Claude session skimming the repo to decide which rules apply had to read every
entry's `docTypes` field to figure out which subset was relevant. Moving the API-reference-specific
templates, rules, and linter into their own folder with this file at the top makes the doc-type
routing something a session can determine by reading one file, before touching any content.
