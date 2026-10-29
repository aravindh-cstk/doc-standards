# /doc-gate

Answer one question: is it safe to merge. Runs the full pre-merge check and fixes nothing.

**Usage:** `/doc-gate`

Run this after any change to the rules, the checks, the fixers or the tests. It is read-only by
design. When it fails, it names what failed and stops, so the fix is a deliberate next step rather
than something that happened during a verification run.

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
```

This command changes or checks the toolchain itself, so it needs your git clone of doc-standards.
Each plugin update replaces the plugin's own copy and discards any edit made there. Stop when the
check below fails:

```bash
case "$STANDARDS" in */.claude/plugins/*) echo "Run this command from inside your doc-standards clone, not the plugin copy at $STANDARDS."; exit 2 ;; esac
[ "$(git -C "$STANDARDS" rev-parse --show-toplevel 2>/dev/null)" = "$(cd "$STANDARDS" && pwd -P)" ] || { echo "$STANDARDS is not a git clone of doc-standards. Run this command from inside your clone."; exit 2; }
```

---

## Step 1: Record what is already uncommitted

The catalog-freshness check in Step 3 reads `git status`, so it needs to know what was dirty before
this run.

```bash
cd "$STANDARDS" && git status --short
```

Keep that list. Anything appearing later that is not on it came from this run.

## Step 2: The gate

```bash
cd "$STANDARDS/scripts" && npm run gate
```

That is three stages in order, and it stops at the first failure:

| Stage | What it runs | What a failure means |
| --- | --- | --- |
| `npm test` | The full suite | A check changed behavior, or the registry does not validate |
| `npm run links` | Internal links and labels across the corpus | A link or an anchor is dead, or a link's text does not match its target |
| `npm run sweep:tier1` | Every blocking finding across the corpus | A page violates a tier-1 rule |

When a stage fails, run it alone to get the whole output rather than the truncated tail:

```bash
cd "$STANDARDS/scripts" && npm test
cd "$STANDARDS/scripts" && npm run links
cd "$STANDARDS/scripts" && npm run sweep:tier1
```

The `links` and `sweep:tier1` stages target `../../docs`, which resolves outside this checkout. On a
machine where that folder does not exist, those two stages have nothing to read. Say so plainly
rather than reporting them as passed, and point them at a real corpus to check them:

```bash
cd "$STANDARDS/scripts" && node sweep-docs.js "<docs folder>" --tiers=1
cd "$STANDARDS/scripts" && node check-links.js "<docs folder>" --layers=internal,labels
```

## Step 3: Catalog freshness

The two reference catalogs are generated and committed. A rule change that does not regenerate them
leaves the registry claiming coverage the catalog does not show.

```bash
cd "$STANDARDS/scripts" && npm run build:readme
cd "$STANDARDS" && git status --short REFERENCE-RULES.md REFERENCE-CHECKS.md
```

An empty result means they were current. A diff in either file, on a path that was not dirty in Step
1, is a failure: somebody changed a rule without regenerating. Report it as a failure and leave the
regenerated files in place, since they are the correct content and the commit should carry them.

## Step 4: Section-order freshness

`data/section-order.json` is generated too, and it is what the linter actually reads for section
rules. A type file whose table was edited without regenerating means the prose and the enforcement
disagree.

```bash
cd "$STANDARDS/scripts" && npm run build:section-order
cd "$STANDARDS" && git status --short scripts/data/section-order.json
```

Same rule as Step 3: a diff on a previously clean path is a failure.

## Step 5: Report

One line per stage, pass or fail, in the order they ran. On any failure, name it precisely:

- The failing test, with its assertion.
- The dead link, with the file and line.
- The tier-1 findings, grouped by rule ID with counts.
- The generated file that was stale.

End with the verdict in one sentence: safe to merge, or not, and what has to happen first. Do not
fix anything. Hand a rule problem to `/add-doc-rule` or `/doc-gap`, and a page problem to the
matching revamp command.
