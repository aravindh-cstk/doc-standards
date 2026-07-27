# Common Rules: All Doc Types

These rules apply to every doc type: conceptual guides, feature docs, how-to guides, setup guides, kickstarters, and migration guides. Doc-type-specific rules live in the per-type files alongside this one.

---

## Section Definitions

These definitions apply to every doc type. Per-type files specify which sections are required or optional for that type.

**Overview**
One to three sentences. State what the developer achieves or gains, not what the guide does. Avoid guide-centric phrasing such as "this guide walks you through" or "this guide covers." Do not repeat the page title verbatim. Do not include setup steps, prerequisites, or background history.

For migration and upgrade docs, use this structure: state when the guide applies, explain what the change breaks, then state what the reader gets. Pattern: "Use this guide when you upgrade [product] from [version] to [version]. The new version [what changes], breaking [what breaks]. This guide shows [what the reader gains]."

**Quick Decision Guide**
A table that appears before Prerequisites so developers orient themselves before reading requirements. Minimum columns: Approach, Key configuration value, Reason. Recommended addition: Framework examples column mapping each approach to known kickstarters or framework patterns. Use this section whenever the doc covers two or more paths that require different setup.

**Quick Reference**
A navigation table with three columns: Use Case, Section, and Key Call. Each row maps one developer intent to the section that addresses it and the primary API call involved. The Section column links to the corresponding section using the relative doc URL and section anchor. Place Quick Reference directly after the Overview with a one-line lead-in sentence. Use whenever the doc has many distinct sections and developers are likely to arrive with a specific task rather than reading top to bottom.

**Prerequisites**
A list of items that must be true before the developer can start. Each item links to the resource that fulfills it.

Split into two labeled subsections, **Mandatory** and **Optional**, only when the doc actually has items that improve the experience or unlock additional capability without blocking the core task. If there are no such items, do not add an Optional subsection, and do not add a Mandatory heading either. A single flat list is correct when everything in it is required.

Region or locale configuration that is required for some but not all users (for example, non-North-America stacks) is Mandatory, conditionally stated, not Optional. Optional is reserved for items that do not block the core task for any user.

Do not restate mandatory prerequisites elsewhere in the doc. One canonical location per fact.

**Main Content**
The primary working section. Contains setup steps, code examples, and configuration patterns. Organized into subsections by rendering approach, SDK type, or use case. Each subsection must be self-contained enough to act on without reading sibling subsections. Theory and background belong after this section, not inside it.

**Theory Sections**
Sections that explain how something works internally (data flows, event protocols, hash mechanics, SDK internals). These come after the developer has a working setup. They are optional but valuable for debugging and deep understanding.

**Troubleshooting**
Each entry requires three elements: a symptom (what the developer sees), a root cause (why it happens), and a resolution (what to do). Symptom-only entries are not complete. Each troubleshooting entry should be independently understandable without reading sibling entries. Format each entry as the symptom stated as the heading, followed by a bolded `**Root Cause(s)**` label and a bolded `**Resolution**` label, in that order. Write `**Root Cause(s)**` as a single sentence when there is one cause, or as a bullet list when there are several genuinely distinct causes. Write `**Resolution**` as a single sentence or step when there is one fix, or as a numbered list when the fix involves multiple steps.

**Limitations**
An optional section, placed after Troubleshooting and before Next Steps, listing what the tool does not detect, cover, or restore. Applies to any doc describing a scanning, validation, or detection tool. Omit if the tool has no known coverage gaps.

**Next Steps**
A bullet list of links to related docs. Each link must include a one-sentence description of what the linked doc covers and why the developer might need it. No bare links.

**Type Mapping Reference** (migration guides only)
A table placed immediately after Prerequisites. Columns: Area, Old API (with version label), New API (with version label). Each row covers one renamed or replaced type, method, attribute, or exception. The table is the single source of truth for API renames. Do not repeat individual renames in the Main Content sections. Refer back to this table instead.

**Pre-Upgrade Checklist** (migration guides only)
An ordered list placed immediately before Next Steps. Each item is a discrete, actionable task (search for a type, replace a call, run tests). Each item links to the subsection in the doc where the full change is explained. The checklist covers every change in the doc and nothing more. Its purpose is to let a developer verify completeness, not to replace the Main Content sections.

---

## B1: Audit Checklist

Work through these in order. Stop at the first "No" and fix it before continuing. Each item is a yes-or-no test.

