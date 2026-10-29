# Slash commands

Ten commands, one per task this repository can perform. Each is a plain markdown prompt read by
Claude Code. They are git-tracked here so the whole team gets them, and symlinked into
`~/.claude/commands/` so they work from any repository on the machine.

## Install

Run once after cloning:

```bash
bash scripts/install-commands.sh
```

That symlinks every `.md` file in this folder into `~/.claude/commands/`. A repository-local
command is only discovered when Claude Code starts inside this repository, but these commands are
used while working in a consuming docs repository, so the symlink is what makes them reachable.
This folder stays the source of truth. Re-run the script after adding a command.

## The commands

| Command | Job | Edits docs |
| --- | --- | --- |
| `/revamp-doc <path>` | Bring one prose page into compliance | Yes |
| `/revamp-api-ref <path>` | Bring SDK API reference pages into compliance | Yes |
| `/revamp-cli-doc <path>` | Bring a CLI page into compliance | Yes |
| `/audit-docs [path]` | Rank every finding across a whole corpus | No |
| `/classify-doc-types [path]` | Stamp `doc_type:` across a corpus | Front matter only |
| `/adjudicate-tier3 [path]` | Judge the rules no script can check | No, writes verdicts |
| `/doc-gap "<violation>"` | Turn a missed violation into a permanent check | No, edits the toolchain |
| `/add-doc-rule "<rule>"` | Add a decided rule plus its check and test | No, edits the toolchain |
| `/doc-gate` | Pre-merge safety check | No |
| `/onboard-docs-repo <path>` | Wire the toolchain to a new project | No |

### Which revamp command

The three revamp commands split by rule family, because each family has its own templates and its
own linter. Picking the wrong one produces a long list of findings that are all wrong in the same
way.

| The page is | Command | Linter behind it |
| --- | --- | --- |
| `usage_guide.md`, `class_reference.md` or a file under `methods/` | `/revamp-api-ref` | `scripts/lint/lint-api-ref.js` |
| A CLI command reference, task runbook, module reference or plugin guide | `/revamp-cli-doc` | `scripts/lint/lint-doc.js` with a `cli-` type |
| Any of the eight prose types in `doc-templates/feature-docs/` | `/revamp-doc` | `scripts/lint/lint-doc.js` |

### `/doc-gap` against `/add-doc-rule`

Both end with a new check in the registry, and they start from different places.

- `/doc-gap` starts from a violation somebody spotted, and its first job is diagnosis. The answer
  may be a wordlist entry, a widened pattern, or no change at all because a check already reports
  the line.
- `/add-doc-rule` starts from a rule already decided, and skips straight to codifying it.

## The shared resolver

Every command opens with the same block. Do not edit one copy. `scripts/test/commands.test.js`
asserts all ten carry it verbatim, and the test fails on a copy that has drifted.

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

It handles four layouts: this repository as its own git root, this repository as a `doc-standards`
subfolder of a consuming repository, a working directory deep inside either, and no checkout at
all, which exits 2 with a message rather than running against a path that does not exist. The
walk-up branch mirrors `find_linter()` in `~/.claude/hooks/lint_doc_standards.py`, which is the
convention already in use on this machine.

`REVIEW` exists because the scratch directory otherwise escapes the repository.
`scripts/judges/review-candidates.js` computes its own default as two levels above `scripts/`, which is
the parent of this checkout, so a run from here would write to the folder holding the checkout.
Every invocation that generates candidates or verdicts passes `--out="$REVIEW"`.

## Writing a new command

1. Copy the resolver block verbatim into a `## Setup` section.
2. Follow the house shape: an `# /name` H1, one line saying what it does, a `**Usage:**` line, the
   setup section, then numbered `## Step N` sections. No YAML front matter.
3. Take `$ARGUMENTS` as the target and say what happens when it is missing.
4. Name the exact script, the exact flags and the exit codes. Never invent a flag. The linters
   reject an unknown one.
5. Add the command to the table above and re-run `bash scripts/install-commands.sh`.
6. Run `cd scripts && npm test` and confirm `commands.test.js` still passes.
