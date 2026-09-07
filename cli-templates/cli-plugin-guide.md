# CLI Plugin Guide: Section Order

A CLI plugin guide teaches a developer to build, test, and publish their own `csdx` plugin. It is not about using an existing command, it is about writing the code that becomes one. That is the test for this type: a command reference or task runbook has a reader who runs `csdx` commands, a plugin guide has a reader who is about to add one.

Apply `sdk-templates/common-rules.md` (B1, B2, C1-C9) and `cli-common-rules.md` (CLI-C1 to CLI-C15) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point, states that this builds a plugin |
| 3 | Overview | Required | 1-3 sentences: what building a plugin gets you, and that it is built on oclif |
| 4 | Prerequisites | Required | Node version, CLI installed, and the TypeScript or oclif familiarity the guide assumes |
| 5 | Plugin Structure | Required | The real directory layout: `package.json`, `src/commands/`, `oclif.manifest.json`, and what each piece is for |
| 6 | Creating a Plugin | Required | Scaffolding a new plugin and generating its first command, as a procedure the reader follows in order |
| 7 | Plugin Registration and Linking | Required | Making `csdx` discover the plugin locally, so the reader can run the command they just wrote |
| 8 | Commands and Flags | Required | How the reader defines their own command surface: flags, args, and the base classes available |
| 9 | Testing | Recommended | Unit and functional test patterns for a plugin's commands |
| 10 | Publishing | Required | Getting the plugin onto npm and installable via `csdx plugins:install` |
| 11 | Managing Installed Plugins | Recommended | Update, uninstall, and reset, which the reader needs while developing, not only after shipping |
| 12 | Available Methods and Utilities | Optional | Reference appendix cataloguing `@contentstack/cli-utilities` and base command methods a plugin author can call |
| 13 | Limitations | Recommended | Known coverage gaps, per C9 |
| 14 | Next Steps | Required | Links to what comes after, each with a description |

**Governing rule:** A reader arrives wanting to go from nothing to a published, installable command, and completes that arc by reading top to bottom. They return to Available Methods and Utilities afterward, as a reference, while they write more commands.

Sections not named in this table (`Important Considerations`, `Best Practices`, and similar) are common in this type and stay wherever they naturally sit. They are not tracked for order the way the table's own rows are, the same treatment `Main Content` gets in other CLI types.

**Available Methods and Utilities is Optional, not Required, deliberately.** A plugin guide for a CLI with a thin utilities surface has nothing to catalogue here, and an empty or padded reference section is worse than an absent one. Where the surface is real, MOD2's reasoning applies just as it does on a module reference: without an index, a long reference section is unusable, so PLG-04 below requires one once the section exists at all.

---

## Type-Specific Rules

### PLG-01: Plugin Structure names real paths, not a paraphrase

**Rule:** The directory layout in `Plugin Structure` uses real file and folder names exactly as the CLI's plugin scaffolding creates them: `src/commands/`, `oclif.manifest.json`, `package.json`, not renamed or reorganized for readability.

**Why:** A reader building their first plugin is about to create these exact files. A paraphrased layout (`commands/` instead of `src/commands/`, or omitting `oclif.manifest.json`) either does not match what their scaffolding tool produces, or leaves out a file the plugin will not load without.

**Exception:** None.

---

### PLG-02: Every command example is a complete, compilable snippet

**Rule:** A TypeScript example under `Creating a Plugin` or `Commands and Flags` is a complete command class, importable and buildable as shown, not a fragment that only illustrates a shape.

**Why:** The reader is going to paste this into a file and run their build. A fragment that reads correctly but does not compile (a missing import, an undeclared base class) fails at the one moment a plugin guide most needs to work, before the reader has anything running to debug from.

**Exception:** A snippet explicitly introduced as showing one option in isolation (a single flag definition, cited by name) does not need to be a full class, provided the surrounding prose says so.

---

### PLG-03: Registration is verified before the guide moves on

**Rule:** `Plugin Registration and Linking` includes a command the reader runs to confirm the plugin loaded (for example, listing installed plugins or running the new command with `--help`), not just the linking command itself.

**Why:** `csdx plugins:link` succeeding is not the same as the command being usable. A namespace collision or a build step skipped earlier fails silently at this point otherwise, and the reader spends the rest of the guide debugging a step that already went wrong.

**Exception:** None.

---

### PLG-04: A reference section long enough to scroll gets an index

**Rule:** Where `Available Methods and Utilities` (or an equivalent reference section) runs long enough that a reader would scroll past what they need, it opens with a table mapping each method or utility to its subsection.

**Why:** This is MOD2's rule, restated for the one section in this type that is shaped like a lookup page rather than a procedure. A developer skimming for one method should not have to read the whole appendix to find it.

**Exception:** A reference section short enough to read in full does not need an index.

---

### PLG-05: No Troubleshooting section

**Rule:** Do not add a `Troubleshooting` H2 to this type. Link the CLI troubleshooting hub instead, per CLI-C14.

**Why:** Same reason as the other two CLI types: one entry in the hub stays current, a copy on this page does not.

**Exception:** None. `checks/section-structure.js` reports `CLI-19` if one is added back.
