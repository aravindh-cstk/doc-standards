# /adjudicate-tier3

Judge the rules no script can check, and record a verdict for every one. Pass the docs folder or a single page as the argument.

**Usage:** `/adjudicate-tier3 path/to/docs`

Tier 3 is the set of rules that need reading comprehension: whether a heading describes what is
under it, whether related facts are grouped, whether a consequence is stated before the
implementation. No regex reaches them. This command locates them, judges them, and proves the review
covered the whole list.

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

## Step 1: Generate candidates

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" "$ARGUMENTS" --out="$REVIEW/candidates.json"
```

Each candidate names a rule, a line range, the evidence that triggered it, and the one question to
answer. That is the difference between this and re-reading every page against every rule.

To work one rule at a time across the corpus, which is usually easier to judge consistently:

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" "$ARGUMENTS" --rules=C6-01,C6-02 --out="$REVIEW/candidates.json"
```

## Step 2: Judge every candidate

Either judge them yourself and write the file, or have the model do it:

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" --judge --candidates="$REVIEW/candidates.json"
```

That is a dry run. It prints a verdict per candidate and writes nothing. Add `--apply` to write:

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" --judge --apply --candidates="$REVIEW/candidates.json" --verdicts="$REVIEW/verdicts.json"
```

Writing by hand instead, the shape is one entry per `candidateId`:

```json
{ "verdicts": [
  { "candidateId": "...", "verdict": "VIOLATION", "reason": "...", "fix": "...", "confidence": "high" }
] }
```

The four verdicts and what each requires:

| Verdict | Means | Must carry |
| --- | --- | --- |
| `VIOLATION` | The rule is broken here | `reason` and `fix` |
| `COMPLIANT` | The rule is satisfied | `reason` |
| `EXCEPTION_APPLIES` | The rule's own exception covers this | `reason` and `exceptionQuoted`, the exception verbatim |
| `UNCLEAR` | Cannot be decided from the page | `reason` |

Quoting the exception verbatim is the guard against inventing one. If you cannot find the sentence
in the rule to quote, the exception does not apply.

A `--rules` run judges part of the list and keeps the verdicts it did not reach, so judgment already
made is never clobbered.

## Step 3: Reconcile

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" --reconcile --candidates="$REVIEW/candidates.json" --verdicts="$REVIEW/verdicts.json" --out="$REVIEW"
```

It exits non-zero while any candidate is unjudged, and that is the point of the whole file. The known
failure is an agent quietly stopping partway through a long list, and a review that silently covered
60 percent of the page reads as a clean bill of health.

Do not report results until this is clean.

## Step 4: The other judges, when they are wanted

These are separate passes with their own rule sets, and none of them is required to finish a tier-3
review.

```bash
node "$STANDARDS/scripts/judges/judge-tone.js" "$ARGUMENTS"
node "$STANDARDS/scripts/judges/judge-tone.js" "$ARGUMENTS" --rules=C2-09 --emit-verdicts
node "$STANDARDS/scripts/judges/judge-tone.js" "$ARGUMENTS" --rules=C3-25 --emit-verdicts
node "$STANDARDS/scripts/judges/judge-reading.js" "$ARGUMENTS"
```

`C2-09` is paragraph cohesion and `C3-25` is reference form. `judge-reading.js` scores reading level
and takes `--judge` and `--report` the same way.

## Step 5: Report

Generation only writes candidates and judgment only writes verdicts, one direction each, so
re-running generation is idempotent and cannot overwrite a judgment.

Report:

- Counts per verdict, and the total judged against the total generated.
- Every `VIOLATION` with its file, line and fix. These are ready to apply, and applying them is a
  revamp command's job rather than this one's.
- Every `UNCLEAR`, escalated to the user with what would settle it. Do not guess these.
- Every `EXCEPTION_APPLIES` whose quoted exception you had to search for, since a strained exception
  is usually a violation.
