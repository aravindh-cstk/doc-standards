# Slash commands

Ten commands, one per task this repository can perform. Each is a plain markdown prompt in
`.claude/commands/`. They are git-tracked here so the whole team gets them. The repository also
ships as a Claude Code plugin, so the same files work in every project, in Claude Code on the web,
and in two other agents.

This index lives one folder above the commands on purpose. Claude Code reads every markdown file in
`.claude/commands/` as a command, so an index inside that folder turns into a stray `/README`
command.

## Install

Pick the row for the tool you use. Every route reads the same ten files in this repository, so a
pushed change reaches all of them.

| Where you work | Install | Command names |
| --- | --- | --- |
| Claude Code on your machine, any project | The plugin, see [Claude Code](#claude-code) | `/doc-standards:revamp-doc` |
| Claude Code inside this repository | Nothing | `/revamp-doc` |
| Claude Code on the web | A setup script, see [Claude Code on the web](#claude-code-on-the-web) | `/doc-standards:revamp-doc` |
| Codex or Cursor | `scripts/install-commands.sh`, see [Other agents](#other-agents) | See that section |

### Claude Code

Run these two commands once in any Claude Code session:

```text
/plugin marketplace add aravindh-cstk/doc-standards
/plugin install doc-standards@doc-standards
```

Choose user scope when the install asks, so the commands load in every project. The repository is
public, so the install needs no GitHub login.

Claude Code keeps its own copy of the plugin, and `git pull` in this checkout does not change that
copy. To pick up a pushed change, run `/plugin marketplace update doc-standards` and then
`/reload-plugins`, or turn on auto-update for the marketplace in `/plugin`.

To test an unpushed change, add the marketplace from this checkout instead. Claude Code then loads
the files in place, and `/reload-plugins` picks up each edit:

```text
/plugin marketplace add ~/Desktop/doc-standards
```

### Claude Code on the web

A cloud session starts from a fresh machine with no `~/.claude` folder, and it does not load plugins
that a repository's settings declare. A setup script is the route that works. Paste the script
below into the setup script field of your `claude.ai/code` environment. Every session in that
environment then starts with the plugin installed:

```bash
claude plugin marketplace add aravindh-cstk/doc-standards
claude plugin install doc-standards@doc-standards
```

When a session does not list the `/doc-standards:` commands, use the fallback script below instead.
It clones this repository and links the commands into the session's own `~/.claude/commands/`, so
the names lose their prefix:

```bash
git clone --depth 1 https://github.com/aravindh-cstk/doc-standards ~/.doc-standards
bash ~/.doc-standards/scripts/install-commands.sh
```

### Other agents

`scripts/install-commands.sh` links the commands into another agent's own folder. It always creates
`~/.doc-standards`, a link to this checkout, which is how a command finds the toolchain from any
folder on the machine. Run it once per agent:

| Agent | Install | What it creates | Invoke |
| --- | --- | --- | --- |
| Codex | `bash scripts/install-commands.sh --tool=codex` | A skill per command in `~/.codex/skills/`, each pointing at the command file here | Name the skill, for example `$revamp-doc` |
| Cursor | `bash scripts/install-commands.sh --tool=cursor` | A link per command in `~/.cursor/commands/` | `/revamp-doc` |
| Claude Code without the plugin | `bash scripts/install-commands.sh` | A link per command in `~/.claude/commands/` | `/revamp-doc` |

Pass `--dry-run` to see the changes first, and `--uninstall` to remove them. The script never
overwrites a file it did not create. Re-run it after adding a command.

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

`/doc-gap`, `/add-doc-rule` and `/doc-gate` change or check the toolchain itself, so they stop unless
they run against a git clone of this repository. The plugin's copy does not qualify, because each
plugin update replaces it and discards any edit made there. Run those three from inside your clone.

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

The resolver tries the following locations in order, and the first one that holds the linter wins:

1. This repository as its own git root.
2. This repository as a `doc-standards` subfolder of a consuming repository.
3. A `doc-standards` folder in the working directory or any directory above it. This check mirrors
   `find_linter()` in `~/.claude/hooks/lint_doc_standards.py`, and it prefers a live checkout next
   to the project over the plugin's copy.
4. The plugin's own folder. Claude Code replaces `${CLAUDE_PLUGIN_ROOT}` with that path when it loads
   a plugin command. A command loaded any other way keeps the literal text, and the shell expands it
   to an empty string, so the check fails and the resolver moves on.
5. `~/.doc-standards`, the link that `scripts/install-commands.sh` creates and that the web fallback
   script clones into.

When none of them holds the linter, the resolver exits 2 with a message rather than running against a
path that does not exist. `STANDARDS=` clears any value left in the shell, and the `pwd` fallback
keeps `REVIEW` inside the working directory when it is not a git repository.

`REVIEW` exists because the scratch directory otherwise escapes the repository.
`scripts/judges/review-candidates.js` computes its own default as two levels above `scripts/`, which is
the parent of this checkout, so a run from here would write to the folder holding the checkout.
Every invocation that generates candidates or verdicts passes `--out="$REVIEW"`.

## Writing a new command

1. Copy the resolver block verbatim into a `## Setup` section. When the command edits the
   toolchain, copy the clone check from `doc-gate.md` directly below it.
2. Follow the house shape: an `# /name` H1, one line saying what it does, a `**Usage:**` line, the
   setup section, then numbered `## Step N` sections. No YAML front matter.
3. Take `$ARGUMENTS` as the target and say what happens when it is missing.
4. Name the exact script, the exact flags and the exit codes. Never invent a flag. The linters
   reject an unknown one.
5. Add the command to the table above and to `EXPECTED` in `scripts/test/commands.test.js`. The
   plugin picks it up after a push. Re-run `bash scripts/install-commands.sh` for each linked agent.
6. Run `cd scripts && npm test` and confirm `commands.test.js` still passes.
