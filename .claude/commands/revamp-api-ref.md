# /revamp-api-ref

Revamp SDK API reference pages to comply with the `api-ref` standards. Pass the SDK reference folder, or a single page, as the argument.

**Usage:** `/revamp-api-ref path/to/sdk-reference-folder`

Prefer the folder. Two of the checks compare a page against its siblings on disk, and pointing at a
single file makes those two silently pass.

---

## What this command owns

The three page shapes of an SDK API reference, and nothing else:

| Shape | Filename | Template |
| --- | --- | --- |
| Usage guide | `usage_guide.md` | `doc-templates/api-ref/api-ref-usage-guide-v2.md` |
| Class page | `class_reference.md` | `doc-templates/api-ref/api-ref-class-v2.md` |
| Method page | any `.md` inside a `methods/` folder | `doc-templates/api-ref/api-ref-method-v2.md` |

This family is classified by filename, not by front matter and not by a `--type` flag. A prose page
belongs to `/revamp-doc`. A CLI page belongs to `/revamp-cli-doc`.

The three filenames match the three CMS content types in the reference chain. `usage_guide.md` is
the one standalone entry page for an SDK, `class_reference.md` is a class page, and anything under
`methods/` is a method page. A usage guide owns an H1 and carries no trailing rule, like a class
page, but its section set and its two navigation tables, Class Overview and Task Index, are its own.
That is why the `UG-*` rules exist separately from the `AR-*` ones.

### Is this the right command

A doc belongs here when it is organized as one page per class plus one page per method, and each
method page has a parameter table, a `Returns` line and worked code examples. A Method Index, the
table on a class page that links every method to its own page, is the clearest single signal.

A doc organized around a task or a concept instead, so a guide, a getting-started walkthrough, a
migration path or a setup procedure, is not this family. Route it to `/revamp-doc`.

Do not mix the two. A conceptual guide needs no Method Index and no Validation section. A method
page needs no Overview and no Prerequisites section. Applying the wrong family's structural rules is
a common and avoidable review mistake.

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

---

## Step 1: Classify the target

Look at the path in `$ARGUMENTS`.

1. A directory, so it may hold all three shapes. Lint it whole.
2. Basename `usage_guide.md` (or `usage-guide.md`), so a usage guide.
3. Basename `class_reference.md`, so a class page.
4. Any `.md` whose parent folder is named `methods`, so a method page.
5. **None of the above.** Stop here yourself.

State the shape you detected in one sentence before going on.

**The linter will not stop you, so this step has to.** `collectFiles` filters by filename only when
the target is a directory. Given a single file it lints it whatever it is called, treating anything
that is not a `class_reference.md` or a `usage_guide.md` as a method page. Pointed at a prose page it
reports a page with no H3, no parameter table, no Returns line and no trailing rule, which is a
report full of confident nonsense. The exit-2 path, "No api-ref pages found", only fires for a
directory that holds none.

So when the path is not one of the four shapes above, do not run the linter. Either the page is a
different doc type, in which case route to `/revamp-doc` or `/revamp-cli-doc`, or it is a reference
page filed under the wrong name, in which case say so and ask the user before moving anything.
Renaming a file to satisfy the linter is never the fix.

## Step 2: Widen a single-page target

Two checks read sibling files off disk and report nothing when they cannot see them:

- A class page's Method Index is compared against the actual `methods/*.md` files. A method on disk
  that the index does not link is unreachable in the rendered page, reported as `AR-09`.
- A usage guide's Class Overview table is compared against the sibling folders that contain a
  `class_reference.md`. A class missing from that table is unreachable from the landing page.

So set the lint target one level up from a single page:

- A method page, so lint its class folder, the parent of `methods/`.
- A class page, so lint the folder containing it.
- A usage guide, so lint the folder containing it.

Say in one sentence that you widened the target, and which folder you are linting. Keep the page the
user named as the page you edit.

## Step 3: Lint

