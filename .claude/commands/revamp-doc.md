# /revamp-doc

Revamp a prose documentation file to comply with Contentstack doc standards. Pass the path to the target doc as the argument.

**Usage:** `/revamp-doc path/to/doc.md`

---

## What this command does

You revamp the target doc in seven steps. Work through them in order. Do not skip steps.

This command owns the eight prose doc types in `doc-templates/feature-docs/`. Two families have their own commands,
because each has its own templates and its own linter:

- A `usage_guide.md`, a `class_reference.md`, or any file under a `methods/` folder is an SDK API
  reference page. Stop and use `/revamp-api-ref`.
- A CLI command reference, task runbook, module reference or plugin guide is a CLI page. Stop and
  use `/revamp-cli-doc`.

## Setup

Resolve the toolchain once, then use it everywhere below. Hardcoding a path is what broke this
command before.

```bash
ROOT=$(git rev-parse --show-toplevel)
if [ -f "$ROOT/scripts/lint/lint-doc.js" ]; then
  STANDARDS="$ROOT"
elif [ -f "$ROOT/doc-standards/scripts/lint/lint-doc.js" ]; then
  STANDARDS="$ROOT/doc-standards"
else
  D=$PWD
  while [ "$D" != "/" ]; do
    if [ -f "$D/doc-standards/scripts/lint/lint-doc.js" ]; then STANDARDS="$D/doc-standards"; break; fi
    D=$(dirname "$D")
  done
fi
[ -n "$STANDARDS" ] || { echo "doc-standards not found from $PWD"; exit 2; }
REVIEW="$ROOT/.doc-review"
```

The standards live in two files that you load in Step 3:

- `$STANDARDS/doc-templates/feature-docs/common-rules.md`, B1, B2, C1-C9 rules and section definitions. Apply to every doc type.
- `$STANDARDS/doc-templates/feature-docs/{doc-type}.md`, section order and type-specific rules. Load the file that matches the detected type.

All eight prose types, the template to read and the exact value to pass to `--type`:

| Detected type | Template in `doc-templates/feature-docs/` | `--type` value |
| --- | --- | --- |
| Get Started Guide | `getting-started.md` | `getting-started` |
| Conceptual Guide | `conceptual-guide.md` | `conceptual-guide` |
| Feature Doc | `feature-doc.md` | `feature-doc` |
| How-To Guide | `how-to-guide.md` | `how-to-guide` |
| Setup Guide | `setup-guide.md` | `setup-guide` |
| Kickstarter | `kickstarter.md` | `kickstarter` |
| Migration Guide | `migration-guide.md` | `migration-guide` |
| Chapter Index | `chapter-index.md` | `chapter-index` |

Pass the value from the third column verbatim. `lint-doc.js` rejects anything outside that list with
exit code 2, so a guessed value fails loudly rather than linting against the wrong section order.

A companion script at `$STANDARDS/scripts/lint/lint-doc.js` mechanically checks the subset of these rules that are objectively verifiable (section presence and order, banned phrases, formatting, and similar). Step 2 runs it before you read a single rule by eye.

---

## Step 1: Identify the doc type

Read the first 60 lines of `$ARGUMENTS`.

Detect the type in this priority order:

1. `doc_type:` field in YAML front matter, use that value directly.
2. Title starts with "Get Started with" or the doc has both a Role-Based Routing Table and a Quick Start section → **Get Started Guide**.
3. The doc has an "On this chapter" section, or it is a landing page whose body is a list of links to the pages of one chapter → **Chapter Index**.
4. Title or overview contains "migrate", "upgrade", or "migration", or the doc has a Type Mapping Reference or Pre-Upgrade Checklist section → **Migration Guide**.
5. Title uses an imperative verb ("Fetch", "Configure", "Add") or overview describes completing a specific task → **How-To Guide**.
6. Doc installs or configures an environment, SDK, or runtime → **Setup Guide**.
7. Doc is a starter app template with clone and run steps → **Kickstarter**.
8. Doc describes a specific product feature or capability → **Feature Doc**.
9. Default → **Conceptual Guide**.

State the detected type to the user in one sentence before proceeding. If the type is ambiguous, ask the user to confirm before continuing.

If the detected type is one of the four CLI types, stop and route to `/revamp-cli-doc`. A page whose
subject is the CLI but whose type is `setup-guide` or `feature-doc`, such as "Install the CLI",
stays here.

---

## Step 2: Run the automated linter

Run the linter against the target doc, using the type detected in Step 1:

```bash
node "$STANDARDS/scripts/lint/lint-doc.js" "$ARGUMENTS" --type={detected-type} --format=text
```

To review a whole directory rather than one file, use `/audit-docs`. It reports the same findings
ranked by rule, which is what tells you whether a problem is local to one page or systemic.

The output has three sections:

- **Automated Findings**, objective rule violations (missing sections, banned phrases, malformed front matter, formatting defects, and similar). Treat these as pre-confirmed. Do not re-derive them by eye in Step 4 or Step 6, apply the fixes directly.
- **Flagged for Review**, heuristic detections that are not always violations (for example, a duplicate link that may be an intentional Prerequisites reminder). Confirm each one against its rule before deciding whether to fix it.
- **Manual Review Queue**, the rules that require reading comprehension and cannot be checked by a script (heading accuracy, cognitive grouping, consequence-before-implementation ordering, and similar). This queue is generic: it lists the same tier-3 rules for every document, without having read yours.

