# /classify-doc-types

Declare `doc_type:` across a documentation corpus, so the linter stops guessing. Pass the docs folder as the argument.

**Usage:** `/classify-doc-types path/to/docs`

## Why this matters

The linter falls back to a heuristic when a page does not declare its type, and the heuristic reads
titles and section names. On one corpus of 355 files it answered `conceptual-guide` for 327 of them.
The section rules then asked all 327 for sections they should never have, and one rule was
manufacturing most of its own findings.

The heuristic is also circular in places. The `setup-guide` branch tests text taken from the page's
own Overview, so a page with no Overview can never be classified as a setup guide, and
`conceptual-guide` then requires an Overview.

A declared type beats the heuristic. This command is how a corpus gets declared.

## Setup

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
CLASSIFY="$STANDARDS/scripts/judges/classify-doc-type.js"
```

**One caveat on scratch files.** This script writes `doc-type-candidates.json` and
`doc-type-verdicts.json` to a `.doc-review` folder it computes as two levels above `scripts/`, and
it has no flag to redirect that. When this checkout is its own git root, that resolves to the folder
holding the checkout. Note where the script says it wrote the files, and do not assume they landed in
`$REVIEW`.

---

## Step 1: Exclude the API reference pages

That family is classified by filename, carries three front-matter keys, and has no `doc_type:` key
at all. Find those subtrees so you can keep them out of the target:

```bash
find "$ARGUMENTS" \( -name usage_guide.md -o -name class_reference.md -o -path '*/methods/*.md' \) -print
```

Pass the folders that hold prose and CLI pages instead of the whole tree when the reference pages
sit inside it.

## Step 2: Generate candidates

```bash
node "$CLASSIFY" "<target>"
```

This writes a candidate per page and changes nothing. Read the summary. It reports the distribution
the heuristic currently produces, which is the baseline the judged pass is measured against.

## Step 3: Judge

```bash
node "$CLASSIFY" --judge
```

One model call per page, cached, so a second run does not re-ask. To work through a large corpus in
slices:

```bash
node "$CLASSIFY" --judge --max-calls=20
```

Add `--refresh` only when the question itself has changed and stored answers must be discarded.
Verdicts are cached against a prompt version, so an edit to the prompt already invalidates them.

## Step 4: Reconcile before applying

```bash
node "$CLASSIFY" --reconcile
```

This verifies and changes nothing. It refuses to let a half-finished pass read as a complete one. Do
not go to Step 5 while it reports an unjudged candidate.

## Step 5: Apply

```bash
node "$CLASSIFY" --apply
```

This is the only step that edits a page, and it writes exactly one key. Confirm the working tree is
clean first, so the front-matter change lands as its own reviewable diff:

```bash
git -C "$ARGUMENTS" status --short | head -20
```

## Step 6: Confirm the effect

Re-baseline and compare against the number from before:

```bash
node "$STANDARDS/scripts/lint/sweep-docs.js" "<target>" --tiers=1
```

The tier-1 count should fall, often sharply, because the section rules now ask each page for the
sections its own type defines.

Report:

- The type distribution before and after, as a table.
- Every page the judge was unsure about, with the type it landed on. These are worth a human read.
- Any page it typed as one of the four CLI types or as `migration-guide`, since those carry extra
  rule sets and are the ones most worth revamping next.
- The tier-1 count before and after.
