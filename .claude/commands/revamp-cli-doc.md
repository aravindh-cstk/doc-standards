# /revamp-cli-doc

Revamp a CLI documentation page to comply with the `cli-templates` standards. Pass the path to the target doc as the argument.

**Usage:** `/revamp-cli-doc path/to/doc.md`

---

## What this command owns

The four CLI doc types, and nothing else:

| Type | The page is | Template |
| --- | --- | --- |
| `cli-command-reference` | The command surface of a plugin or namespace | `doc-templates/cli-templates/cli-command-reference.md` |
| `cli-task-runbook` | One operation, from first command to verification | `doc-templates/cli-templates/cli-task-runbook.md` |
| `cli-module-reference` | A lookup table of identifiers, limits or configuration | `doc-templates/cli-templates/cli-module-reference.md` |
| `cli-plugin-guide` | Building and publishing a `csdx` plugin | `doc-templates/cli-templates/cli-plugin-guide.md` |

Sixteen rules in this family have no working check, five of them tier 1. Step 6 is the only thing
enforcing them, which is the main reason this command exists rather than passing a `--type` flag to
`/revamp-doc`.

## Setup

```bash
ROOT=$(git rev-parse --show-toplevel)
if [ -f "$ROOT/scripts/lint-doc.js" ]; then
  STANDARDS="$ROOT"
elif [ -f "$ROOT/doc-standards/scripts/lint-doc.js" ]; then
  STANDARDS="$ROOT/doc-standards"
else
  D=$PWD
  while [ "$D" != "/" ]; do
    if [ -f "$D/doc-standards/scripts/lint-doc.js" ]; then STANDARDS="$D/doc-standards"; break; fi
    D=$(dirname "$D")
  done
fi
[ -n "$STANDARDS" ] || { echo "doc-standards not found from $PWD"; exit 2; }
REVIEW="$ROOT/.doc-review"
```

---

## Step 1: Identify the type

A declared `doc_type:` in front matter wins. Otherwise ask the linter rather than guessing, so the
type comes from the repository's own detection and cannot drift from it:

```bash
node "$STANDARDS/scripts/lint-doc.js" "$ARGUMENTS" --format=json | head -20
```

The `type` field in that report is what `detectCliDocType` decided. Read it and state it in one
sentence.

The signals it keys off, so you can sanity-check the answer:

- The page is in the CLI family at all when its title contains "CLI" or "csdx", or it has a
  `Commands` section.
- A title naming limitations, a configuration reference or supported features is a
  `cli-module-reference`. These have no `Commands` section by definition.
- A page about building a plugin is a `cli-plugin-guide`.
- A page walking one operation start to finish is a `cli-task-runbook`.
- A page documenting a command surface is a `cli-command-reference`.

Detection keys off the page's subject, not the sections it currently has. That is deliberate. A
command reference missing its `Commands` section must still be linted as a command reference, or the
omission is never reported.

## Step 2: Hand off when it is not one of the four

Some CLI-subject pages are deliberately typed as something else. If Step 1 reports `setup-guide`,
`feature-doc`, `migration-guide` or any prose type, stop and route the user to `/revamp-doc`. An
"Install the CLI" page is a setup guide by design. A page with genuine migration structure, a Type
Mapping Reference or a Pre-Upgrade Checklist, stays a migration guide even when its subject is the
CLI.

If Step 1 reports no H2 sections at all, the page cannot satisfy any section order table. Say so and
recommend it as a retire candidate rather than manufacturing sections for it.

## Step 3: Lint

```bash
node "$STANDARDS/scripts/lint-doc.js" "$ARGUMENTS" --type=<cli-type> --format=text --tiers=1,2
```

Pass `--type` explicitly from here on, so a later edit that removes the detection signal does not
silently change the rule set mid-revamp.

The output has three sections:

- **Automated Findings**, pre-confirmed. Apply them. Do not re-derive them by eye later.
- **Flagged for Review**, heuristics that are not always violations. Confirm each against its rule
  and read the false-positive note before deciding.
- **Manual Review Queue**, the generic tier-3 list. Step 7 turns it into located candidates.

## Step 4: Load the rules

Read all three, in this order, in full:

1. `$STANDARDS/doc-templates/feature-docs/common-rules.md`. It applies **in full** to every CLI doc. The CLI file says so
   in its own second line.
2. `$STANDARDS/doc-templates/cli-templates/cli-common-rules.md`. `CLI-C1` to `CLI-C15`, the rules that are
   specific to the CLI, plus the section that records where a CLI rule deliberately overrides an
   SDK rule.
3. `$STANDARDS/doc-templates/cli-templates/<the type file>.md`.

## Step 5: Section order

The linter reads `$STANDARDS/scripts/data/section-order.json`. That file is the authority when a
table in prose disagrees with it.

| Type | Required sections after the title |
| --- | --- |
| `cli-command-reference` | Overview, Prerequisites, Commands, Examples, Limitations. Quick Reference required at 3 or more commands. Installation required only if the plugin is not bundled |
| `cli-task-runbook` | Overview, Prerequisites, Steps for Execution, Limitations. Quick Decision Guide required if the operation has more than one path |
| `cli-module-reference` | Overview, Quick Reference, Main Content |
| `cli-plugin-guide` | Overview, Prerequisites, Plugin Structure, Creating a Plugin, Plugin Registration and Linking, Commands and Flags, Publishing, Next Steps |