Turn that generic queue into located candidates before Step 4, so you judge
specific passages instead of re-reading the whole page against every rule:

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" "$ARGUMENTS" --out="$REVIEW"
```

That writes `$REVIEW/candidates.json`. Each candidate names a rule, a line
range, the evidence, and the one question to answer. Judge every candidate and
write `$REVIEW/verdicts.json` beside it, one entry per `candidateId`:

```json
{ "verdicts": [
  { "candidateId": "...", "verdict": "VIOLATION", "reason": "...", "fix": "...", "confidence": "high" }
] }
```

`verdict` is `VIOLATION`, `COMPLIANT`, `EXCEPTION_APPLIES`, or `UNCLEAR`. Every
verdict needs a `reason`. A `VIOLATION` needs a `fix`. An `EXCEPTION_APPLIES`
must quote the rule's own exception verbatim in `exceptionQuoted`. Then:

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" --reconcile --out="$REVIEW"
```

This exits non-zero while any candidate is unjudged. Do not proceed to Step 4
until it is clean. Carry `VIOLATION` rows into your edits and escalate `UNCLEAR`
rows to the user rather than guessing.

If the script fails to run (for example, Node is unavailable), state that to the user and fall back to a fully manual review using Steps 3 through 7 as originally written.

---

## Step 3: Load the standards

Read both files in full before making any edits:

1. `$STANDARDS/doc-templates/feature-docs/common-rules.md`
2. `$STANDARDS/doc-templates/feature-docs/{detected-type}.md`

Also read the full target doc at `$ARGUMENTS`.

---

## Step 4: Structural audit (B1 + B2)

Apply the B1 checklist items and B2 anti-patterns from `common-rules.md` against the doc. Skip any item already resolved by an Automated Finding from Step 2, apply that fix directly instead of re-deriving it. For every remaining item on the Manual Review Queue that falls under B1 or B2, state:

- **Rule violated**: quote the exact rule sentence
- **Location**: section heading and approximate line number
- **Issue**: what is wrong
- **Required fix**: specific action (add, remove, reorder, rename, rewrite)

After listing all findings, apply every fix to the doc using the Edit tool. Preserve all technical content: do not modify code blocks, API names, parameter names, flag names, URLs, file paths, or version numbers.

---

## Step 5: Section order and completeness

Cross-check the linter's section-structure findings from Step 2 against the section order table in the doc-type file:

1. All sections marked Required (or Required if [condition applies]) are present.
2. Sections appear in the defined order.
3. Each section's content matches its definition in `common-rules.md`.

The linter reads `$STANDARDS/scripts/data/section-order.json`, so that file is the authority when it
disagrees with a table in prose.

List any findings not already covered by Step 2's Automated Findings, then apply all fixes.

### If the type is Chapter Index

Four of the six chapter-index rules have no check behind them, so this step is the only thing
enforcing them. Read `chapter-index.md` in full and confirm each one by eye:

1. **No Troubleshooting and no Prerequisites section.** A symptom belongs on the page that documents
   the behavior producing it. Prerequisites are per task, and a chapter is not a task. Link the setup
   chapter from See also instead.
2. **Every link under On this chapter carries a description.** A bare list of page titles tells the
   reader nothing the navigation sidebar does not already show.
3. **Continue and See also replace Next Steps.** The chapter's own pages already end in Next Steps,
   so repeating one here sends the reader back into the chapter they just finished. Continue names
   the chapter after this one, See also names the neighbours.
4. **The Overview does not restate the chapter's pages.** It says what the chapter is for. On this
   chapter says what is in it.

The ban on a Quick Start, a Role-Based Routing Table and a Documentation Map is the one rule here
that a check does cover, through `C1-01`. Those three belong to the Get Started Guide, which is the
product's single entry point. A chapter index carrying them competes with it.

The governing test for the whole type: a chapter index is navigation. If the reader can learn a fact
from it that no page in the chapter states, the fact is on the wrong page.

---

## Step 6: Style passes (C1-C9)

Work through the Manual Review Queue items from Step 2 that fall under C1 through C9, in order. For each violation:

- **Rule**: quote the rule sentence
- **Exception check**: state the exception, does it apply here? (yes/no + one sentence)
- **Location**: section heading and approximate line number
- **Issue**: what violates the rule
- **Required fix**: specific action

Apply fixes for one C-section before moving to the next. Preserve all technical content.

Always apply **C8 (Developer Tone)** and **C9 (CLI Command Documentation)** from `common-rules.md`, both apply to every doc type, not just Migration Guides or CLI plugin docs specifically.

If the detected type is Migration Guide, also apply the migration-specific C8 rules from `migration-guide.md` after completing the common-rules C8 pass.

---

## Step 7: Output

Edit the doc in place. Do not write a `-revamped.md` sibling.

Git is the safety net, so the original is always recoverable with `git diff` and
`git checkout --`. Writing a sibling instead was the old behaviour, and across a
corpus pass it produces one orphan file per doc, none of which anything
references.

Before editing, confirm the working tree is clean for this file:

```bash
git status --short "$ARGUMENTS"
```

If it already has uncommitted changes, say so and ask whether to continue, so a
revamp does not get mixed into someone else's unfinished edit.

Re-run the linter from Step 2 and repeat until no tier-1 finding remains.

Report a one-paragraph summary: number of Automated Findings from Step 2 applied, number of additional structural findings fixed in Steps 4 and 5, number of style findings fixed in Step 6, and any sections that were added or reordered.
