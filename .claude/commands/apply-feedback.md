# /apply-feedback

Apply a reviewer's comments to the open doc, find and fix the same mistake everywhere else, and add
a check so it cannot ship again.

**Usage:** `/apply-feedback <review comments> [--file=<path>] [--corpus=<docs folder>]`

Examples:

```
/apply-feedback "Line 12: replace 'needs nothing else' with 'requires no further setup'"
/apply-feedback "The Overview narrates the page. Start with the reader's goal instead." --file=docs/mcp/profiles.md
/apply-feedback "1. 'good to go' is too casual. 2. Split the 40-word sentence in Limitations into bullets."
```

`$ARGUMENTS` holds the review comments, as free text. One message may hold several comments, and each
one may or may not include the exact replacement. `--file` names the doc under review, and
`--corpus` names the docs folder to search for other instances.

This command runs the whole loop for a review. `/doc-gap` covers only the diagnosis and the check,
starting from one reported violation, and this command reuses its steps for that part.

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
SCRIPTS="$STANDARDS/scripts"
```

This command changes or checks the toolchain itself, so it needs your git clone of doc-standards.
Each plugin update replaces the plugin's own copy and discards any edit made there. Stop when the
check below fails:

```bash
case "$STANDARDS" in */.claude/plugins/*) echo "Run this command from inside your doc-standards clone, not the plugin copy at $STANDARDS."; exit 2 ;; esac
[ "$(git -C "$STANDARDS" rev-parse --show-toplevel 2>/dev/null)" = "$(cd "$STANDARDS" && pwd -P)" ] || { echo "$STANDARDS is not a git clone of doc-standards. Run this command from inside your clone."; exit 2; }
```

---

## Step 1: Read the request

**The file.** Use `--file` when given. Otherwise use the file the user has open or selected in the
editor. When
neither names exactly one doc, ask which file the comments are about. Never guess.

**The corpus.** Use `--corpus` when given. Otherwise use the `docs` folder in the git root of the
file under review. When that folder does not exist, ask.

**The comments.** Split `$ARGUMENTS` into a numbered list. For each comment, record:

| Field | What it holds |
| --- | --- |
| Where | The line number and the exact text it points at, as the file has it |
| Problem | What is wrong, in one sentence |
| Fix | The reviewer's replacement word for word, or "not given" |

When a comment does not say which text it means, or two readings change the fix, ask before editing.
Show the list back in one short message so the user can catch a misreading, then continue without
waiting for a reply.

## Step 2: Fix and search

Send the edits and the agent launches in one message, so the agents work while the file is fixed.

**Fix the file.** Apply each comment to the file under review:

- When the reviewer gave a replacement, use it word for word.
- When they did not, make the smallest change that resolves the problem and follows
  `$STANDARDS/doc-templates/feature-docs/common-rules.md`.

Then lint the file and resolve anything the edit itself introduced:

```bash
node "$SCRIPTS/lint/lint-doc.js" "<file>" --tiers=1,2 --format=text
```

**Start the agents.** All of them are read-only. They report back, and only this session edits files.

1. **One diagnosis agent per comment.** Each one answers two questions for its comment, and returns
   the answer with rule IDs and file paths:
   - Does a rule in `$SCRIPTS/data/rules-registry.json` or `$STANDARDS/doc-templates/` already
     cover this? Search by meaning, not only by keyword.
   - When a rule covers it, why did the linter miss it? Run steps 2, 3 and 6 of
     `$STANDARDS/.claude/commands/doc-gap.md` (baseline, probe, classify) and return the
     classification with its evidence.
2. **Search agents across the corpus.** List the prose files under the corpus, skip section
   skeletons, and split the list into groups of about 15 files, with at most five agents. Give each
   agent its file list and every comment from Step 1, with the reviewer's before and after text.
   Each agent reads its files in full and returns every line that repeats a mistake **by meaning**,
   not only the literal words. For `needs nothing else`, that also means `nothing more to do` and
   `you are all set`. Each hit carries the file, the line, the quoted text, the comment number and a
   proposed fix.

## Step 3: Root cause report

When every agent has returned, show the user one report:

1. **Per comment, the rule status.** One of:
   - **No rule:** Nothing in the registry or the templates covers it. The rule needs adding.
   - **Rule exists, check missed it:** Name the rule ID and the cause: a wordlist that lacks the
     phrase, a pattern narrower than its own rule text, or a judgment rule with nothing that flags
     candidates for it.
   - **Rule exists, check caught it:** The finding was there and nobody acted on it. Name the rule
     and say so plainly. The existing check is enough.
2. **The instances, per comment.** Show a table of file and line as a link, the current text, and
   the proposed fix. Drop any hit that is already fixed or that sits inside a code
   block or a quoted UI label.

Then stop and ask the user to approve the fixes. Apply only what the user approves, and drop or
change any instance they reject.

## Step 4: Fix and codify

After approval, start both jobs in one message.

**Fix the instances.** Apply the approved fixes. With more than 10 files, hand them to parallel
agents, one group of files each, so no two agents touch the same file. Lint each changed file as in
Step 2.

**Write the checks.** Start one agent, not one per comment, because every new rule edits the same
registry and data files. Give it the comments, the Step 3 report and the approved instance list as
the hand list. For each comment that needs a check, it follows the decision rule in Step 7 of
`doc-gap.md`, then codifies by one of two routes:

- **The mistake has a fixed surface form**, such as a phrase or a pattern. Use a wordlist entry, a
  widened pattern or a new tier-1 or tier-2 check, following Step 8 of `doc-gap.md`.
- **Spotting the mistake needs judgment.** Route it through the editorial judge, which asks the
  `claude` CLI (`claude -p`) for a verdict on each candidate:
  1. Add a registry entry for the rule, or reuse the existing one. A new rule also goes into the
     matching prose file in `$STANDARDS/doc-templates/`.
  2. Add a generator to `$SCRIPTS/checks/tier3-candidates.js` that flags the lines worth judging,
     and append it to `GENERATORS`. `skimmableSentence` is the model. A generator narrows where to
     look. The judge gives the verdict.
  3. Add the rule to `$SCRIPTS/data/judge-rubrics/editorial.json`, with a `focus` sentence, the
     reviewer's comment as a worked example (`before`, `after`, `why`), and `fixKinds`. Bump
     `promptVersion`. `judges/judge-editorial.js` judges every rule in that file, so the new rule
     joins the judge with no change to the script.
  4. Add a fixture case and a negative case, with assertions in `$SCRIPTS/test/review-feedback.test.js`.

Either route ends with:

```bash
cd "$SCRIPTS" && npm run build:readme
```

Apply the convergence test from Step 5 of `doc-gap.md`: every line on the approved hand list must
come back as a finding or a candidate. A line the check cannot reach goes in the report as not
mechanically detectable.

## Step 5: Verify

```bash
cd "$SCRIPTS" && npm test
node "$SCRIPTS/lint/sweep-docs.js" "<corpus>"
node "$SCRIPTS/judges/judge-editorial.js" "<corpus>" --out="$REVIEW/editorial-candidates.json"
```

For a judged rule, run the judge on the new candidates, then reconcile:

```bash
node "$SCRIPTS/judges/judge-editorial.js" --judge --apply --candidates="$REVIEW/editorial-candidates.json" --verdicts="$REVIEW/editorial-verdicts.json"
node "$SCRIPTS/judges/judge-editorial.js" --reconcile --escalate="$REVIEW/NEEDS-YOUR-INPUT.md" --candidates="$REVIEW/editorial-candidates.json" --verdicts="$REVIEW/editorial-verdicts.json"
```

Then prove each new test bites. Put the reviewer's original text back into the fixture, confirm the
test fails, and restore it. A test that has never failed does not yet protect anything.

## Step 6: Report

Keep the report short, in the order below:

1. The file under review: the comments applied.
2. Per comment: the rule status and root cause from Step 3.
3. The other instances fixed, as a count per comment with the files.
4. The checks added: rule IDs, the route (wordlist, pattern, check or judge), and the changed files
   in doc-standards.
5. Anything not mechanically detectable, and any open question from `NEEDS-YOUR-INPUT.md`.

Do not commit. The edits span the docs repository and doc-standards, and the user commits each one
when ready.