```bash
node "$STANDARDS/scripts/lint/lint-api-ref.js" "<lint target>" --format=text --tiers=1,2
```

Exit codes: 0 clean, 1 at least one tier-1 finding, 2 a usage error such as a target that holds no
api-ref pages.

The report lists each file, then `ERROR` rows for tier 1 and `FLAGGED` rows for tier 2, then a
by-rule rollup. Treat `ERROR` rows as pre-confirmed and apply them. Confirm each `FLAGGED` row
against its rule text before deciding, and read the `note:` line under it, which names the
false positive the check knowingly accepts.

When the target is a folder carved out of a larger doc set, relative links that point outside it
report as dead. Give the linter the canonical tree so it can resolve them:

```bash
node "$STANDARDS/scripts/lint/lint-api-ref.js" "<lint target>" --format=text --tiers=1,2 --baseline="<canonical doc-set root>"
```

`--baseline` covers relative links in prose and nothing else. It does not reach the two
completeness checks, which compare a page against what is actually on disk beside it. On a partial
extract they fire for every method the class page indexes but that was not copied across, one
`AR-09` per row, which is the largest block of findings you will see and none of them is a real
defect. Recognise that pattern and say so rather than deleting index rows to silence it. If a class
page indexes 38 methods and one file came across, the fix is reviewing the whole class folder.

Do not run `sweep-docs.js` on these pages. It lints per file with `lint-doc.js`, which classifies a
method page as a conceptual guide and fills the report with findings for sections this shape never
had.

## Step 4: Load the rules

Read these in order, in full, before editing:

1. The template for each shape present in your target: `$STANDARDS/doc-templates/api-ref/api-ref-usage-guide-v2.md`,
   `$STANDARDS/doc-templates/api-ref/api-ref-class-v2.md`, `$STANDARDS/doc-templates/api-ref/api-ref-method-v2.md`.
   `$STANDARDS/doc-templates/api-ref/usage-guide-derivation.md` records how the usage guide shape was
   derived, and is worth reading before you argue with it.
2. `$STANDARDS/doc-templates/feature-docs/common-rules.md`, for the wording rules that apply unchanged: banned phrases,
   the no-dash rule, passive voice, metaphors, periphrasis, sentence concision, numeric error codes
   as inline code, embedded questions, and bolding a retry count.

The structural rules for this family are `AR-01` through `AR-10` and `UG-01` through `UG-13`, tagged
`docTypes: ["api-ref"]` in `$STANDARDS/scripts/data/rules-registry.json`. Read the rows for the IDs
the linter reported rather than the whole registry.

They live in the root registry rather than a folder of their own on purpose. The registry is
validated as one artifact: `lib/rules-registry.js` cross-checks it against `data/check-sources.json`
and against the check modules, so a tier-3 rule may not name a `checkId`, a tier-1 or tier-2 rule
must name one, and no check may emit an ID another check owns. A second registry in a subfolder sits
outside all of that, which is how a rule ships advertising coverage that never existed. It was tried
in August 2026 and reverted. `test/gap-loop.test.js` now guards the invariant and records the
incident. The isolation is expressed as data, `docTypes: ["api-ref"]` on each rule, not as a
directory.

So a new rule about this family's structure goes in the root registry with that tag, and a new rule
about wording or tone goes in `common-rules.md` instead, where every doc type benefits from it.
Compute the next free ID rather than guessing it:

```bash
node "$STANDARDS/scripts/tools/probe-corpus.js" --next-id=AR
```

## Step 5: Do not report what does not apply

`lint-api-ref.js` deliberately drops eight checks that need a doc type this family does not have.
Their absence is correct, so do not reintroduce their findings by eye:

- No front-matter check for `title`, `description` and `url`. An api-ref page carries exactly three
  keys, `uid`, `seo_title` and `seo_description`.
- No section-order check against `section-order.json`. The shapes have their own section sets.
- No Next Steps, Quick Reference or Troubleshooting section checks.
- No getting-started or migration checks, and none of the guide-tuned heuristics.