1. **Section order**: Does the doc lead with setup or action before theory? (Do first, understand second)
2. **Heading accuracy**: Does each heading name accurately describe what the section contains, not what it aspires to contain?
3. **Cognitive grouping**: Are all items in each section genuinely the same type of thing? (Installation methods are not rendering approaches. Navigation hubs are not technical references.)
4. **Consequence before implementation**: Does every "you must do X" instruction explain what breaks without X before stating the rule?
5. **Scannability**: Is any prose block that could be a table or bullet list already a table or bullet list?
6. **Terminology consistency**: Is each key term defined once on first use and abbreviated consistently thereafter?
7. **Code vs prose**: Are implementation guards, conditional flags, and required configuration values shown as code rather than described in sentences?
8. **Cross-references**: Has every outbound callout (Additional Resource, See also, Note) been classified as required (inline summary), optional (end of section or Next Steps), or redundant (remove)?
9. **Duplication**: If two sections are near-identical, does the second reference the first rather than repeating it?
10. **Tone**: Is there any casual language, Q&A-style headers, or marketing phrasing?
11. **Consequence coverage**: Does the reader know what happens if they skip or misapply each required step?

---

## B2: Anti-Pattern Table

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Understand first, do second (Understand → Understand → Do) | Developer cannot act until they have read everything. Creates drop-off before the setup section. | Move setup and action first. Theory comes after a working setup exists. |
| Aspirational heading that does not match content ("Minimal Setup" containing full setup) | Developer expects one thing and finds another. Erodes trust in the doc. | Name the section by what it actually contains, not what you wish it contained. |
| Implementation rule stated before the consequence ("Pass X as Y, not Z, because...") | Developer follows the rule without understanding why. Cannot diagnose failures. | State what breaks first, then state the rule. |
| Outbound callout mid-flow ("Additional Resource: see X for details") | Interrupts reading. AI retrieval agents split context across doc boundaries unnecessarily. | Classify: required content gets an inline summary. Optional content moves to the end or Next Steps. Redundant content is removed. |
| Unlike things grouped as peers (CDN listed alongside SSR, CSR, SSG) | Creates false equivalence. Developer assumes CDN is a rendering strategy. | Move the unlike item to its own section. Add one sentence orienting the developer to why it is separate. |
| Near-identical sections with full content duplication | Maintenance debt. When one section changes, the other becomes stale silently. | The second section references the first. It adds only what is genuinely different. |
| Prose for implementation guards or conditions | Developer may miss a critical condition buried in a sentence. | Show the condition as code. |
| Bare cross-reference links without description | Reader does not know if the link is worth following. AI agents cannot prioritize retrieval. | Every link includes a one-sentence description of what it covers. |
| Casual or marketing phrasing in technical voice ("right away", "seamless", "instant feedback") | Undercuts authority. Inconsistent with professional documentation standards. | Rewrite with neutral, precise language. |

---

## Part C: Rules Reference

Every rule follows this format:

> **Rule:** The rule, stated in one sentence.
> **Why:** The rationale (what breaks without it, or what it enables).
> **Exception:** When the rule does not apply.

---

### C1: Structure and Flow

**Rule:** Order sections as Do → Understand → Debug. Setup comes before theory. Troubleshooting comes last.
**Why:** Developers act first. A developer who cannot get a working setup will not read the theory section.
**Exception:** Conceptual-only docs (no setup steps) where the entire doc is theory. In that case, flow from general to specific.

---

**Rule:** The Quick Decision Guide belongs before Prerequisites, not inside the Main Content section.
**Why:** Developers need to orient themselves (which path applies to them) before they read what is required to start. A decision guide inside Main Content is discovered too late.
**Exception:** If the doc covers a single path with no branching, omit the Quick Decision Guide entirely.

---

**Rule:** Theory sections belong after the working setup, never before it.
**Why:** Theory without context is harder to retain. A developer who has just completed setup reads theory to understand what they built.
**Exception:** A one-sentence orientation in the Overview is acceptable before setup if it prevents a common misunderstanding.

---

**Rule:** When a Theory Section's depth overlaps with what a dedicated Conceptual Guide would cover (engine or algorithm internals, multi-step mechanism walkthroughs, complexity analysis), keep only a short summary inline and link out to a Conceptual Guide for the full explanation.
**Why:** A Feature Doc or command doc exists to help a developer act. A Theory Section that expands into full conceptual-guide depth buries the actionable reference under content that already has its own doc type, and risks drifting out of sync if the same concept is later documented in a Conceptual Guide too.
**Exception:** If no Conceptual Guide exists yet for the concept and creating one is disproportionate to the doc's needs, a fuller explanation may stay inline, but should still avoid step-by-step mechanism walkthroughs when a summary is enough.

