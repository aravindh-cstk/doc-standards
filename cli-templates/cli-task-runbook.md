# CLI Task Runbook: Section Order

A CLI task runbook walks a developer through one operation end to end, usually across more than one command and more than one plugin. The reader completes the operation from this page alone.

Apply `sdk-templates/common-rules.md` (B1, B2, C1-C9) and `cli-common-rules.md` (CLI-C1 to CLI-C14) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point, states the operation as an outcome |
| 3 | Overview | Required | 1-3 sentences: what the developer will have done, and what it changes in the stack |
| 4 | Quick Decision Guide | If the operation has more than one path | Orients the reader before they read requirements, for example overwrite versus fresh import |
| 5 | Prerequisites | Required | CLI installed, authenticated, region configured, plus the token scope each step needs |
| 6 | Steps for Execution | Required | The one procedure spine. Every step ends with an observable outcome |
| 7 | Verification | Recommended | How the developer confirms the operation succeeded before moving on |
| 8 | Limitations | Required | What this path does not cover, per C9 |
| 9 | Next Steps | Recommended | Links to what comes after, each with a description, where at least two are genuinely specific to this page |

**Governing rule:** The developer completes the whole operation from this page alone, in the order the page presents it, and can tell at each step whether it worked.

**No Troubleshooting section on this type**, for the same reason stated in `cli-command-reference.md`: the corpus has a dedicated troubleshooting hub (CLI-C14), and every runbook that carried a page-level Troubleshooting section had it removed rather than kept as an exception. See RUN5 below. **Next Steps moved from Required to Recommended**, because forcing the section produced generic padding on pages with no doc-specific onward link to offer.

---

## Type-Specific Rules

### RUN1: Exactly one procedure spine

**Rule:** The doc must contain exactly one procedure spine: either a single `Steps for Execution` H2 whose body holds one ordered list, or a consecutive run of H2s each matching `^Step \d+:` with strictly ascending numbers. A doc matching both forms, or neither, fails.
**Why:** A runbook with two competing spines leaves the reader unable to tell which sequence is authoritative, and a runbook with none leaves them assembling the order themselves from prose. `Migrate your Content using the CLI Migration Command` currently has both a `Steps for Execution` H2 and three sibling step H2s, so a reader cannot tell where the procedure starts.
**Exception:** None. If an operation genuinely has two paths, that is a Quick Decision Guide with two runbooks behind it, not two spines on one page.

**Substeps are bold lead-ins, not headings.** In the `Step \d+:` form, the step H2s already occupy H2 and any grouping inside a step occupies H3, so a substep would land at H4, which CLI-C1 forbids. Write substeps as bold lead-ins inside the step, or as items in the step's ordered list. Note that this constrains nesting depth by design: a runbook that needs four levels of structure is usually two runbooks.

---

### RUN2: No command appears before the step that introduces it

**Rule:** No `csdx` command may appear in a code fence before the step that introduces it.
**Why:** A reader working top to bottom will run what they see. A command shown ahead of its step runs out of order, and for these docs, which export, import, and overwrite stack content, running out of order is destructive rather than merely confusing.
**Exception:** A command shown inside Prerequisites purely to verify setup, such as `csdx auth:whoami`, is not part of the spine and does not count.

---

### RUN3: Order by execution, not by namespace

**Rule:** Steps appear in the order they must be run, regardless of which namespace or plugin each command belongs to.
**Why:** These docs cross namespaces by design. `Migrate Content Between Stacks Using the CLI` runs `cm:stacks:export`, then `cm:stacks:audit`, then `cm:stacks:import`, which is three plugins in one required order. Regrouping those by namespace would make the doc wrong. Execution order is a property of the operation, not of the CLI's topic tree.
**Exception:** None.

---

### RUN4: Limitations is not optional here

**Rule:** Include a `Limitations` section stating what this path does not cover.
**Why:** C9 requires it generally, and it binds hardest on this type: these are the docs that overwrite and delete stack content, where a gap the reader assumed was covered becomes a production incident rather than a failed command.
**Exception:** None for this type. A runbook with genuinely no known gaps should say so in one sentence rather than omit the section.

---

### RUN5: No Troubleshooting section

**Rule:** Do not add a `Troubleshooting` H2 to this type. Link the CLI troubleshooting hub instead, per CLI-C14.
**Why:** The hub is the one place a failure mode is written down, so it is the only copy that gets updated when the fix changes. A page-level section is a second copy nothing keeps in sync with the first.
**Exception:** None. `checks/section-structure.js` reports `CLI-19` if one is added back.
