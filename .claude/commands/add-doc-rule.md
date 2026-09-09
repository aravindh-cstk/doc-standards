# /add-doc-rule

Add a decided rule to the rulebook, with the check that enforces it and the test that proves it. Pass the rule as one sentence.

**Usage:** `/add-doc-rule "<the rule, in one sentence>"`

Use this when the rule is already decided. When somebody has reported a violation and the diagnosis
is still open, use `/doc-gap` instead: it works out whether the answer is a wordlist entry, a widened
pattern, or a new rule at all, and it often ends in no new rule.

A rule that lives only in prose is a suggestion. A rule in the registry with a check behind it is
enforced. This command is the difference.

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

Every step below runs from `$STANDARDS/scripts`.

---

## Step 1: Get the ID

Never hand-count. The IDs are not sequential within a category, and guessing one collides.

```bash
cd "$STANDARDS/scripts" && node tools/probe-corpus.js --next-id=<PREFIX>
```

The prefix says which family owns the rule:

| Prefix | Owns | Stated in |
| --- | --- | --- |
| `B1`, `B2` | Structural checklist and anti-patterns | `doc-templates/feature-docs/common-rules.md` |
| `C1` to `C9` | Wording, formatting and tone, applies to every type | `doc-templates/feature-docs/common-rules.md` |
| `CLI` | CLI-specific | `doc-templates/cli-templates/cli-common-rules.md` |
| `PLG` | Plugin guides only | `doc-templates/cli-templates/cli-plugin-guide.md` |
| `AR`, `UG` | API reference structure | the `doc-templates/api-ref/` templates |
| `MIG`, `RS1`, `RS2`, `RS3` | Migration guides, get-started routing | the matching type file |

If the rule is about wording or tone rather than one doc type's structure, it belongs in
`common-rules.md` with a `C` prefix, so every doc type benefits from it. Only give it a family
prefix when it genuinely cannot apply elsewhere.

## Step 2: State the rule in prose

Add it to the owning markdown file from the table above, in the house format:

```
### <ID>: <the rule as an imperative sentence>

**Rule:** ...
**Why:** ...
**Exception:** ...
```

The exception is not optional padding. It is what the check's false-positive guard is written
against, and what a reviewer quotes when they decide a rule does not apply. A rule with no exception
should say so explicitly rather than leaving the heading out.

## Step 3: Add the registry entry

Append to `data/rules-registry.json` with all eight fields, including the `docTypes` tag. Use `all`
unless the rule truly applies to one family, `api-ref` for an `AR` or `UG` rule, and the specific
type names for a CLI rule.

Tier discipline is the part that matters:

- **Tier 1** only when the violation is mechanically certain, with no judgment. It blocks an edit
  through the editor hook, so a tier-1 rule that can be wrong blocks correct work.
- **Tier 2** for anything with a judgment component. Its findings must carry a `falsePositiveNote`
  naming what the check knowingly accepts.
- **Tier 3** for a rule no script can decide. A tier-3 rule must not name a `checkId`, and it is
  surfaced by `/adjudicate-tier3` instead.

## Step 4: Declare the check source

Add the entry to `data/check-sources.json` with its `kind`, its `module`, and the names of the
pattern constants it uses. `validateRegistry()` fails the whole suite without it, and that check
exists because a rule once shipped advertising coverage that never existed.

If you are deliberately stating a rule you cannot yet enforce, set `"kind": "unimplemented"` and
`"module": null`. That is honest, and it puts the rule on the manual checklists the revamp commands
carry. Sixteen CLI rules are in exactly that state today.

## Step 5: Write the check

New file in `checks/`, one concern per module.

- Open with `'use strict'`.
- Require `makeFinding` from `../lib/report`.
- Put a JSDoc block above every named constant saying **why** it exists, not what it matches.
- `checks/ordered-list-sequence.js` is the model to copy.

Wire it in:

- A prose or CLI rule goes into the `CHECKS` array in `lint-doc.js`.
- An `AR` or `UG` rule goes into `lint-api-ref.js`, which keeps its own list and deliberately drops
  the eight checks that need a doc type.

## Step 6: Test it, and watch it fail first

Extend a fixture with the violating case **and at least one exemption case**, then add the
assertions.

```bash
cd "$STANDARDS/scripts" && npm test
```

Then prove the test bites: revert the check by hand, confirm the test goes red, restore it. A
regression test that has never failed is not yet a test. A rule with no false-positive guard has
nothing protecting it from the next person who widens it.

## Step 7: Regenerate the catalogs

```bash
cd "$STANDARDS/scripts" && npm run build:readme
```

`REFERENCE-RULES.md` and `REFERENCE-CHECKS.md` are generated and committed. Skipping this leaves the
registry claiming coverage the catalog does not show, which is the exact failure the validation
exists to prevent. `/doc-gate` checks for it.

## Step 8: Gate

```bash
cd "$STANDARDS/scripts" && npm run gate
```

Then report: the ID, the tier and why that tier, the files changed, and the rule's hit count on a
real corpus. A new tier-1 rule firing 40 times on a corpus believed clean means the rule or the tier
is wrong, not that the corpus is.
