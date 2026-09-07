# CLI Common Rules: All CLI Doc Types

`sdk-templates/common-rules.md` applies in full to every CLI doc. This file adds the rules that are specific to the CLI, and overrides the SDK rules where the CLI's rendering platform or command surface makes a stricter rule necessary.

Read this file alongside `sdk-templates/common-rules.md` and the per-type file for the doc you are writing: `cli-command-reference.md`, `cli-task-runbook.md`, or `cli-module-reference.md`.

**Scope.** These rules apply to any doc whose subject is the Contentstack CLI, regardless of which template it follows. A CLI doc typed `migration-guide`, `feature-doc`, or `setup-guide` is still a CLI doc, and CLI-C1 in particular binds on it.

---

## Section 1: Rules that apply to all four CLI types

These were previously restated in each per-type file, or stated on one type and silently assumed on the others. They live here now, and the per-type files point at them.

---

### CLI-C1: No CLI doc uses H4 or deeper

**Rule:** Headings stop at H3. Where a fourth level of structure is genuinely needed, use a bold lead-in on its own line, followed by the content it introduces.

**Why:** The Contentstack docs renderer emits an anchor id and a right-hand navigation entry for H2 and H3 only. An H4 renders as bare text with no id, so no other doc can deep-link to it and it is absent from the page's own navigation. This is a fact about the platform, not a style preference, which is why the rule holds for every CLI doc whatever its type. `CLI Authentication and Adding Tokens` documents all seven `auth:*` procedures at H4, and that single choice is why 26 inbound deep links across the corpus resolve to nothing.

**How to convert:**

```markdown
### cm:stacks:export

**Syntax**

    csdx cm:stacks:export --stack-api-key <API_KEY>

**Flags**

| Flag | Type | Required | Default | Description | Notes |
|---|---|---|---|---|---|
...
```

rather than:

```markdown
### cm:stacks:export

#### Syntax
#### Flags
```

**Exception:** None. A bold lead-in carries no anchor either, so if the content genuinely needs to be linked to, the grouping is wrong and it should be promoted to H3.

---

### CLI-C2: Flag and option tables use one six-column shape

**Rule:** A flag or option table uses the columns `Flag`, `Type`, `Required`, `Default`, `Description`, `Notes`, in that order. Where a flag has a short form, both forms go in the `Flag` cell, long form first.

```markdown
| Flag | Type | Required | Default | Description | Notes |
|---|---|---|---|---|---|
| `--stack-api-key`, `-k` | string | No | `-` | API key of the source stack | Mutually exclusive with `--alias` |
| `--module` | string | No | `-` | Module to export | One of: stack, assets, locales |
| `--yes`, `-y` | boolean | No | `false` | Skips the confirmation prompt | Destructive when scripted |
```

**Why:** This extends C9's four-column rule with the two columns the CLI actually needs. Type and Default are facts a reader checks before running a command, not after, and they include values a reader cannot guess: a batch limit of `100`, a retry count of `5`, a size threshold of `100000000`. The six-column shape is also the closest to what the corpus already writes, since 106 of the 167 flag tables carry Type and Default today.

**Both flag forms share one cell rather than getting a seventh column**, for two reasons. It is how the CLI's own `--help` output presents them, so the table reads the way the terminal does. And 257 of the CLI's 360 flags have no short form, so a dedicated Short column would sit empty on 71 percent of rows.

**Short flags survive at GA, and the removal was partial.** `changelog/2.x/cli-2.0.0.md` says short flags were removed "in favor of long-form only" for export, import, and all six `content-type` commands. Comparing the last 1.x release of each plugin against 2.0.0 shows the removal is real but selective:

| Command | Removed at 2.0.0 | Still shipping |
|---|---|---|
| `cm:stacks:export` | `-A` `-B` `-m` `-s` `-t` | `-a` `-c` `-d` `-k` `-y` |
| `cm:stacks:import` | `-A` `-B` `-b` `-m` `-s` | `-a` `-c` `-d` `-k` `-y` |
| `content-type:list` | `-o` `-s` | `-a` `-k` |
| `content-type:diagram` | `-d` `-o` `-s` `-t` | `-a` `-k` |