---

**Rule:** Prerequisites must link to the resource that fulfills each requirement.
**Why:** A prerequisite that names a dependency without linking to it forces the developer to search before they can start.
**Exception:** Prerequisites that are environment facts ("you have Node installed") do not require links.

---

**Rule:** Troubleshooting entries require a root cause and a resolution, not just a symptom.
**Why:** A symptom-only entry tells the developer what is wrong but not why or how to fix it. It creates frustration rather than resolution.
**Exception:** None. Every troubleshooting entry must be complete.

---

**Rule:** Each link in Next Steps must include a one-sentence description of what the linked doc covers.
**Why:** Bare links do not help developers decide whether to follow them. Descriptions also give AI retrieval agents signal for context.
**Exception:** None. No bare links in Next Steps.

---

### C2: Scannability

**Rule:** Use tables instead of prose for comparisons, decision matrices, and option sets with two or more dimensions.
**Why:** Prose comparisons require the developer to hold multiple values in working memory simultaneously. Tables make the comparison visible.
**Exception:** If the comparison has only two items and one dimension, a short prose sentence is acceptable.

---

**Rule:** Use bullet lists instead of prose for sequences of conditions, requirements, or parallel items.
**Why:** Numbered or bulleted lists establish visual hierarchy. Prose buries parallel items and makes them harder to scan.
**Exception:** When items have significant narrative dependency (each item explains the previous one), prose is acceptable.

---

**Rule:** Use an ASCII diagram or flow diagram for data flows that involve three or more steps or two or more actors.
**Why:** A multi-step flow written in prose requires the developer to reconstruct the sequence mentally. A diagram makes the sequence visible at a glance.
**Exception:** Single-actor, two-step flows are acceptable in prose.

---

**Rule:** Section names in a Quick Reference table must link to the corresponding section using the relative doc URL and section anchor.
**Why:** A Quick Reference table without links forces the developer to scroll through the doc to find the referenced section. Links make the table immediately actionable.
**Exception:** None.

---

**Rule:** Callouts (ATTENTION, Required, Note) are reserved for high-stakes warnings: content that causes data loss, broken preview, or security issues if ignored. Do not use callouts for general information.
**Why:** Overused callouts lose their signal value. When everything is a callout, nothing is.
**Exception:** A single informational Note callout per section is acceptable if the information would otherwise be missed in a long prose block.

---

**Rule:** When a list of values is maintained externally (a live registry, an API response, or a build artifact), include a Note stating the authoritative source and any known constraints (such as a value that applies to one region only).
**Why:** A list copied from an external source becomes stale without notice. Readers who trust an incomplete or out-of-date list ship broken code. Citing the source gives the reader a path to the current truth. Special-case constraints discovered at read time prevent runtime errors that would otherwise appear only in troubleshooting.
**Exception:** If the doc already states explicitly that the list is illustrative and not exhaustive, and the authoritative source is linked inline, a separate Note is not required.

---

### C3: Language and Tone

**Rule:** No casual language in prose. Remove phrases such as "right away", "on its own", "you'll find", "pretty straightforward", "just".
**Why:** Casual language is inconsistent with professional documentation standards and undermines credibility.
**Exception:** None. Neutral, precise language applies throughout.

---

**Rule:** Do not narrate the doc or example instead of describing what the reader does. Remove phrases such as "this walks through", "this guide walks you through", "this section covers", "this shows you how". State the action or outcome directly instead.
**Why:** Narrating the document describes what the doc does rather than what the reader achieves, which is guide-centric phrasing. This rule is stated for the Overview section above, but the same phrasing is just as casual anywhere else in the doc, so it applies document-wide, not only to the Overview.
**Exception:** None.

---

**Rule:** No Q&A-style headers in body sections ("Why do I need X?", "What breaks?").
**Why:** Q&A headers feel like marketing copy or FAQ content. Body sections should read as direct technical exposition.
**Exception:** A dedicated FAQ or Common Questions section at the end of the doc may use question-form headers.

---

**Rule:** No marketing phrasing. Remove "seamless", "powerful", "instant feedback", "enhanced experience", and similar phrases.
**Why:** Marketing language does not convey technical information and signals that the doc was not written for developers.
**Exception:** None.

---