What each type must not carry:

- No type in this family carries a page-level Troubleshooting H2. Link the CLI troubleshooting hub
  instead. Enforced as `CLI-19` for the first three types and `PLG-05` for the plugin guide.
- `cli-module-reference` carries no Prerequisites and no Limitations. Its entries link out rather
  than duplicating what they link to.
- `cli-task-runbook` carries one procedure spine, and no command appears before the step that runs
  it.

## Step 6: Judge the sixteen unenforced rules

No check reports any of these. Read the page and record a verdict for **every row**, not a subset.
For each: the rule ID, `VIOLATION` or `COMPLIANT`, one sentence of reason, and a fix on every
violation.

| Rule | Tier | What to confirm |
| --- | --- | --- |
| `CLI-11` | 1 | Recurring section names are plural: Limitations, Troubleshooting, Next Steps |
| `CLI-12` | 1 | The Overview or Prerequisites states whether the documented commands mutate stack data or are read-only |
| `CLI-13` | 1 | Prerequisites state, in order: CLI installed with the Node version from `engines.node`, `csdx auth:login`, region configured, then any management token |
| `CLI-14` | 1 | Every claim that a flag, command or behavior was added, renamed or removed cites the changelog and names the version |
| `CLI-15` | 1 | A page derived from an older version has every flag name, flag description and worked example re-verified against the released manifest. Nothing is inherited unverified |
| `CLI-08` | 2 | User-supplied values are written as `<UPPER_SNAKE_CASE>`, in single angle brackets |
| `CLI-10` | 2 | No shell prompt inside a code fence. `csdx cm:stacks:export`, not `$ csdx cm:stacks:export` |
| `CLI-18` | 2 | No page-level Troubleshooting H2 anywhere on the page, old or new. The hub is linked instead |
| `CLI-20` | 2 | Every code-sourced Limitations entry is classified as a boundary on function, a closed list or an unsupported operation, rather than a weakness in protection |
| `C9-01` | 2 | Any command that connects to a live stack says in the Overview or Prerequisites whether it mutates data |
| `C9-02` | 2 | Every mandatory prerequisite naming a token states the minimum permission or scope inline, not only as a troubleshooting root cause |
| `C9-03` | 2 | If a newer version of the documented command or tool exists, one sentence at the top of the Overview says so, with a link |
| `PLG-01` | 2 | Plugin guides: the Plugin Structure layout uses the real file and folder names the scaffolding creates, such as `src/commands/` |
| `PLG-02` | 2 | Plugin guides: each TypeScript example is a complete compilable command class, not a fragment |
| `PLG-03` | 2 | Plugin guides: Plugin Registration and Linking includes the command that confirms the plugin loaded, not only the linking command |
| `PLG-04` | 2 | Plugin guides: a long reference section such as Available Methods and Utilities opens with a table |

The five tier-1 rows are blocking rules with nothing behind them. A revamp that skips them reports a
clean page that is not one.

## Step 7: The rules the linter does report

These are enforced, so apply the findings rather than re-deriving them. Listed so you recognise
them in the report and do not double-handle them:

| Rule | What it catches |
| --- | --- |
| `CLI-01`, `CLI-02` | Flag and option tables, one six-column shape |
| `CLI-03` | The blast radius stated before the reader runs anything |
| `CLI-04` | Baseline prerequisites, same for every command doc |
| `CLI-05` | No H4 or deeper. Fires on any CLI-subject page whatever its type, because the rendering platform cannot link an H4 |
| `CLI-06` | A language tag on every code fence |
| `CLI-07` | Install placement, command reference only |
| `CLI-09` | Callout labels put the colon inside the bold |
| `CLI-16` | No assertion that documentation does not exist. Nothing is "coming soon" |
| `CLI-17` | Docs-site links are root-relative, never absolute |
| `CLI-19`, `PLG-05` | No page-level Troubleshooting section |

## Step 8: Tier 3

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" "$ARGUMENTS" --out="$REVIEW"
```

Judge every candidate into `$REVIEW/verdicts.json`, one entry per `candidateId`, with a `reason`
always, a `fix` on every `VIOLATION`, and `exceptionQuoted` quoting the rule's own exception
verbatim on every `EXCEPTION_APPLIES`. Then:

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" --reconcile --out="$REVIEW"
```

It exits non-zero while any candidate is unjudged. Do not proceed until it is clean. CLI pages are
prose-shaped, so expect a full candidate list here.

## Step 9: Edit in place

```bash
git status --short "$ARGUMENTS"
```

If the file already has uncommitted changes, say so and ask whether to continue.

Edit in place. Never write a `-revamped.md` sibling.

Preserve all technical content: command names, flag names, flag descriptions, exit codes, URLs, file
paths and version numbers. When `CLI-15` requires re-verification and you cannot reach the released
manifest, say the claim is unverified and escalate it. Do not quietly keep it and do not delete it.

## Step 10: Re-lint and report

Re-run Step 3 and repeat until no tier-1 finding remains.

Report:

- Automated findings applied, by rule ID.
- The Step 6 table with a verdict on all sixteen rows.
- Sections added, removed or reordered.
- Anything escalated, especially unverifiable version and flag claims.