103 flags across 41 of 58 commands still carry a short form. So a table with no short-flag information is incomplete: a reader who types `-k` will find it works, with nothing on the page telling them so.

The phrase "long-form only" is what misleads, and so do the changelog's own examples, `--data-dir`, `--stack-api-key` and `--alias`, which are three of the flags that **kept** their short forms. Check `notes/reports/flag-inventory.json`, generated from the `oclif.manifest.json` inside each published npm tarball, rather than the changelog prose. That report tests every "removed" claim as a version-to-version delta for this reason.

Use `-` in the Default cell when a flag has no default. Leave Notes empty rather than padding it.

**Exception:** C9's exception survives. A table with only one or two flags and no caveats may use the two-column `Flag` and `Description` shape.

---

### CLI-C3: State the blast radius before the reader runs anything

**Rule:** State whether the documented commands mutate stack data or are read-only, in the Overview or Prerequisites.

**Why:** This is C9's first rule. It is repeated here because it binds on task runbooks as hard as it does on command references, and the runbook template did not previously restate it. These are the docs that export, overwrite, and delete stack content across more than one command, so a reader who misjudges the blast radius does not get a failed command, they get a damaged stack.

**Exception:** Commands whose name unambiguously states the action, for example `cm:stacks:delete`, may skip a standalone statement, per C9.

---

### CLI-C4: Baseline prerequisites are the same for every command doc

**Rule:** Any doc that runs a command states these prerequisites, in this order, and adds the conditional ones that apply:

1. The CLI is installed, with the Node version from `engines.node` for the documented CLI version.
2. The user is logged in, via `csdx auth:login`.
3. The region is configured, via `csdx config:set:region`.
4. **If any documented command takes `--alias`:** a management token is added via `csdx auth:tokens:add`, with its minimum required permission stated inline, per C9.
5. **If the plugin is absent from `oclif.plugins` for the documented version:** the plugin is installed via `csdx plugins:install`.

Each item links to the doc that fulfils it, per C1.

**Why:** The first three are not editorial choices. `contentstack-command/src/index.ts` is the base class every command extends, and it throws when `email` is unset and exits when `region` is unset, so a reader missing either gets a failure before their command runs at all. Stating the list in one order across every doc means a reader who has read one CLI doc can skim the section in the next one instead of reading it.

Items 4 and 5 are conditional on facts that are machine-readable, so they are always decidable rather than a judgment call. Note that the bundled plugin list differs by version: V2 dropped `cli-cm-migrate-rte` and `cli-launch` from the bundle and replaced `cli-cm-bulk-publish` with `cli-bulk-operations`, so a V1 doc and its V2 twin can legitimately disagree on item 5.

**Exception:** `cli-module-reference` docs run no command and have no Prerequisites section at all, per MOD3.

---

## Section 2: CLI conventions

Each rule below records the split measured across the 82 published CLI docs, so the file states why a convention was chosen rather than asserting it. Where the corpus is already near-unanimous, the rule codifies existing practice. Where it is close to even, the rule settles a genuine coin flip that has been costing consistency.

---

### CLI-C5: Tag every code fence with a language

**Rule:** Tag shell fences `bash` and payload fences `json`. Output transcripts and directory trees may stay untagged.

**Why:** An untagged fence does not highlight, so a reader cannot tell a command they should run from a payload they should save. All 1,782 fences in the corpus are untagged today, which makes this the single largest mechanical inconsistency in the CLI docs.

**Exception:** A fence holding terminal output, an ASCII directory tree, or a plain-text log has no meaningful language and stays bare.

---

### CLI-C6: Placeholders use single angle brackets and upper snake case

**Rule:** Write user-supplied values as `<UPPER_SNAKE_CASE>`. Do not use `<<double_angle>>`.