**Rule:** Use "for example" in instructional prose when the set shown is illustrative, not exhaustive. Do not use "all of the following" or "these are the only ways" unless the set has been verified as complete.
**Why:** "All of the following" implies the list is a complete reference, creating maintenance risk when new variants are added and misleading developers who assume nothing is missing.
**Exception:** When documenting a genuinely exhaustive set that has been verified against an authoritative source (such as an enum or a closed list of error codes), "the following" without a qualifier is acceptable.

---

**Rule:** No em dashes or semicolons in prose outside of code blocks. Use a period, a comma, or split the sentence instead.
**Why:** Em dashes and semicolons create grammatical ambiguity in machine-parsed content and are inconsistent in doc style.
**Exception:** Em dashes and semicolons inside code blocks follow code conventions and are not subject to this rule.

---

**Rule:** Define each key term once at first use using the full form ("server-side rendering (SSR)"). Use the abbreviation consistently thereafter.
**Why:** Inconsistent terminology forces the reader to re-map terms mentally throughout the doc. AI retrieval agents may treat the same concept as two different entities.
**Exception:** If the doc is very long and sections are intended to be read independently, redefine the term once per major section.

---

### C4: Code vs Prose

**Rule:** State the consequence before the implementation rule. ("Without X, Y breaks" before "Pass X as Z".)
**Why:** A developer who understands what breaks can diagnose failures. A developer who only knows the rule cannot.
**Exception:** When the consequence is obvious from context ("omitting the API key will prevent authentication"), a brief rule-first statement is acceptable.

---

**Rule:** Show implementation guards as code, not as prose.
**Why:** A guard buried in a sentence ("make sure you check for window before calling init") may be missed. A code block is unambiguous.
**Exception:** None. Guards, conditionals, and type checks are always shown as code.

---

**Rule:** Use parameterized placeholders (`<VARIABLE_NAME>` format) for user-supplied values in instructional code blocks. Reserve specific values for examples where the value itself is the point of the example.
**Why:** Specific values in instructional code imply either that the value should be copied literally or that it is the recommended default. Placeholders make the substitution requirement unambiguous. Specific values are appropriate only when demonstrating concrete behavior (alias resolution, error output, or region-matching rules) where the specific value is the teaching point.
**Exception:** Quick Reference tables and decision guide tables may use specific representative values to keep the table scannable.

---

**Rule:** Show required values, conditional flags, and SDK options in code rather than describing them in sentences.
**Why:** A sentence that says "set the ssr option to false" is less actionable than a code snippet that shows the option in context.
**Exception:** When introducing an option for the first time, a one-sentence prose definition before the code block is acceptable.

---

**Rule:** Error handling patterns (try-catch) must appear in all code examples that involve async operations or external calls.
**Why:** A code example without error handling is an implicit instruction to omit it. Developers copy examples as-is.
**Exception:** Inline code fragments that illustrate a single expression (not a complete function) do not require try-catch wrapping.

---

**Rule:** SDK error messages documented in troubleshooting entries must include three elements: what went wrong (the actual bad value or condition), what to do next (the corrective action), and where to find help (a link to the relevant section or external reference).
**Why:** A message that only names the error leaves the developer without a path to resolution. Including the bad value prevents confusion with similar errors. The corrective action and reference eliminate the need to context-switch to other docs or support channels.
**Exception:** Generic system errors (NullPointerException, OutOfMemoryError) that are not specific to the SDK do not require this format.

---

**Rule:** Each fenced code block must be one copy-pasteable unit. Do not combine multiple independent example commands into a single block, even when inline comments label each one.
**Why:** A reader who copies the whole block runs every command in it, including ones they did not intend to run. A comment inside the block explains what each line does, it does not stop the extra commands from executing.
**Exception:** A single logical command that wraps across multiple lines with a line continuation is one unit, not multiple. A cohesive script meant to run as a whole, with sequential steps that depend on each other (for example, generate a file, then open it), is also one unit and may include comments.

---

### C5: Cross-References

**Rule:** Classify every outbound callout as required (inline summary), optional (end of section or Next Steps), or redundant (remove).
**Why:** An unclassified "Additional Resource" callout interrupts reading flow without establishing whether the reader needs to act on it. AI retrieval agents treat all callouts as equal-priority signals.
**Exception:** None. Every callout must be classified before the doc is published.

---

**Rule:** Required cross-references include a brief inline summary of the critical fact so the developer does not have to switch docs to complete the current task.
**Why:** A link without a summary places a context-switching cost on the developer. The summary eliminates that cost for most readers.
**Exception:** If the referenced doc is extremely long and the relevant section is not easily summarized, provide the section anchor link and a one-sentence description of what to look for.

