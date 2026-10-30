# CLI pages playbook

`/fix-docs` loads this file for a page in one of the four CLI types. A CLI-subject page typed as a
prose type, such as an "Install the CLI" setup guide, follows the prose playbook instead.

| Type | The page is | Template |
| --- | --- | --- |
| `cli-command-reference` | The command surface of a plugin or namespace | `doc-templates/cli-templates/cli-command-reference.md` |
| `cli-task-runbook` | One operation, from first command to verification | `doc-templates/cli-templates/cli-task-runbook.md` |
| `cli-module-reference` | A lookup table of identifiers, limits or configuration | `doc-templates/cli-templates/cli-module-reference.md` |
| `cli-plugin-guide` | Building and publishing a `csdx` plugin | `doc-templates/cli-templates/cli-plugin-guide.md` |

## The rule files

Read all three in full, in this order:

1. `doc-templates/feature-docs/common-rules.md`, which applies in full to every CLI page.
2. `doc-templates/cli-templates/cli-common-rules.md`, with `CLI-C1` to `CLI-C15` and the places where
   a CLI rule overrides an SDK rule.
3. The type file from the table above.

## Section order

`scripts/data/section-order.json` wins when a table in prose disagrees with it.

| Type | Required sections after the title |
| --- | --- |
| `cli-command-reference` | Overview, Prerequisites, Commands, Examples, Limitations. Quick Reference at 3 or more commands. Installation only when the plugin is not bundled |
| `cli-task-runbook` | Overview, Prerequisites, Steps for Execution, Limitations. Quick Decision Guide when the operation has more than one path |
| `cli-module-reference` | Overview, Quick Reference, Main Content |
| `cli-plugin-guide` | Overview, Prerequisites, Plugin Structure, Creating a Plugin, Plugin Registration and Linking, Commands and Flags, Publishing, Next Steps |

What each type must not carry:

- **No page-level Troubleshooting H2 in any type.** Link the CLI troubleshooting hub instead.
  `CLI-19` enforces this for the first three types and `PLG-05` for the plugin guide.
- **`cli-module-reference`:** no Prerequisites and no Limitations. Its entries link out rather than
  repeat what they link to.
- **`cli-task-runbook`:** one procedure spine, and no command before the step that runs it.

A page with no H2 cannot meet any section order. Record it as `needs-input` and recommend
retiring the page, rather than inventing sections for it.

## The unenforced rules

No check reports these rules, so `fix-all.js` puts each one that applies to the page's type on the
page's checklist. Confirm every one:

| Rule | Tier | What to confirm |
| --- | --- | --- |
| `CLI-11` | 1 | Recurring section names are plural: Limitations, Troubleshooting, Next Steps |
| `CLI-12` | 1 | The Overview or Prerequisites states whether the commands change stack data or only read it |
| `CLI-13` | 1 | Prerequisites state, in order: CLI installed with the Node version from `engines.node`, `csdx auth:login`, region configured, then any management token |
| `CLI-14` | 1 | Every claim that a flag, command or behavior was added, renamed or removed cites the changelog and names the version |
| `CLI-15` | 1 | A page derived from an older version has every flag name, flag description and example re-verified against the released manifest |
| `CLI-08` | 2 | User-supplied values are written as `<UPPER_SNAKE_CASE>` |
| `CLI-10` | 2 | No shell prompt inside a code fence: `csdx cm:stacks:export`, not `$ csdx cm:stacks:export` |
| `CLI-18` | 2 | No page-level Troubleshooting H2 anywhere on the page |
| `CLI-20` | 2 | Every Limitations entry taken from code is a boundary on function, a closed list or an unsupported operation |
| `C9-01` | 2 | A command that connects to a live stack says in the Overview or Prerequisites whether it changes data |
| `C9-02` | 2 | Every prerequisite that names a token states the minimum permission or scope inline |
| `C9-03` | 2 | When a newer version of the command or tool exists, the Overview's first sentence says so, with a link |
| `PLG-01` | 2 | The Plugin Structure layout uses the real names the scaffolding creates, such as `src/commands/` |
| `PLG-02` | 2 | Each TypeScript example is a complete command class that compiles |
| `PLG-03` | 2 | Plugin Registration and Linking includes the command that confirms the plugin loaded |
| `PLG-04` | 2 | A long reference section such as Available Methods and Utilities opens with a table |

**`CLI-15` claims that cannot be verified:** when the released manifest is out of reach, record the
claim as `needs-input`. Do not keep it silently, and do not delete it.

## Technical content

Preserve command names, flag names, flag descriptions, exit codes, URLs, file paths and version
numbers.