**Why:** The corpus is split almost exactly evenly, 41 against 40, so this has never been decided and both forms appear in sibling docs. Single angle brackets with upper snake case is the form C4 already mandates in `sdk-templates/common-rules.md`, so the CLI follows the product-wide convention rather than inventing a second one.

**Exception:** None. A literal value that is the point of the example, per C4, is not a placeholder and needs no brackets.

---

### CLI-C7: Callout labels put the colon inside the bold

**Rule:** Write `> **Note:**`, not `> **Note**:`.

**Why:** The corpus splits 218 against 82, so the majority form is already established and the minority form is drift rather than a competing convention. The four permitted labels are the closed set from `sdk-templates/common-rules.md`: `Warning`, `Note`, `Tip`, `Additional Resource`.

**Exception:** None.

---

### CLI-C8: No shell prompt inside a code fence

**Rule:** Write `csdx cm:stacks:export`, not `$ csdx cm:stacks:export`.

**Why:** A reader copies the whole line. A leading `$` makes the paste fail, and it adds nothing, because the fence already establishes that the line is a command. The corpus is 1,247 against 2, so this codifies what CLI docs already do and closes the two remaining exceptions.

**Exception:** A transcript that deliberately shows both what was typed and what was returned may keep the prompt, because there the prompt is what separates input from output.

---

### CLI-C9: Recurring section names are plural

**Rule:** Use `Limitations`, `Troubleshooting`, and `Next Steps`. Do not use `Limitation`, `Troubleshoot`, or `Next Step`.

**Why:** These names are the anchor targets other docs link to and the labels a reader scans the right-hand navigation for. A singular variant produces a different anchor id, so a link written against the plural form silently resolves to nothing. Current splits are 22 against 4, 16 against 6, and 12 against 2.

**Exception:** None. The plural is the form every template's Section Order table uses.

---

### CLI-C10: Version claims cite the changelog

**Rule:** Any claim that a flag, command, or behavior was added, renamed, or removed in a given version cites `changelog/`, and names the version the claim applies to.

**Why:** This is the CLI instance of the verified-claims rule in `sdk-templates/common-rules.md`. It matters more here than elsewhere because the CLI's public surface moved substantially at 2.0.0: short flags were removed across six plugins, `--api-version` was dropped from two bulk commands, and tsgen's `--token-alias` became `--alias`. A doc that describes a flag GA removed reads as authoritative and sends the reader to a command that fails.

`changelog/` is the source of record, not `package.json` in a local clone, which can sit behind the released version.

**Exception:** None. If a version cannot be verified before publishing, omit the claim rather than approximating it.

---

### CLI-C11: A doc derived from an older version inherits nothing without re-verification

**Rule:** When a doc is created from the previous version's page, every flag name, every flag description, and every worked example must be checked against the released manifest for the version being documented. Nothing carries over on the assumption that it is still true.

**Why:** This is the rule that would have caught the worst content defect found in the CLI corpus. `Migrate your Content using the CLI Migration Command | V2.x.x` was created from its V1 page, and the V1 page was correct. Between the two versions `cm:stacks:migration` moved its configuration interface underneath the text:

| | V1 (1.12.7) | V2 (2.0.0) |
|---|---|---|
| `--config` | Inline configuration, `<key1>:<value1>` | Path of the JSON configuration file |
| `--config-file` | Path of the JSON configuration file | removed |
| `--inline-config` | did not exist | Inline configuration, `<key1>:<value1>` |

The V2 page shipped documenting a flag that does not exist, describing a real flag as doing something a different flag does, and carrying two worked examples that GA rejects. Nothing about the page looked wrong, because every sentence in it had been true.

**`--config` is the case that makes re-verification non-negotiable.** It kept its name and changed its meaning, so no diff of flag names catches it and no reader can detect it: a V1 script passing inline values still parses, and GA reads the string as a file path. It is the only flag in the CLI surface that did this, and it slipped through the changelog and the migration guide as well as the doc.