---

**Rule:** Optional cross-references are grouped at the end of the section or in Next Steps, not scattered mid-flow.
**Why:** Mid-flow optional links interrupt the primary task. Grouped optional links preserve flow and are still discoverable.
**Exception:** If an optional link directly follows a paragraph where it was mentioned in passing, a parenthetical "(see also: X)" is acceptable.

---

**Rule:** Remove cross-references that duplicate links already present in Prerequisites or Next Steps.
**Why:** A link that appears in three places does not add three times the value. It adds noise and suggests the content is fragmented.
**Exception:** A mandatory link in Prerequisites may be repeated as a reminder in a subsection if the doc is long and developers are likely to arrive directly at that subsection.

---

### C6: Content Accuracy and Grouping

**Rule:** Heading names describe the actual content of the section, not aspirational or intended content.
**Why:** A heading that overpromises ("Minimal Setup" for a full setup section) breaks the developer's trust the moment they see the mismatch.
**Exception:** None. Rename the heading or scope the section to match.

---

**Rule:** Items grouped in the same section must belong to the same category of thing.
**Why:** A developer scanning a section assumes its items are equivalent. Grouping unlike items (installation methods with rendering strategies) creates false equivalence and cognitive confusion.
**Exception:** None. Unlike items belong in their own sections, with orientation text explaining why they are separate.

---

**Rule:** If a section grows beyond its heading's scope, rename the section or split it.
**Why:** An overgrown section misleads developers about what they will find in it and makes the doc harder to navigate by heading.
**Exception:** None.

---

### C7: Duplication

**Rule:** When two sections are near-identical, the second section references the first and adds only what is genuinely different.
**Why:** Verbatim duplication creates maintenance debt. When one section changes, the other becomes stale silently and the developer receives contradictory information.
**Exception:** If sections are intended to be read in isolation (for example, as standalone printed guides), duplication may be acceptable with an explicit note that the sections mirror each other intentionally.

---

**Rule:** A fact stated in Prerequisites must not be restated mid-doc as a general reminder. One canonical location per fact.
**Why:** Multiple locations for the same fact create maintenance risk and signal to the developer that the author was not confident the fact was already covered.
**Exception:** A brief inline reminder is acceptable in a very long doc where developers are known to skip the Prerequisites section and arrive directly at a subsection.

---

**Rule:** If two implementation patterns share the same underlying setup, one section is the source of truth and the other is a pointer to it.
**Why:** Keeping two full copies of the same setup in sync across doc revisions is error-prone. A pointer ensures a single update propagates correctly.
**Exception:** If the patterns differ in more than two meaningful ways, they are not near-identical and should each have full independent content.

---

**Rule:** When a table already documents an item's required-ness, type, and default, a following prose or bullet expansion for that same item must add only what the table cannot show (behavioral nuance, side effects, cross-references), not restate the table's own cells.
**Why:** A reader who already read the table gains nothing from a bullet that repeats what the table's own columns already said. Restating table content lengthens the doc without adding information and doubles the maintenance surface for facts already established once.
**Exception:** A one-clause restatement is acceptable when it is needed to introduce the bullet's genuinely new content, avoiding an orphaned bullet with no lead-in.

---

### C8: Developer Tone

This section applies to all doc types. Its rules are more specific than C3 (Language and Tone) and take precedence where they overlap.

**Guiding principle:** Write what the system does, not how it feels to use it. A sentence is marketing language if removing it loses zero technical information.

---

**Rule:** Do not use empty superlatives: powerful, robust, comprehensive, seamless, effortless, best-in-class, world-class, industry-leading, cutting-edge, next-generation.
**Why:** These words describe a product's perceived quality, not its technical behavior. They add no information a developer can act on and signal that the sentence was not written for a technical audience.
**Exception:** None.

---

**Rule:** Do not make benefit promises that cannot be measured: "saves you time," "eliminates complexity," "just works," "in under 5 minutes," "in minutes."
**Why:** Unverifiable claims erode trust. Developers test claims by using the product and expect docs to be accurate.
**Exception:** A time claim is acceptable if it is literally measurable and verified (e.g., "runs in approximately 30 seconds on a standard laptop").

---

**Rule:** Do not use emotional unlock language to describe product benefits: unlock, empower, transform, revolutionize, supercharge, elevate.
**Why:** These verbs describe a feeling, not a technical outcome. Replace with the direct verb ("enables," "lets you") or a description of what the code does.
**Exception:** None in technical prose. Acceptable only in marketing materials that are explicitly not developer documentation.

