# Prose pages playbook

`/fix-docs` loads this file for a page in one of the eight prose types. It holds the rule knowledge a
reader needs to work the ledger for those pages. The steps and the scripts live in
`.claude/commands/fix-docs.md`.

## The rule files

Read both in full before editing a page:

1. `doc-templates/feature-docs/common-rules.md` holds the B1, B2 and C1 to C9 rules and the section
   definitions. Every prose type follows it.
2. `doc-templates/feature-docs/<type>.md` holds the section order and the type's own rules.

| Type | Template | `--type` value |
| --- | --- | --- |
| Get Started Guide | `getting-started.md` | `getting-started` |
| Conceptual Guide | `conceptual-guide.md` | `conceptual-guide` |
| Feature Doc | `feature-doc.md` | `feature-doc` |
| How-To Guide | `how-to-guide.md` | `how-to-guide` |
| Setup Guide | `setup-guide.md` | `setup-guide` |
| Kickstarter | `kickstarter.md` | `kickstarter` |
| Migration Guide | `migration-guide.md` | `migration-guide` |
| Chapter Index | `chapter-index.md` | `chapter-index` |

`scripts/data/section-order.json` is what the linter reads for section rules, so it wins when a
table in prose disagrees with it.

## The page type

`fix-all.js` writes `doc_type:` on any page that lacks it before it lints. When a page still has no
declared type, the linter detects one, in this order:

1. A `doc_type:` field in front matter.
2. A title that starts with "Get Started with", or both a Role-Based Routing Table and a Quick Start
   section, means a Get Started Guide.
3. An "On this chapter" section, or a body that lists the pages of one chapter, means a Chapter
   Index.
4. "Migrate", "upgrade" or "migration" in the title or Overview, or a Type Mapping Reference or
   Pre-Upgrade Checklist section, means a Migration Guide.
5. An imperative title such as "Fetch" or "Configure", or an Overview about one task, means a How-To
   Guide.
6. A page that installs or configures an environment, SDK or runtime is a Setup Guide.
7. A starter app with clone and run steps is a Kickstarter.
8. A page about one product feature is a Feature Doc.
9. Anything else is a Conceptual Guide.

When the ledger reports findings that only make sense for a different type, check the type before
fixing the findings. A wrong type produces a long list of findings that are all wrong in the same
way. Correct the `doc_type:` value and re-run the reconcile instead.

## Working a checklist item

A page's checklist names the tier-3 rules and the unenforced rules for its type. For each rule, read
the rule and its exception in `REFERENCE-RULES.md`, then read the page against it:

- **The page breaks the rule:** fix the page, and preserve all technical content. Do not change code
  blocks, API names, parameter names, flag names, URLs, file paths or version numbers.
- **The page meets it:** add the rule ID to `checked`.
- **The answer depends on a fact you cannot confirm:** record `needs-input` with the question.

Fix the B1 and B2 structural rules before the C1 to C9 style rules, because a moved or renamed
section changes which sentences the style rules read. C8 (developer tone) and C9 (CLI command
documentation) apply to every type. A Migration Guide also takes the migration C8 rules in
`migration-guide.md`.

## Chapter Index

Four of the six chapter-index rules have no check behind them, so the checklist is the only thing
enforcing them. Confirm each one by eye:

1. **No Troubleshooting and no Prerequisites section.** A symptom belongs on the page that documents
   the behavior producing it. Prerequisites are per task, and a chapter is not a task. Link the setup
   chapter from See also instead.
2. **Every link under On this chapter carries a description.** A bare list of page titles adds
   nothing to the navigation sidebar.
3. **Continue and See also replace Next Steps.** The chapter's own pages already end in Next Steps.
   Continue names the chapter after this one, and See also names the neighbors.
4. **The Overview does not restate the chapter's pages.** It says what the chapter is for. On this
   chapter says what is in it.

`C1-01` covers the fifth rule: no Quick Start, Role-Based Routing Table or Documentation Map. Those
three belong to the Get Started Guide, the product's single entry point.

The test for the whole type: a chapter index is navigation. A fact that the reader can learn only
from the index belongs on a page in the chapter instead.
