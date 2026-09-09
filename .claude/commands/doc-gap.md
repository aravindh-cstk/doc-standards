# /doc-gap

Close a doc-standards gap: someone spotted a rule violation the linter did not
catch. Find every other instance, work out why the linter missed it, and turn it
into a permanent check with a test.

**Usage:** `/doc-gap "<the violation, in plain language>" [corpus-path]`

Examples:

```
/doc-gap "the phrase 'same kind of work' is too casual"
/doc-gap "question word 'how' is prohibited in prose"
/doc-gap "numbered lists should only be used for sequences" ../my-project/docs
```

`$ARGUMENTS` is the reported violation, optionally followed by the corpus path.

This command diagnoses before it codifies. When the rule is already decided and the only work left
is writing the check, use `/add-doc-rule` instead.

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
SCRIPTS="$STANDARDS/scripts"
```

The corpus is whichever docs tree the violation was reported against. Take it from the second
argument. When none is given, try `$ROOT/docs`, then the docs folder of a sibling project next to
this checkout, and ask the user rather than guessing:

```bash
CORPUS="${2:-$ROOT/docs}"
[ -d "$CORPUS" ] || { echo "Corpus not found at $CORPUS. Pass it as the second argument."; exit 2; }
```

All commands below run from `$SCRIPTS`.

## Step 1: restate the violation

Write one sentence naming what is wrong and what the corrected form looks like.
Quote the offending text verbatim if the reporter gave it. This sentence is the
probe label, and the triage scores registry rules against it, so a vague label
produces a vague diagnosis.

## Step 2: baseline the corpus

```bash
node sweep-docs.js "$CORPUS"
```

Read the by-rule rollup. If a rule already fires on the reported line, the
answer may be that the check works and the message is unclear. Say so and stop
rather than adding a second rule for the same thing.

## Step 3: probe for the literal case

Write a seed entry file at `$REVIEW/probe-<slug>.json` in wordlist
shape, containing the literal the reporter quoted:

```json
{
  "ruleId": "PROBE",
  "category": "probe",
  "phrases": [{ "phrase": "same kinds of work", "fix": "cover similar tasks" }]
}
```

```bash
node tools/probe-corpus.js --entries="$REVIEW/probe-<slug>.json" --label="<step 1 sentence>"
```

This file is wordlist shape on purpose. If the gap is confirmed, the entry moves
into `data/banned-phrases/` unchanged. There is no probe syntax to translate.

## Step 4: read the corpus and find the siblings

**This is the step no script can do.** A regex cannot generate paraphrases.

Read every prose file under `$CORPUS` in full, skipping any that is still a
section skeleton. A written corpus of roughly 1400 lines is one context load, so
read it rather than grepping. List, by hand, every line you
believe is a sibling of the reported violation *by meaning*. For "same kinds of
work" that means also catching "sorts of", "two things", "ends up with".

## Step 5: widen and converge

Replace the seed `phrase` with a `pattern` covering the family you found:

```json
{ "pattern": "\\b(the same|similar|different|these|those|two|all) (kinds?|sorts?) of\\b",
  "label": "kinds of / sorts of",
  "fix": "name the category" }
```

Re-probe, then apply the **convergence test**:

- A line you listed by hand that the probe misses is either a further widening,
  or an honest admission that the case is not mechanically detectable.
- A line the probe hits that you did not list is a false-positive candidate.
  Inspect it and either narrow the pattern or accept it deliberately.

Do not proceed until the probe hits are a superset of your hand list. This step
is what makes the loop repeatable instead of a matter of taste.

## Step 6: classify the gap

The probe prints a triage classification and the top 3 candidate owning rules
with scores. Read the rules, do not just take the top one. The classifications:

| Classification | Meaning |
| --- | --- |
| `NOT_A_GAP` | An existing check already reports this line. Stop, or improve that check's message. |
| `WORDLIST_GAP` | An existing rule covers the concept and is wordlist-driven. Add an entry. |
| `REGEX_TOO_NARROW` | An existing rule covers it, but the module matches less than its own rule text says. Widen the named pattern. |
| `NO_RULE` | Nothing owns it. New module, new rule ID. |

**A structural violation has no text to probe.** If the reported violation is
about lists, tables, headings, or section structure, the probe will return zero
hits and fall through to `NO_RULE` by absence. That is the correct answer, but
you reached it by noticing the probe cannot express the violation, not because
the script detected anything. Say that in your report.

## Step 7: apply the decision rule

In order, stop at the first match:

1. **Wordlist entry**, when the trigger is a bounded set of surface strings, one
   concept, one fix sentence, and an existing rule's registry text already
   describes it. No new ID.
2. **Widen an existing regex**, when the rule sentence read literally already
   prohibits the case but the module's pattern is narrower than its own spec. No
   new ID. You must also extend the module's `falsePositiveNote` and the
   registry `exception` to name whatever the widening now deliberately exempts.
3. **New module and new rule ID**, when the judgment needs document structure,
   or when covering the case would change the meaning of an existing rule.

The tie-breaker: **if you have to rewrite the rule sentence it is a new rule. If
you only have to widen the pattern to what the sentence already says, it is a
widening.**

## Step 8: codify

For a new rule:

```bash
node tools/probe-corpus.js --next-id=C3   # never hand-count, IDs are not category-sequential
```

1. New `checks/<check-id>.js`. Use `'use strict'`, require `makeFinding` from
   `../lib/report`, and put a JSDoc block above every named constant saying WHY
   it exists. `checks/ordered-list-sequence.js` is the model.
2. Import it in `lint-doc.js` and append to `CHECKS`. For an `AR` or `UG` rule, wire it into
   `lint-api-ref.js` instead.
3. Append the registry entry to `data/rules-registry.json` with all 8 fields.
   Tier 1 only when the violation is mechanically certain. Anything with a
   judgment component is tier 2 and its findings must carry a
   `falsePositiveNote`.
4. Add the entry to `data/check-sources.json` with its `kind`, `module`, and
   pattern constant names. `validateRegistry()` fails the suite without it.
5. Extend `test/fixtures/gap-loop-proof.md` with the violating case **and at
   least one exemption case**, and add assertions to `test/gap-loop.test.js`.
   A rule with no false-positive guard has nothing protecting it from the next
   widening.
6. `npm run build:readme` to regenerate `REFERENCE-RULES.md` and `REFERENCE-CHECKS.md`. Skipping
   this leaves the registry claiming coverage the catalog does not show.

## Step 9: verify

```bash
npm test
node sweep-docs.js "$CORPUS"
```

Then prove the new test bites: revert your fix by hand, confirm the test goes
red, restore it. A regression test that has never failed is not yet a test.

Report: the classification, the files changed, the new rule's hit count on the
corpus, and any line from Step 4 that you could not make mechanically
detectable. A new tier-1 rule firing 40 times on a corpus believed clean means
the rule or the tier is wrong, not that the corpus is.