---

**Rule:** Do not use vague readiness claims: production-ready, enterprise-grade, battle-tested, proven.
**Why:** These phrases claim a quality without specifying what it means. Replace with the concrete constraint or behavior: "enforced by CI," "requires explicit confirmation before any destructive operation."
**Exception:** None.

---

**Rule:** Do not use out-of-the-box language: "out of the box," "zero-config," "plug-and-play."
**Why:** These phrases hide the actual default behavior. Describe what the default is instead.
**Exception:** None.

---

**Rule:** Do not use vague AI or enterprise buzzwords: guardrails, agentic, mental model, single source of truth, end-to-end (as a filler qualifier), opinionated, zero-downtime, re-platform, golden path, leverage (meaning "use"), onboarding, paradigm.
**Why:** Each of these words sounds technical but names no specific behavior. They force the reader to infer meaning and are often wrong.
**How to fix each:**
- guardrails → name the specific restriction: "the skill refuses to print tokens," "the agent asks for confirmation before any DELETE"
- agentic → "running as an agent" or describe the actual behavior
- mental model → "how X works" or "the concepts behind X"
- single source of truth → "the canonical file is X" or "edited in one place"
- end-to-end (filler) → drop it, or name both ends: "from content migration to code rewrite"
- opinionated → state the actual default choices
- zero-downtime → describe the mechanism: "aliases switch with no request interruption"
- re-platform → "migrate," "move," or "switch"
- golden path → "the recommended approach" or describe the specific steps
- surface (as a verb) → "expose," "show," "return," or "log"
- leverage → "use," "call," or "apply"
- onboarding → "setup," "first install," or describe the specific step
- paradigm → name the specific concept
**Exception:** None.

---

**Rule:** Define acronyms on first use in introductory and setup sections. Do not require readers to know CDA, CMA, HMAC, OAuth, SSR, SSG, CSR, BFF, CDN, CI, CD, or SSO on first encounter.
**Why:** A reader who does not know an acronym must leave the doc to look it up. The first-use expansion eliminates that interruption.
**Exception:** In deep reference sections and advanced how-to guides written explicitly for senior engineers, acronyms that are industry-standard (OAuth, CI, CDN) may appear without expansion if the doc's stated audience already knows them.

---

### C9: CLI Command Documentation

**Rule:** State whether a CLI command mutates stack data or is read-only, in the Overview or Prerequisites, for any command that connects to a live stack.
**Why:** Developers using a scoped or shared management token need to know the blast radius before running an unfamiliar command.
**Exception:** Commands whose name unambiguously states the action (for example, `delete-entry`) may skip a standalone statement if the mutation is already obvious from the command name and flags.

---

**Rule:** Every Mandatory prerequisite that names a token must state the minimum required permission or scope inline (for example, "requires `Content Type: Read`"), not only as a Troubleshooting root cause.
**Why:** Surfacing the required scope only after a failure forces the developer to fail first, then debug, then retry. Stating it up front prevents the failure.
**Exception:** None.

---

**Rule:** If a newer version of the documented command or tool exists, state that in one sentence at the top of the Overview with a link to the newer version, in addition to any detailed comparison table elsewhere in the doc.
**Why:** A developer landing on a legacy version's page by search should not have to read the entire doc to discover that a newer version exists.
**Exception:** None for docs describing a superseded version. Docs for the current or only version do not need this.

---

**Rule:** State known coverage gaps (unverified edge cases, things out of scope) in a Limitations section rather than leaving them implicit.
**Why:** A developer who assumes complete coverage from silence will not think to double check the gap until something breaks in production.
**Exception:** Tools with no known coverage gaps can omit the section.

---

**Rule:** A Feature Doc documenting a superseded version must not carry a full old-to-new flag/parameter mapping table when an equivalent mapping already exists in the current version's doc or a dedicated Migration Guide. Keep only a short note plus a link to that mapping.
**Why:** A complete old-to-new mapping table is the "Type Mapping Reference" pattern reserved for Migration Guide docs (see Section Definitions and `migration-guide.md`). Duplicating it inside a Feature Doc creates two independently maintained copies of the same fact, and a Feature Doc is read by every visitor, not only the subset migrating between versions.
**Exception:** If no current-version doc or Migration Guide exists yet to link to, a short table may remain inline, positioned after Troubleshooting rather than before it, until that canonical destination exists.