Two shape facts that read as defects and are not:

- A method page has no H1 and no H2 sections. It is a fragment the CMS concatenates into the
  rendered class page, which is also why it ends with a horizontal rule and why both SEO fields are
  deliberately empty.
- A usage guide and a class page are standalone URLs, so they do carry real SEO text and must not
  end with a trailing rule.

## Step 6: Walk the deduplication ladder

This is judgment, and it is the rule most often broken. From
`doc-templates/api-ref/api-ref-usage-guide-v2.md`:

| Scope of the fact | Page that owns it | Section |
| --- | --- | --- |
| True of every class in the SDK | `usage_guide.md` | SDK-Wide Notes, SDK Limitations |
| True of every method in one class | `class_reference.md` | Class-Level Notes, Capability Matrix |
| True of one method | the method page | Warnings, Limitations |

The ladder cuts both ways. A fact true of the whole SDK belongs on the usage guide once and must not
be repeated on class pages. A fact confined to one class must not be hoisted to the usage guide,
because a reader who finds it there will assume it applies everywhere. The test for a note sitting
too high: if you find yourself writing "except for the Asset class", it belongs lower.

When you move a note up, delete it from every page it came from in the same edit. Two copies drift,
and the reader cannot tell which is current.

Report each move as: the fact, the page that held it, the page that should own it.

## Step 7: Verify every default by hand

`AR-10` has no check behind it. `check-sources.json` marks `api-ref-verified-defaults` as
unimplemented, so this step is the only thing enforcing the rule.

For every parameter table, and for the "Default when unset" column of a usage guide's SDK-Wide
Notes, confirm each value against the SDK signature in code.

- **Never take a default from an API reference doc or a Postman collection.** Those `Default:`
  fields are sample request values, and they are wrong often enough to be unusable.
- Tell-tales that a value came from one: a `skip` parameter with a non-zero default, a `limit` on a
  single-item fetch endpoint, or a required parameter carrying a default at all.
- When the SDK sets no default and the API applies its own, write `API default` and name the value
  only if it is known, for example `API default (100)`.
- For a required parameter write `Not applicable`. Do not use a dash. `C3-05` forbids dashes outside
  code blocks, and a table cell is not a code block.
- Never leave the cell blank, and never invent a number. A fabricated default is worse than saying
  the value is undocumented, because the reader cannot tell it is wrong.

While you are in the parameter tables, check the two claims that must agree with each other:

- The Returns line on a method page and the Returns cell for that method in its class page's Method
  Index must be the same sentence, not a paraphrase.
- What the Validation section says about error handling must match what the first code example on
  the page actually does. A page that tells the reader to check for an `error` key and then shows a
  bare `try` teaches the opposite of what it says, and the example is what gets copied.

## Step 8: Tier 3

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" "<lint target>" --out="$REVIEW"
```

Judge every candidate into `$REVIEW/verdicts.json`, one entry per `candidateId`, then:

```bash
node "$STANDARDS/scripts/judges/review-candidates.js" --reconcile --out="$REVIEW"
```

Expect few candidates here. The generators are prose-shaped and several are no-ops on a reference
fragment. A short list is the expected result, not a sign the run failed.

## Step 9: Edit in place

```bash
git status --short "<the page you are editing>"
```

If the file already has uncommitted changes, say so and ask whether to continue, so a revamp does
not get mixed into someone else's unfinished edit.

Edit in place. Never write a `-revamped.md` sibling. Git is the safety net.

Never alter code blocks, method signatures, parameter names, types, error codes, URLs, file paths or
version numbers. On this doc type the technical content is the content.

## Step 10: Re-lint and report

Re-run Step 3 and repeat until no tier-1 finding remains.

Report:

- Findings applied, by rule ID.
- Every deduplication move from Step 6, with the page that now owns the fact.
- Every `Default` cell corrected in Step 7, and the source you verified it against.
- Anything you could not resolve, escalated to the user rather than guessed.
