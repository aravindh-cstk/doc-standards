# /onboard-docs-repo

Wire the doc-standards toolchain to a project's docs folder, from nothing to a working baseline. Pass the docs folder as the argument.

**Usage:** `/onboard-docs-repo path/to/project/docs`

Six steps, and the order matters. Skipping step 2 is what produces a baseline of thousands of
findings on files nobody publishes, which is the same as having no baseline.

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
CORPUS="$ARGUMENTS"
[ -d "$CORPUS" ] || { echo "Docs folder not found at $CORPUS."; exit 2; }
```

---

## Step 1: Confirm the layout

Two things depend on where this checkout sits relative to the project.

- **The npm scripts** default to `../../docs` from `scripts/`, so they only work unqualified when
  the project's docs folder is two levels above. Check it:

  ```bash
  ls "$STANDARDS/scripts/../../docs" 2>/dev/null || echo "not the default layout, pass targets explicitly"
  ```

  When it is not the default layout, nothing is broken. Every script takes an explicit target, and
  the commands in this repository pass one. Just do not rely on `npm run sweep` and its siblings.

- **The editor hook** walks up from the edited file looking for `doc-standards/scripts/lint/lint-doc.js`.
  So the project must sit under a parent that contains this checkout, or the hook will never find it
  and edits will go unlinted with no error. Verify:

  ```bash
  D="$CORPUS"; while [ "$D" != "/" ]; do [ -f "$D/doc-standards/scripts/lint/lint-doc.js" ] && { echo "hook will resolve at $D"; break; }; D=$(dirname "$D"); done
  ```

  Print nothing and the hook cannot reach it. Say so, and name what would have to move.

## Step 2: Write the corpus classes

Do this before any baseline. Find out what the tree actually holds:

```bash
find "$CORPUS" -name '*.md' | sed "s|$CORPUS/||" | cut -d/ -f1 | sort | uniq -c | sort -rn
```

Anything that is not a published page needs classifying: research notes, decomposition scratch,
generated mirrors, templates, fixtures. Copy the shape from
`$STANDARDS/scripts/data/corpus-classes.json`, write the project's own file, and point the toolchain
at it:

```bash
export DOC_STANDARDS_CORPUS_CLASSES="<path to the project's corpus-classes.json>"
```

`$STANDARDS/scripts/lib/corpus-class.js` reads it. A broken file is ignored with a message on
stderr rather than failing the run, so read the first lines of the next command's output and confirm
it was accepted. A project that believes its exemptions are live when they are not gets a baseline it
cannot trust.

Commit that file into the project, not into this repository. It describes the project.

## Step 3: Declare the doc types

An undeclared corpus makes the linter guess, and the guess is `conceptual-guide` for most pages.
Run `/classify-doc-types` against the corpus, or the three steps directly:

```bash
node "$STANDARDS/scripts/judges/classify-doc-type.js" "$CORPUS"
node "$STANDARDS/scripts/judges/classify-doc-type.js" --judge
node "$STANDARDS/scripts/judges/classify-doc-type.js" --reconcile
node "$STANDARDS/scripts/judges/classify-doc-type.js" --apply
```

Only `--apply` edits anything, and it writes exactly one front-matter key. Keep it as its own commit
in the project.

## Step 4: Baseline

```bash
node "$STANDARDS/scripts/lint/sweep-docs.js" "$CORPUS" --tiers=1
```

Record the number. That is the project's starting debt, and every later run is compared against it.

Then the full picture and the links:

```bash
node "$STANDARDS/scripts/lint/sweep-docs.js" "$CORPUS"
node "$STANDARDS/scripts/lint/check-links.js" "$CORPUS" --layers=internal,labels
```

If the corpus holds API reference pages, audit those separately. The sweep misclassifies them:

```bash
find "$CORPUS" \( -name usage_guide.md -o -name class_reference.md \) -print
node "$STANDARDS/scripts/lint/lint-api-ref.js" "<each folder found>" --tiers=1,2
```

## Step 5: Confirm the hooks are live

Two hooks run on every `Write` or `Edit` of a markdown file under a `docs/` path. Check they are
configured:

```bash
grep -A3 'check_doc_dashes\|lint_doc_standards' "$HOME/.claude/settings.json"
ls "$HOME/.claude/hooks/check_doc_dashes.py" "$HOME/.claude/hooks/lint_doc_standards.py"
```

Both must appear under a `PostToolUse` matcher of `Write|Edit`. The dash check blocks a dash or a
semicolon in prose. The linter blocks tier-1 findings.

Test the linter hook end to end by editing one page in the project and confirming a finding appears.
A hook that is configured but cannot resolve the linter fails silently, which is the failure mode
worth catching now rather than in three weeks.

Note the one gap: the hook only ever runs `lint-doc.js`. Editing a `class_reference.md` or a method
page produces findings for sections that shape never had. Tell the team to use `/revamp-api-ref` for
those pages and to read hook output on them with suspicion.

## Step 6: Install the commands

```bash
bash "$STANDARDS/scripts/install-commands.sh"
```

That symlinks the ten commands into `~/.claude/commands/` so they work from inside the project.

## Report

- The layout: default or explicit-target, and whether the hook can resolve the linter.
- The corpus-class file: where it lives, and how many files it exempts.
- The doc-type distribution after Step 3.
- The tier-1 baseline number, plus link findings and any API reference results separately.
- Anything the team has to decide, especially pages whose type the classifier was unsure about.