**How to check.** `notes/reports/flag-inventory.json` is generated from the `oclif.manifest.json` inside each published npm tarball, which is what the released binary exposes. `scripts/gen_flag_accuracy_report.py` compares a doc's flag tables against it and reports four defect classes: a flag that exists on no command, a flag belonging to a different command, a flag the command has that the doc omits, and a flag whose description matches a different flag on the same command.

**Do not check against a local clone.** `repo/cli-plugins` sits on branch `v2-dev` with no `v2.0.0` tag, and its export plugin is at `2.0.0-beta.24`. Its flag data disagrees with what GA ships.

**Exception:** None.

---

### CLI-C12: A doc must not assert that documentation does not exist

**Rule:** Do not write that a guide is missing, planned, coming soon, or yet to come. If a topic has no guide, omit the topic. Do not announce the gap, and do not send the reader to a third party in place of a guide that may already exist or may ship later.

**Why:** A sentence describing a gap outlives the gap. Both `Install the CLI` pages carried this note in their `Namespaces` section:

> **Note**: The guide to create your own plugin within `csdx` is yet to come. But, as our CLI is built using the oclif package, you can create your custom plugin by referring to [oclif plugin documentation](https://oclif.io/docs/plugins).

`Create Custom CLI Plugins for Contentstack` had shipped in both versions by then, roughly 1,030 lines for V2 and 770 for V1, both live on production and both in the sidebar. The note survived both guides being written, because nothing in the authoring workflow points back at a page that merely mentions the absence of a guide.

**The cost is measurable, not theoretical.** A developer looking for CLI 2.0.0 plugin information landed on `Install the CLI`, read the note, concluded Contentstack had no plugin documentation, and built their plugin from the source repo and oclif's own docs. They reported it back rather than us finding it. The note did not merely fail to help. It answered the question wrongly on the page where the question is first asked, so the reader never reached the sidebar entry sitting two clicks away.

**This is the inverse of CLI-C10 and CLI-C11.** Those two govern claims about a product that has moved on. This one governs claims about the documentation itself, which go stale the same way and are never revisited, because no publishing step checks them.

**How to check.** `doc-standards/scripts/data/banned-phrases/absent-docs.json` bans `yet to come`, `coming soon` and `not available yet` outside code. The phrase list is not the rule. A sentence can state a gap without using any of those words, and a reviewer should read for the claim rather than the wording.

**Exception:** None. A deprecation notice pointing at a live replacement is not an absence claim and is unaffected.

---

### CLI-C13: Links to the docs site are root-relative

**Rule:** Write an internal docs link as `/docs/headless-cms/install-the-cli`. Never as `https://www.contentstack.com/docs/headless-cms/install-the-cli`. Links to the application and to third parties stay absolute.

**Why:** An absolute docs link resolves to production from every environment. A reviewer on staging who clicks one is thrown back to production mid-review, which means the link path cannot be checked before it ships. It also silently defeats any future environment, preview build or local render.

Nine such links were in the corpus. One of them was also pointing at the wrong version: `Create Custom CLI Plugins for Contentstack | V1.x.x` opened with "how to develop an external plugin for [Contentstack CLI]" linking the **V2** install page, so a V1 reader landed on 2.0.0 instructions.

**Why this was missed, which matters more than the nine links.** The word "relative" appeared exactly once in the entire standard before this rule, inside `C2-04`, and only as an incidental clause in a rule about Quick Reference tables:

> Section names in a Quick Reference table must link to the corresponding section using the relative doc URL and section anchor.

Three separate gaps followed from that:

1. **No rule covered ordinary body links.** Nothing was being violated, so nothing could be reported.
2. **Even `C2-04` does not test relativeness.** Its check asserts the cell matches `/\]\(#[^)]+\)/`, a bare fragment. A cell containing an absolute URL and no fragment fails it for the wrong reason, and one containing an absolute URL alongside a fragment passes.
3. **No check anywhere looked at `http://` at all.** Grepping every check module for a URL scheme returned nothing, so an absolute internal link was invisible to every gate in the linter.

**A 200 is not evidence of a relative link.** The link verification during the restructure fetched each target with a host prefix and confirmed it returned 200. Every absolute link passed that check, because it does resolve. It resolves to the wrong environment. A check that fetches a URL can only tell you the target exists, never that the link was written correctly.

**How to check.** `doc-standards/scripts/checks/internal-link-form.js`, registered as `CLI-17`, reports any `contentstack.com/docs/` URL outside a code fence and prints the root-relative form to use instead.

**Exception:** The application at `contentstack.com/login` and any third-party host. Neither is environment mirrored and neither has a relative form. 62 login links in the corpus are correct as they stand.

---

### CLI-C14: No CLI doc carries a page-level Troubleshooting section. Link the troubleshooting hub instead

**Rule:** A CLI command reference or task runbook does not carry a `Troubleshooting` H2. Every failure mode, old or new, belongs in the CLI troubleshooting hub (`troubleshooting/`). Link the reader there instead, in whichever section fits the page: a callout, or a line inside an existing `Limitations` or `Next Steps` section. `cli-module-reference` never carried one, per MOD3.

**Why:** The hub already exists, 30 ticket-sourced articles across five groups (export and import commands, migration and branch operations, performance and rate limits, feature availability, and migration-tool login), and is where a reader who searches an error message is likely to land. A Troubleshooting section copied onto every command page that can produce a given error goes stale in as many places as it was copied, and nothing keeps the copies in sync when the error message or the fix changes. One entry in the hub, linked from wherever the failure can occur, is the only version that stays current.

**This rule went through two stages, and the second correction matters.** It first downgraded `Troubleshooting` from Required to Recommended, leaving the 22 pages that already carried one untouched, on the reasoning that a page already documenting its own failures did not need to route around itself. The docs owner corrected that: a page-level section is exactly the duplicate this rule exists to stop, whether it was written last year or is being written today, so the 22 existing sections were removed rather than grandfathered in. `Troubleshooting` is absent from `cli-command-reference.md` and `cli-task-runbook.md`'s Section Order tables entirely now, not listed as Recommended. See CMD3 and RUN5.

**Exception:** None. `checks/section-structure.js` reports `CLI-19` if a `Troubleshooting` H2 is added back to any of the four CLI types.

---

### CLI-C15: A code-sourced finding is a limitation only if it describes a boundary on function, not a weakness in protection

**Rule:** Before writing a `Limitations` bullet sourced from the CLI or plugin code, classify what was found.

A **limitation** describes a boundary on function: a closed list of accepted values, an operation the command does not perform, an input format the command requires and safely rejects otherwise. It answers "what can I not ask this command to do."

A **vulnerability** describes a weakness in how the CLI protects data. Any of: a secret or credential written to disk in the clear, logged, or passed as a bare CLI argument where it would sit in shell history and process listings. Unsanitized input reaching a file path, shell command, or URL. Encryption or authentication that is off by default or can be silently bypassed. A check that fails open, permitting an action it should deny.

If the finding is a limitation, write it, per CLI-C9's format. If the finding is a vulnerability, or the source is not clear enough to tell which, do not put it in the docs. Not in `Limitations`, not in `Troubleshooting` (which does not exist on a CLI page per CLI-C14 anyway), not anywhere. Name the finding instead, file and line, in the session's own report, and hand it to whoever asked for the pass rather than publishing it.

**Why:** A docs site is a bad place for a vulnerability to surface first. It is public, indexed by search engines, and nobody on a security team reviews a Limitations bullet before it ships the way they would review a disclosure. "The CLI cannot do X" and "the CLI does X in a way that leaks Y" read as the same sentence shape from outside the code, so a pass built to find the first kind can walk straight into the second one without noticing the difference, and confirming the difference means reading past the line that matched a search pattern into the surrounding function.

**Worked example, from the first pass that used this rule.** Two of the eighteen sourced findings needed exactly this check before they were written down.

`Configure MFA Secret Using CLI`. The finding was that the MFA secret must be base32, at least 16 characters. Before writing that as a limitation, the surrounding code was checked for how the secret reaches the CLI at all, because a TOTP seed is exactly the kind of value that is unsafe to pass as a bare flag. It turned out `getMFACode()` reads only `process.env.CONTENTSTACK_MFA_SECRET`. There is no `--secret` flag and nothing is ever written to disk. So the format check is a limitation (a validation rule that rejects bad input safely), and the transmission path is not a vulnerability (there isn't one to describe). Both had to be checked. Only the first is in the docs.

`Configure Proxy Settings in CLI`: the finding was that `--protocol` accepts only `http` or `https`. The command also takes a proxy password and stores it via `configHandler`, which was checked next, because "stores a password" is worth confirming rather than assuming. The underlying config store encrypts its file by default (`ENCRYPT_CONF` defaults to `true`), so there was no unencrypted-secret-at-rest finding to report either way. The protocol restriction is a limitation and was written down. Nothing about password handling was, because there was nothing wrong to report and reporting "it's fine" is not what a Limitations section is for.

**How to check.** For every candidate finding, read past the line that matched a search pattern into the function that surrounds it, and ask where the value in question came from and where it goes. A flag with a closed `options` array, or a branch that says "not supported" and stops, is a limitation. A secret, token, or credential is worth one extra check every time: is it ever a bare CLI argument, is it ever written to disk unencrypted, is it ever logged. When genuinely unsure after that check, treat it as a vulnerability. A limitation held back for one more session costs a missing doc line. A vulnerability published costs a disclosure.

**Exception:** A vulnerability that is already publicly disclosed, such as a fixed CVE or a changelog entry describing the fix, is fine to reference as a version-specific claim per CLI-C10, since the disclosure already happened elsewhere and this rule exists to stop this docs site being first.

---

## Section 3: Relationship to the SDK common rules

| CLI rule | SDK rule it relates to | Relationship |
|---|---|---|
| CLI-C1 heading depth | None | New. A platform constraint with no SDK equivalent |
| CLI-C2 flag tables | C9 flag table columns | Extends. Adds Type and Default to C9's four columns, keeps C9's two-column exception |
| CLI-C3 blast radius | C9 mutation statement | Restates, and widens the scope to task runbooks |
| CLI-C4 baseline prerequisites | C1 prerequisites link, C9 token scope | Specialises. Names the exact CLI items and their order |
| CLI-C5 fence language | None | New |
| CLI-C6 placeholders | C4 parameterized placeholders | Follows. Picks the SDK form to settle a CLI split |
| CLI-C7 callout punctuation | C2 closed callout label set | Extends. The SDK rule fixes the labels, this fixes the punctuation |
| CLI-C8 no shell prompt | C4 copy-pasteable code blocks | Follows |
| CLI-C9 plural section names | C6 heading accuracy | Specialises |
| CLI-C10 version claims | C6 verified claims | Specialises. Names `changelog/` as the CLI source of record |
| CLI-C11 no inherited facts | C6 verified claims | Extends. Applies verification to a doc derived from an older version, where every sentence was once true |
| CLI-C12 no absence claims | None | New. C6 and CLI-C10 govern claims about the product, this governs claims about the documentation, which no publishing step revisits |
| CLI-C13 root-relative docs links | C2-04 Quick Reference tables | Generalises. C2-04 asked for a relative URL in one table and no check ever tested relativeness, so this states it for every link and adds the check |
| CLI-C14 troubleshooting hub | None | New. No CLI doc carries a page-level Troubleshooting section, old or new |
| CLI-C15 limitation vs. vulnerability | None | New. Governs what a code-sourced pass is allowed to publish, not the shape of a passing doc |
