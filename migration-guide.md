# Migration Guide: Section Order and Rules

A migration guide helps a developer upgrade from one version of an SDK, API, or tool to another when the upgrade contains breaking changes.

Apply the rules in `common-rules.md` (B1, B2, C1-C7) alongside this file. The C8 rules below extend those shared rules and are specific to migration guides.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL, version) | Required | Metadata, version field identifies which upgrade this guide covers |
| 2 | Page title | Required | States the source and target version explicitly |
| 3 | Overview | Required | States when the guide applies, what the breaking change is, and what the reader gains |
| 4 | Quick Decision Guide | If multiple migration paths exist | Orients developers (full migration vs. gradual) before they read requirements |
| 5 | Prerequisites | Required | Mandatory: target SDK and runtime versions with links. Optional: background knowledge |
| 6 | Type Mapping Reference | Required if the API surface changes | Before/after table covering every renamed type, method, and attribute |
| 7 | Main Content | Required | One subsection per changed area, each subsection contains a Before block and an After block |
| 8 | Gradual Migration | Required if a partial migration path exists | Adapter or compatibility pattern for incremental porting |
| 9 | Troubleshooting | Required | Root cause and resolution for each known failure introduced by the migration |
| 10 | Pre-Upgrade Checklist | Required | Ordered checklist of every change the developer must make before removing the old dependency |
| 11 | Next Steps | Required | Links to SDK changelog, official migration references, and related docs |

---

## C8: Migration Guide Rules

Every rule follows this format:

> **Rule:** The rule, stated in one sentence.
> **Why:** The rationale, what breaks without it, or what it enables.
> **Exception:** When the rule does not apply.

---

**Rule:** The Overview of a migration guide must state three things in order: when the guide applies (which upgrade), what breaks (the specific breaking change), and what the reader gains (what this guide covers).
**Why:** A developer landing on a migration guide has an urgent, context-specific question: "Does this apply to me, and what do I have to do?" The three-part structure answers that in the first three sentences.
**Exception:** None.

---

**Rule:** Include a `version` field in the SEO front matter of migration guides. Its value is the target version the guide applies to (for example, `v1.0.0-beta.1`).
**Why:** Migration guides are version-specific. Without the version field, search and indexing tools cannot distinguish between guides for different upgrade paths.
**Exception:** None.

---

**Rule:** Every Main Content subsection in a migration guide must contain a Before block and an After block with labeled code examples. The Before block carries the old version label, and the After block carries the new version label.
**Why:** Developers migrating code need to see the old pattern and the new pattern side by side. A subsection that describes only the new API requires the developer to look up the old code themselves.
**Exception:** A subsection that introduces a capability with no prior equivalent (a new method or type that did not exist before) does not need a Before block. State explicitly that there is no prior equivalent.

---

**Rule:** The Type Mapping Reference is a table, not prose. Minimum columns: Area, old API identifier with version label, new API identifier with version label.
**Why:** Developers migrating a codebase search for old identifiers first. A table lets them scan the old column to find what they need to replace, then read across to the new column. Prose requires reading the entire section.
**Exception:** If fewer than three identifiers changed, a table still applies. A two-row table is valid.

---

**Rule:** Each row in the Type Mapping Reference covers one renamed or replaced identifier. Do not group multiple renames into one row.
**Why:** A grouped row ("JObject, JToken, JArray → JsonObject, JsonNode, JsonArray") prevents developers from searching the table for a single identifier and finding a clean match.
**Exception:** None.

---

**Rule:** The Pre-Upgrade Checklist is an ordered list. Each item is a single, discrete action (search for a symbol, replace a method call, run tests). Each item links to the subsection that covers the full change.
**Why:** The checklist is a completeness tool, not a summary. An item without an anchor link requires the developer to search the doc for the relevant section. An item that bundles two actions cannot be checked off independently.
**Exception:** Test-and-verify steps at the end of the checklist (running integration tests, removing the old dependency) do not need subsection links because they have no corresponding doc section.

---

**Rule:** The Gradual Migration section, if present, must state what the adapter does not restore. List the things the developer still must fix manually.
**Why:** An adapter that appears to solve the migration problem without caveats creates false confidence. Developers who use it without reading the limits will encounter failures at call sites the adapter does not cover.
**Exception:** None.

---

**Rule:** Do not include theory sections in migration guides.
**Why:** A developer performing a migration is executing a task under time pressure. Background on how the new serializer works internally is not actionable during the migration. It belongs in a separate conceptual doc linked from Next Steps.
**Exception:** A one-sentence orientation in the Overview is acceptable if it prevents a common misunderstanding about the scope of the breaking change.
