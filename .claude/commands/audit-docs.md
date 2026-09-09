# /audit-docs

Audit a whole documentation corpus and rank every finding by rule, so a fix lands where it clears the most. Pass the docs folder as the argument.

**Usage:** `/audit-docs path/to/docs`

This command changes nothing. It reports. To fix one page, use `/revamp-doc`, `/revamp-cli-doc` or
`/revamp-api-ref`.

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
```

Take the corpus from `$ARGUMENTS`. When it is empty, try `$ROOT/docs` and stop with a message rather
than sweeping a guess:

```bash
CORPUS="${ARGUMENTS:-$ROOT/docs}"
[ -d "$CORPUS" ] || { echo "Corpus not found at $CORPUS. Pass the docs folder as the argument."; exit 2; }
```

---

## Step 1: Set the corpus classes first

Do this before sweeping. A corpus that mixes published pages with research notes, generated
mirrors and templates produces thousands of findings on files nobody ships, and the ranking that
comes out of it is meaningless.

Check what the tree holds:

```bash
find "$CORPUS" -name '*.md' | sed "s|$CORPUS/||" | cut -d/ -f1 | sort | uniq -c | sort -rn
```

If every path is a published page, go on. If not, write a corpus-class file naming the exemptions
and point the toolchain at it:

```bash
export DOC_STANDARDS_CORPUS_CLASSES="$REVIEW/corpus-classes.json"
```

`$STANDARDS/scripts/data/corpus-classes.json` is the shape to copy, and
`$STANDARDS/scripts/lib/corpus-class.js` is what reads the override. A broken override is ignored
with a message on stderr rather than failing the run, so read the first lines of output and confirm
the file was accepted. A project that believes its exemptions are live when they are not gets a
misleading audit.

## Step 2: Route the API reference pages away from the sweep

The sweep lints per file with `lint-doc.js`, which classifies a method page as a conceptual guide
and floods the report with findings for sections that shape never had. Find those subtrees first:

```bash
find "$CORPUS" \( -name usage_guide.md -o -name class_reference.md \) -print
```

Every folder that turns up is audited with its own linter instead:

```bash
node "$STANDARDS/scripts/lint/lint-api-ref.js" "<that folder>" --format=text --tiers=1,2
```

Keep those results in a separate section of your report. Their rule IDs are `AR` and `UG`, and
mixing them into the prose ranking makes both harder to read.

## Step 3: Sweep the prose and CLI pages

```bash
node "$STANDARDS/scripts/lint/sweep-docs.js" "$CORPUS"
```

Then the blocking subset on its own, which is the number that answers "can this ship":

```bash
node "$STANDARDS/scripts/lint/sweep-docs.js" "$CORPUS" --tiers=1
```

For a machine-readable copy to compare against a later run:

```bash
node "$STANDARDS/scripts/lint/sweep-docs.js" "$CORPUS" --format=json --out="$REVIEW/sweep.json"
```

## Step 4: Check the links

```bash
node "$STANDARDS/scripts/lint/check-links.js" "$CORPUS" --layers=internal,labels
```

`internal` resolves every relative link and anchor. `labels` checks that a link's text matches what
it points at. Add `--layers=internal,labels,external` only when you are willing to wait on network
calls, and `--env=staging` when the corpus links to a staging host.

## Step 5: Read the ranking, not the file list

The sweep groups findings by rule and sorts by count. That ordering is the whole point of the
command.

Report, in this order:

1. **Tier-1 total**, and whether it is zero. Everything else is secondary to this number.
2. **The top three rules by count**, each with what a single change would clear. A rule driven by a
   wordlist is cleared by one entry. A rule whose module matches less than its own text says is
   cleared by widening one pattern. Name which kind each is, and hand the promising ones to
   `/doc-gap`.
3. **Files with the most tier-1 findings**, at most ten, as revamp candidates.
4. **The API reference results** from Step 2, separately.
5. **Any rule firing on nearly every file**, called out as suspect. A tier-1 rule firing on a corpus
   believed clean usually means the rule or its tier is wrong, not that the corpus is. Check whether
   the pages have a declared `doc_type:` before believing it, because an undeclared corpus makes the
   heuristic answer `conceptual-guide` for almost everything and the section rules then ask every
   page for sections it should never have. `/classify-doc-types` fixes that.
