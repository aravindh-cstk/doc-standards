# CLI Module Reference: Section Order

A CLI module reference is a lookup page. It lists what the CLI supports, or what it does not, or what it accepts, one section per module or per command, with no procedure. The reader arrives with one lookup in mind and should reach it in one jump.

Apply `sdk-templates/common-rules.md` (B1, B2, C1-C9) and `cli-common-rules.md` (CLI-C1 to CLI-C14) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point, names the scope of the lookup |
| 3 | Overview | Required | 1-3 sentences: what this page indexes, and what it deliberately does not cover |
| 4 | Quick Reference | Required | Index table mapping each module or command to its section, so no reader scrolls a 1,000-line page |
| 5 | Precedence and Scope | Recommended | How overlapping sources resolve, where the page documents configuration |
| 6 | Main Content | Required | One H2 per module or command, in the order the grouping rule sets |
| 7 | Next Steps | Recommended | Links to the command docs the entries here refer to, where at least two are genuinely specific to this page |

**Governing rule:** A reader arrives with one module or one command in mind and reaches its section in one jump. No section assumes the reader read the section before it.

**Next Steps moved from Required to Recommended**, for the same reason stated in `cli-command-reference.md`: forcing the section on every lookup page produced generic links rather than doc-specific ones. `Troubleshooting` was never part of this type. See MOD3.

---

## Type-Specific Rules

### MOD1a: Section titles use the real identifier, verbatim

**Rule:** An H2 that names a command or a module must use the real identifier exactly as the CLI declares it: as it appears in `oclif.topics`, in a path under a plugin's `src/commands/`, or in `modules.types` in the export or import config. Do not paraphrase the identifier into title case.

So `## cm:stacks:export-query Configuration`, not `## Query-Export Configuration`.

**Why:** A reader arrives at a lookup page carrying a string they saw somewhere else, usually in an error message or in `--help` output. If the page has retitled that string into prose, their search finds nothing and the page fails at the one job it has. Title case also hides the namespace, so `Export Configuration` gives no signal that the command lives under `cm:stacks`.

**Exception:** The exemption below.

---

### MOD1b: Identifier sections form one contiguous run, in lexicographic order

**Rule:** The H2s covered by MOD1a appear together in one unbroken run, sorted in ascending lexicographic order of the identifier. Exempt sections sit outside that run.

**Why:** The order is deliberately lexicographic rather than declaration order, because there is no single declared order to cite. `contentstack-export/src/config/index.ts` and `contentstack-import/src/config/index.ts` declare the same modules in two different orders, and `oclif.plugins` declares a third that reflects load sequence rather than reader need. Lexicographic order is unambiguous, stable across releases, and correct for a page readers scan rather than read. It also groups related commands automatically, putting `export` next to `export-query` and `import` next to `import-setup`.

The run has to be contiguous, because a lexicographic order broken up by prose sections is not something a reader can rely on. Once they hit an out-of-order heading they stop trusting the ordering and go back to scrolling.

**Exception, stated rather than left implicit.** Two kinds of H2 are exempt.

1. **Structural sections**, by name: `Overview`, `Quick Reference`, `Precedence and Scope`, `Next Steps`. These are required by this template and name no command.
2. **Cross-cutting sections**, covering behavior that spans every command rather than any one command. `Core CLI Limitations` and `Configuration Limitations` are the real examples. A cross-cutting section must be placed before the ordered run, so the run stays contiguous.

---

### Worked example

`Contentstack CLI Configuration Reference` is the closest existing page to this type, and shows what both rules change.

**Today:**

```markdown
## Quick Start
## Environment Variables
## Configuration Precedence
## Export Configuration
## Import Configuration
## Audit Configuration
## Query-Export Configuration
## Import-Setup Configuration
## Migration Configuration
## Quick Reference Guide
```

**Satisfying MOD1a and MOD1b:**

```markdown
## Overview
## Quick Reference
## Precedence and Scope
## cm:stacks:audit Configuration
## cm:stacks:export Configuration
## cm:stacks:export-query Configuration
## cm:stacks:import Configuration
## cm:stacks:import-setup Configuration
## cm:stacks:migration Configuration
## Next Steps
```

Three things changed. The vocabulary is now real command ids a reader can paste into a terminal, so someone who saw `cm:stacks:export-query` in an error message finds the section. The six command sections are sorted, which moves `export-query` next to `export` rather than leaving it between `Import` and `Migration`, and puts `import` before `import-setup`. The four structural sections sit outside the run, three before it and one after.

`CLI Limitations` follows the same shape, and shows the cross-cutting exemption in use:

```markdown
## Overview
## Quick Reference
## Core CLI Limitations              <- exempt, cross-cutting, placed before the run
## Configuration Limitations         <- exempt, cross-cutting, placed before the run
## auth Limitations
## cm:assets Limitations
## cm:stacks:export Limitations
## cm:stacks:import Limitations
## cm:stacks:migration Limitations
## launch Limitations
## Next Steps
```

---

### MOD2: Quick Reference is mandatory on this type alone

**Rule:** Include a `Quick Reference` index table mapping each module or command to its section anchor.
**Why:** These pages run 10 to 21 H2s and up to 57 H3s across roughly a thousand lines each. Without an index the only way to use one is to scroll it, which defeats the purpose of a lookup page. This is the one place where a section absent from every existing doc is nonetheless required, because its absence is the type's single largest usability defect.

**Exception:** None. A module reference short enough not to need an index is short enough to be a section of another doc.

---

### MOD3: No Prerequisites, no Troubleshooting, no Limitations

**Rule:** Do not add Prerequisites, Troubleshooting, or Limitations sections to this type.
**Why:** A module reference runs no command, so it has no prerequisites and produces no failures to troubleshoot. Limitations is excluded for a more specific reason: `CLI Limitations` is itself the corpus's limitations page, and nesting a Limitations section inside it is incoherent.

For the same reason, this type owns no flag tables of its own. Where a section quotes a command's flags, CLI-C2's six-column shape applies to that quoted table, but the canonical table stays in the command reference that owns it, per MOD4.

**Exception:** A page that does need Prerequisites is running a command, which makes it a command reference or a task runbook.

---

### MOD4: Entries link out rather than duplicate

**Rule:** Each entry states the constraint and links to the command doc that owns the procedure, rather than restating the procedure.
**Why:** C7 requires one canonical location per fact. A lookup page that inlines procedure becomes a second copy that goes stale silently when the command doc changes.

**Exception:** A one-line command example showing the shape of the constraint is not a procedure and is fine inline.
