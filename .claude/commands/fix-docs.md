# /fix-docs

Run every check on a doc or a folder of docs, fix everything the scripts can fix, judge the rest,
and finish only when every finding is resolved.

**Usage:** `/fix-docs <file-or-folder> [--max-calls=N]`

Examples:

```
/fix-docs docs/mcp/manage-profiles.md
/fix-docs docs/sdk/javascript --max-calls=400
```

`$ARGUMENTS` is the file or folder, optionally followed by `--max-calls`. When no path is given, use
the file open in the editor. When there is none, ask. Never guess.

This command covers every page family. Prose pages, CLI pages and SDK API reference pages each get
their own linter and their own playbook, chosen per file.

## Setup

```bash
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
STANDARDS=
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
if [ -z "$STANDARDS" ] && [ -f "${CLAUDE_PLUGIN_ROOT}/scripts/lint/lint-doc.js" ]; then STANDARDS="${CLAUDE_PLUGIN_ROOT}"; fi
if [ -z "$STANDARDS" ] && [ -f "$HOME/.doc-standards/scripts/lint/lint-doc.js" ]; then STANDARDS="$HOME/.doc-standards"; fi
[ -n "$STANDARDS" ] || { echo "doc-standards not found from $PWD"; exit 2; }
REVIEW="$ROOT/.doc-review"
FIXALL="$STANDARDS/scripts/fix/fix-all.js"
```

---

## Step 1: Record what is already changed

```bash
git -C "$(dirname "<target>")" status --short
```

Keep the list. A file with uncommitted changes before the run mixes someone's unfinished edit into
this one. Name those files in the final report, and continue.

## Step 2: Run the scripts

```bash
node "$FIXALL" "<target>" --apply [--max-calls=N]
```

The script runs these phases in order and prints the run folder at the top:

1. Writes `doc_type:` on any page that lacks it, so each page gets the right rule set.
2. Lints every page. API reference pages go to `lint-api-ref.js`, all others to `lint-doc.js`.
3. Runs every fixer whose rules fired: dashes, emoji and italics, acronyms, anthropomorphism, banned
   phrases, concision and tense. Then it repairs anchors that a renamed heading broke.
4. Sends the tier-3 candidates to the judges, which ask the `claude` CLI for a verdict on each.
5. Writes `ledger.json` in the run folder: every finding still open, every judge verdict, and one
   checklist per page.

`--max-calls` caps the `claude` CLI calls, and the default is 200. Anything over the cap stays open
in the ledger for you to settle in Step 3. Save the run folder path as `RUN`.

## Step 3: Review the script edits, then work the ledger

**Review the script edits first.** The fixers rewrite one line at a time and never read the
paragraph around it, so a rewrite can pass its own rule and still read badly or change the meaning.
Read the diff of every changed file:

```bash
git -C "$(dirname "<target>")" diff -- "<target>"
```

Correct any rewrite that changed the meaning, dropped a fact or reads awkwardly. Restore the original
wording when the fix made the sentence worse, and settle its finding in the ledger instead.

**Then work the ledger.** Read `$RUN/ledger.json`. Each item has a `status`, and this step deals with every item whose status is
`open`. For each file, load the playbook for its family first:

| Family in the ledger | Playbook |
| --- | --- |
| `prose` | `$STANDARDS/doc-templates/playbooks/prose.md` |
| `cli` | `$STANDARDS/doc-templates/playbooks/cli.md` |
| `api-ref` | `$STANDARDS/doc-templates/playbooks/api-ref.md` |

Every open item ends one of two ways. Either you fix the page, or you record a decision in
`$RUN/resolutions.json`:

| Item kind | Fix the page when | Otherwise record |
| --- | --- | --- |
| `lint` | The finding is real | `false-positive`, with a reason. A tier-1 item also needs `exceptionQuoted`, a verbatim quote of the rule's exception |
| `judge` | The verdict is `VIOLATION`, or you judge the line a violation | `compliant` with a reason, or `exception` with `exceptionQuoted` |
| `manual` | The page breaks a rule on its checklist | `checked`, listing every rule ID on the checklist in `checked` once the page meets each one |

When the answer depends on a fact you cannot confirm, record `needs-input` with a `question`. Never
guess, and never delete a claim you cannot verify.

```json
{ "resolutions": [
  { "key": "L:3f2a...", "status": "false-positive", "reason": "The dash is inside a quoted CLI output line." },
  { "key": "J:91c0...", "status": "compliant", "reason": "The heading names exactly what the section holds." },
  { "key": "M:7d4e...", "status": "checked", "checked": ["B1-02", "C6-03"], "reason": "Read the page against each rule." },
  { "key": "J:5b18...", "status": "needs-input", "reason": "The limit depends on the plan.", "question": "Is the 100-request limit the same on every plan?" }
] }
```

A fixed finding needs no entry, because the reconcile no longer reports it. Never alter code blocks,
API names, parameter names, flag names, URLs, file paths or version numbers.

**For a folder,** split the files with open items into up to five groups and give each group to its
own agent. No two agents share a file. Each agent gets its file list, the ledger items for those
files, the playbook paths and the resolution format above. Each agent writes its decisions to its own
`$RUN/resolutions-<n>.json`. The reconcile reads every `resolutions*.json` file in the run folder, so
nothing needs merging. **For one file,** work the ledger here.

## Step 4: Reconcile until nothing is open

```bash
node "$FIXALL" --reconcile --run-dir="$RUN"
```

The reconcile repairs anchors, re-lints every page, regenerates every candidate, and applies
`resolutions.json`. It exits 1 while any item is open or any resolution is rejected, and it prints
the reason for each rejection. Fixing one line can raise a new finding on the line you wrote, so go
back to Step 3 for whatever is still open. Stop after three rounds, and record each remaining item as
`needs-input` with the question that blocks it.

The reconcile also writes `$RUN/NEEDS-YOUR-INPUT.md`, with one linked question per `needs-input`
item. Confirm every question links to its line:

```bash
node "$STANDARDS/scripts/lint/check-handoff.js" "$RUN/NEEDS-YOUR-INPUT.md"
```

## Step 5: Report

Keep it short, in the order below:

1. The verdict: every check resolved, or the number of questions left for the user.
2. Per file: fixed by the scripts, fixed while working the ledger, false alarms, open questions.
3. `git diff --stat` for the target.
4. The files that already had changes before the run, from Step 1.
5. A link to `NEEDS-YOUR-INPUT.md` when it holds questions.

Do not commit. Git keeps the previous version of every file, so the user reviews the diff and keeps
or reverts each change.
