# Common Rules: All Doc Types

These rules apply to every doc type: conceptual guides, feature docs, how-to guides, setup guides, kickstarters, and migration guides. Doc-type-specific rules live in the per-type files alongside this one.

---

## Section Definitions

These definitions apply to every doc type. Per-type files specify which sections are required or optional for that type.

**Overview**
One to three sentences. Lead with the problem or limitation that brings the developer to this page, what breaks, what they cannot do, or what they are trying to avoid. Then state what the feature enables. Do not open with the API name or SDK class. Avoid guide-centric phrasing such as "this guide walks you through" or "this guide covers." Do not repeat the page title verbatim. Do not include setup steps, prerequisites, or background history.

For migration and upgrade docs, use this structure: state when the guide applies, explain what the change breaks, then state what the reader gets. Pattern: "Use this guide when you upgrade [product] from [version] to [version]. The new version [what changes], breaking [what breaks]. This guide shows [what the reader gains]."

**What You'll Learn**
A bullet list of outcomes, not topics. Each bullet starts with an action verb: Choose, Make, Set up, Prevent, Debug, Configure. Bullets must map to content that exists in the doc. Do not use noun phrases such as "SSR vs CSR" or "SDK behavior."

**Quick Decision Guide**
A table that appears before Prerequisites so developers orient themselves before reading requirements. Minimum columns: Approach, Key configuration value, Reason. Recommended addition: Framework examples column mapping each approach to known kickstarters or framework patterns. Use this section whenever the doc covers two or more paths that require different setup.

**Quick Reference**
A navigation table with three columns: Use Case, Section, and Key Call. Each row maps one developer intent to the section that addresses it and the primary API call involved. The Section column links to the corresponding section using the relative doc URL and section anchor. Place Quick Reference directly after the Overview with a one-line lead-in sentence. Use Quick Reference instead of What You'll Learn when the doc has many distinct sections and developers are likely to arrive with a specific task rather than reading top to bottom. Do not use both sections in the same doc. See C6 for the completeness requirement that governs which sections a Quick Reference table must cover.

**Prerequisites**
Two subsections:
- **Mandatory:** Items that must be true before the developer can start. Each item links to the resource that fulfills it.
- **Optional:** Items that improve the experience or unlock additional capability but do not block the core task.

Do not restate mandatory prerequisites elsewhere in the doc. One canonical location per fact.

**Main Content**
The primary working section. Contains setup steps, code examples, and configuration patterns. Organized into subsections by rendering approach, SDK type, or use case. Each subsection must be self-contained enough to act on without reading sibling subsections. Theory and background belong after this section, not inside it.

**Theory Sections**
Sections that explain how something works internally (data flows, event protocols, hash mechanics, SDK internals). These come after the developer has a working setup. They are optional but valuable for debugging and deep understanding.

**Troubleshooting**
Each entry requires three elements: a symptom (what the developer sees), a root cause (why it happens), and a resolution (what to do). Symptom-only entries are not complete. Each troubleshooting entry should be independently understandable without reading sibling entries.

**Next Steps**
A bullet list of links to related docs. Each link must include a one-sentence description of what the linked doc covers and why the developer might need it. No bare links.

**Type Mapping Reference** (migration guides only)
A table placed immediately after Prerequisites. Columns: Area, Old API (with version label), New API (with version label). Each row covers one renamed or replaced type, method, attribute, or exception. The table is the single source of truth for API renames. Do not repeat individual renames in the Main Content sections. Refer back to this table instead.

**Pre-Upgrade Checklist** (migration guides only)
An ordered list placed immediately before Next Steps. Each item is a discrete, actionable task (search for a type, replace a call, run tests). Each item links to the subsection in the doc where the full change is explained. The checklist covers every change in the doc and nothing more. Its purpose is to let a developer verify completeness, not to replace the Main Content sections.

---

## B1: Audit Checklist

Work through these in order. Stop at the first "No" and fix it before continuing. Each item is a yes-or-no test.

1. **Section order**. Does the doc lead with setup or action before theory? (Do first, understand second)
2. **Heading accuracy**. Does each heading name accurately describe what the section contains, not what it aspires to contain?
3. **What You'll Learn**. Are bullets outcome-focused (verbs), not topic-focused (nouns)?
4. **Cognitive grouping**. Are all items in each section genuinely the same type of thing? (Installation methods are not rendering approaches, and navigation hubs are not technical references)
5. **Consequence before implementation**. Does every "you must do X" instruction explain what breaks without X before stating the rule?
6. **Scannability**. Is any prose block that could be a table or bullet list already a table or bullet list?
7. **Terminology consistency**. Is each key term defined once on first use and abbreviated consistently thereafter?
8. **Code vs prose**. Are implementation guards, conditional flags, and required configuration values shown as code rather than described in sentences?
9. **Cross-references**. Has every outbound callout (Additional Resource, See also, Note) been classified as required (inline summary), optional (end of section or Next Steps), or redundant (remove)?
10. **Duplication**. If two sections are near-identical, does the second reference the first rather than repeating it?
11. **Tone**. Is there any casual language, Q&A-style headers, or marketing phrasing?
12. **Consequence coverage**. Does the reader know what happens if they skip or misapply each required step?
13. **Repeated in-doc links**. Does any single in-doc section anchor get linked more than once across the doc? Count the occurrences of each anchor and collapse duplicates to the one load-bearing occurrence.

---

## B2: Anti-Pattern Table

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Understand first, do second (Understand, Understand, Do) | Developer cannot act until they have read everything. Creates drop-off before the setup section. | Move setup and action first. Theory comes after a working setup exists. |
| Aspirational heading that does not match content ("Minimal Setup" containing full setup) | Developer expects one thing and finds another. Erodes trust in the doc. | Name the section by what it actually contains, not what you wish it contained. |
| Implementation rule stated before the consequence ("Pass X as Y, not Z, because...") | Developer follows the rule without understanding why. Cannot diagnose failures. | State what breaks first, then state the rule. |
| Topic-focused What You'll Learn bullets ("SSR vs CSR", "Hash behavior") | Developer cannot predict whether the doc solves their problem. | Rewrite with outcome verbs: Choose, Make, Prevent, Debug. |
| Outbound callout mid-flow ("Additional Resource: see X for details") | Interrupts reading. AI retrieval agents split context across doc boundaries unnecessarily. | Classify: required content gets an inline summary, optional content moves to the end or Next Steps, and redundant content is removed. |
| Unlike things grouped as peers (CDN listed alongside SSR, CSR, SSG) | Creates false equivalence. Developer assumes CDN is a rendering strategy. | Move the unlike item to its own section. Add one sentence orienting the developer to why it is separate. |
| Near-identical sections with full content duplication | Maintenance debt. When one section changes, the other becomes stale silently. | The second section references the first. It adds only what is genuinely different. |
| Prose for implementation guards or conditions | Developer may miss a critical condition buried in a sentence. | Show the condition as code. |
| Bare cross-reference links without description | Reader does not know if the link is worth following. AI agents cannot prioritize retrieval. | Every link includes a one-sentence description of what it covers. |
| Casual or marketing phrasing in technical voice ("right away", "seamless", "instant feedback") | Undercuts authority. Inconsistent with professional documentation standards. | Rewrite with neutral, precise language. |

---

## Part C. Rules Reference

Every rule follows this format:

> **Rule:** The rule, stated in one sentence.
> **Why:** The rationale, what breaks without it, or what it enables.
> **Exception:** When the rule does not apply.

---

### C1: Structure and Flow

**Rule:** Order sections as Do, then Understand, then Debug. Setup comes before theory. Troubleshooting comes last.
**Why:** Developers act first. A developer who cannot get a working setup will not read the theory section.
**Exception:** Conceptual-only docs (no setup steps) where the entire doc is theory. In that case, flow from general to specific.

---

**Rule:** The Quick Decision Guide belongs before Prerequisites, not inside the Main Content section.
**Why:** Developers need to orient themselves (which path applies to them) before they read what is required to start. A decision guide inside Main Content is discovered too late.
**Exception:** If the doc covers a single path with no branching, omit the Quick Decision Guide entirely.

---

**Rule:** When a feature is optional rather than universally required, the Overview must state the condition under which the reader does not need it, not only the condition under which they do.
**Why:** A reader who cannot tell whether a feature applies to them wastes time reading it in full, or implements it unnecessarily.
**Exception:** Features that are mandatory for all users of the parent SDK, where no valid skip condition exists.

---

**Rule:** Theory sections belong after the working setup, never before it.
**Why:** Theory without context is harder to retain. A developer who has just completed setup reads theory to understand what they built.
**Exception:** A one-sentence orientation in the Overview is acceptable before setup if it prevents a common misunderstanding.

---

**Rule:** Document only the main workflow in the primary flow of the doc. Any sub-workflow (a secondary process the reader only needs occasionally, such as a manual refresh script, cache internals, or a background maintenance task) belongs either in a consolidated section at the end of the doc or in a separate doc, depending on its size and how independently it needs to be discovered.
**Why:** A doc that interleaves the main workflow with secondary sub-workflows forces every reader to scroll past content most of them don't need, obscuring the primary task and increasing perceived complexity.
**Exception:** Does not apply to docs whose stated purpose is itself a sub-workflow or internals/architecture reference.

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

**Rule:** Do not use a heading level (H3) for a subsection when it is the only subsection under its parent heading (H2). Demote a lone H3 to a bold inline heading.
**Why:** A single subheading creates false hierarchy. It implies sibling subsections exist and adds navigation weight without a scannability benefit. Bold inline headings preserve visual separation without the overhead of a heading level.
**Exception:** If the subsection will be linked to directly from a Quick Reference or cross-reference table, a real heading is required so the anchor target exists.

---

**Rule:** Use bullet lists instead of prose for sequences of conditions, requirements, or parallel items.
**Why:** Numbered or bulleted lists establish visual hierarchy. Prose buries parallel items and makes them harder to scan.
**Exception:** When items have significant narrative dependency (each item explains the previous one), prose is acceptable.

---

**Rule:** Use an ASCII diagram or flow diagram for data flows that involve three or more steps or two or more actors.
**Why:** A multi-step flow written in prose requires the developer to reconstruct the sequence mentally. A diagram makes the sequence visible at a glance.
**Exception:** Single-actor, two-step flows are acceptable in prose.

---

**Rule:** What You'll Learn is always a bullet list. Never prose.
**Why:** Developers scan this section to decide if the doc is worth reading. A prose paragraph slows that decision.
**Exception:** None.

---

**Rule:** Section names in a Quick Reference table must link to the corresponding section using the relative doc URL and section anchor.
**Why:** A Quick Reference table without links forces the developer to scroll through the doc to find the referenced section. Links make the table immediately actionable.
**Exception:** None.

---

**Rule:** Callouts (ATTENTION, Required, Note) are reserved for high-stakes warnings, content that causes data loss, broken preview, or security issues if ignored. Do not use callouts for general information.
**Why:** Overused callouts lose their signal value. When everything is a callout, nothing is.
**Exception:** A single informational Note callout per section is acceptable if the information would otherwise be missed in a long prose block. In migration guides, a Note callout is also acceptable in the Overview when a single change requires significantly more effort than all others and that effort gap affects planning.

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

**Rule:** No Q&A-style headers in body sections ("Why do I need X?", "What breaks?").
**Why:** Q&A headers feel like marketing copy or FAQ content. Body sections should read as direct technical exposition.
**Exception:** A dedicated FAQ or Common Questions section at the end of the doc may use question-form headers.

---

**Rule:** No marketing phrasing. Remove "seamless", "powerful", "instant feedback", "enhanced experience", and similar phrases.
**Why:** Marketing language does not convey technical information and signals that the doc was not written for developers.
**Exception:** None.

---

**Rule:** Write for a developer audience. Use precise technical language, state outcomes in terms of system behavior, and assume the reader can read code. Do not explain what a developer is expected to already know, and do not soften technical facts with reassuring language.
**Why:** Documentation written at the wrong level wastes a developer's time, either by over-explaining basics or by burying technical detail in accessible prose. Developers trust docs that treat them as technical peers.
**Exception:** Onboarding or getting-started docs that explicitly target developers new to a specific domain may include one-sentence orientation statements for concepts outside that domain. Do not use this exception to justify general simplification.

---

**Rule:** Use "for example" in instructional prose when the set shown is illustrative, not exhaustive. Do not use "all of the following" or "these are the only ways" unless the set has been verified as complete.
**Why:** "All of the following" implies the list is a complete reference, creating maintenance risk when new variants are added and misleading developers who assume nothing is missing.
**Exception:** When documenting a genuinely exhaustive set that has been verified against an authoritative source (such as an enum or a closed list of error codes), "the following" without a qualifier is acceptable.

---

**Rule:** No em dashes, en dashes, or semicolons in prose or table cells outside of code blocks. Use a period, a comma, parentheses, or a colon instead.
**Why:** Em dashes and semicolons create grammatical ambiguity in machine-parsed content and are inconsistent in doc style.
**Exception:** Em dashes and semicolons inside code blocks follow code conventions and are not subject to this rule.

---

**Rule:** Define each key term once at first use using the full form ("server-side rendering (SSR)"). Use the abbreviation consistently thereafter.
**Why:** Inconsistent terminology forces the reader to re-map terms mentally throughout the doc. AI retrieval agents may treat the same concept as two different entities.
**Exception:** If the doc is very long and sections are intended to be read independently, redefine the term once per major section.

---

**Rule:** A concept used procedurally in an early section (for example, constants and string aliases being interchangeable) must be explained briefly at its first point of use, with a link to the full explanation, not deferred entirely to a later theory section.
**Why:** A reader following an early code example who hits unexplained interchangeable syntax has no way to know it is intentional until they stumble onto a later section, if they read that far at all.
**Exception:** If the early usage is a single self-evident example with no visible alternative form, a deferred explanation is acceptable.

---

**Rule:** Do not describe an optional feature as "not applicable" to readers who do not strictly need it. State that using the feature is optional, and name the benefit it still offers those readers.
**Why:** "Not applicable" reads as a hard exclusion and causes readers who could still benefit (for example, avoiding hardcoded values) to skip the section entirely.
**Exception:** None.

---

**Rule:** Write in active voice. Use passive voice only when the actor is genuinely unknown or irrelevant to the point being made.
**Why:** Active voice states who does what, which is faster to parse and removes ambiguity about what triggers a given behavior.
**Exception:** Passive voice is acceptable when describing a state with no relevant actor, for example "the file is deleted after 24 hours" when the deleting process is not the point.

---

**Rule:** Address the reader directly as "you". Avoid third person phrasing ("the developer", "the user") except in section headings or API behavior descriptions where no address is needed.
**Why:** Second person keeps instructional prose direct and consistent with how the rest of the corpus is already written.
**Exception:** Third person is acceptable when describing what the SDK or a third party system does, not what the reader does.

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
**Why:** Specific values in instructional code imply either that the value should be copied literally or that it is the recommended default. Placeholders make the substitution requirement unambiguous. Specific values are appropriate only when demonstrating concrete behavior (alias resolution, error output, or region-matching rules), where the specific value is the teaching point.
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

**Rule:** Do not annotate code block comments with step labels such as `// Step 1`, `// 1.`, or `// Step 2`. If steps need to be communicated, use a numbered list in prose above the code block.
**Why:** Step labels in code comments imply a sequential reading order and make the block feel like part of a larger sequence. They become stale when code is reordered and add no information a reader cannot infer from the code itself.
**Exception:** None.

---

**Rule:** SDK error messages documented in troubleshooting entries must include three elements: what went wrong (the actual bad value or condition), what to do next (the corrective action), and where to find help (a link to the relevant section or external reference).
**Why:** A message that only names the error leaves the developer without a path to resolution. Including the bad value prevents confusion with similar errors. The corrective action and reference eliminate the need to context-switch to other docs or support channels.
**Exception:** Generic system errors (NullPointerException, OutOfMemoryError) that are not specific to the SDK do not require this format.

---

**Rule:** For each parameter demonstrated in example code, document what happens when it receives null or an empty value, either inline or in Troubleshooting.
**Why:** Null or empty inputs from upstream config or user data are common in production. Undocumented behavior here is a frequent source of incidents, and the behavior often differs from what a developer would guess.
**Exception:** Parameters whose type system makes null unrepresentable and where the language's own type-mismatch error is the obvious, unsurprising outcome.

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

**Rule:** Remove cross-references that duplicate links already present in Prerequisites or Next Steps. When a fact or concept is documented in more than one section, point to exactly one canonical section rather than multiple candidate sections.
**Why:** A link that appears in three places does not add three times the value. It adds noise, and pointing to several sections for the same concept forces the reader to guess which one is authoritative.
**Exception:** A mandatory link in Prerequisites may be repeated as a reminder in a subsection if the doc is long and developers are likely to arrive directly at that subsection.

---

**Rule:** A link to another section of the same doc appears only where the reader cannot proceed without it, at most once per section that needs it. Do not link a section that is adjacent or already visible, and do not repeat the same in-doc link across nearby sections.
**Why:** Repeated links to the same nearby section add noise, imply the target is farther or more optional than it is, and fragment reading flow. The other C5 rules address cross-doc callouts, not repeated in-doc section links.
**Exception:** A long doc where readers commonly deep-link into a subsection may repeat one critical in-doc link as a reminder.

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

**Rule:** Every bullet in What You'll Learn must map to content that exists in the doc.
**Why:** A What You'll Learn bullet that has no corresponding content is a broken promise.
**Exception:** None. Remove bullets that do not have corresponding content, or add the missing content.

---

**Rule:** A Quick Reference table must include a row for every major section in the doc, not only common task sections. If it intentionally covers a subset, name it accordingly (for example "Common Tasks") instead of "Quick Reference." The table may split its rows into labeled groups (for example "Common tasks" and "Advanced or maintenance") to reduce cognitive load, as long as every major section still has a row.
**Why:** A table titled "Quick Reference" that omits major sections (Troubleshooting, Supported Regions) implies the doc has no more to offer than what is listed, and readers miss content that exists. Grouping the rows keeps the table complete while separating everyday tasks from advanced ones.
**Exception:** None.

---

**Rule:** Claims in the Overview about automatic behavior must match what later sections describe. If a behavior requires a manual action (a refresh call, a restart, a rebuild) to take effect, the Overview must not imply it happens without one.
**Why:** A reader who trusts the Overview's claim of automatic behavior ships code that silently serves stale data until they discover the manual step buried in a later section.
**Exception:** None.

---

**Rule:** When a Troubleshooting section has enough entries that a reader must scan to find the relevant one, group the entries into labeled subsections by category. Pick whatever grouping best fits the entries present (for example configuration errors, deployment and packaging, cache and staleness). Keep every entry on the page.
**Why:** A flat list of many unrelated entries forces the reader to read all of them to find their symptom. Category grouping lets a reader jump to the class of problem they see, and keeps environment-specific edge cases from crowding the errors every reader hits.
**Exception:** A Troubleshooting section with only a few entries does not need subsections.

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
**Exception:** A time claim is acceptable if it is literally measurable and verified (for example, "runs in approximately 30 seconds on a standard laptop").

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
- guardrails: name the specific restriction, for example "the skill refuses to print tokens" or "the agent asks for confirmation before any DELETE"
- agentic: "running as an agent" or describe the actual behavior
- mental model: "how X works" or "the concepts behind X"
- single source of truth: "the canonical file is X" or "edited in one place"
- end-to-end (filler): drop it, or name both ends, for example "from content migration to code rewrite"
- opinionated: state the actual default choices
- zero-downtime: describe the mechanism, for example "aliases switch with no request interruption"
- re-platform: "migrate," "move," or "switch"
- golden path: "the recommended approach" or describe the specific steps
- surface (as a verb): "expose," "show," "return," or "log"
- leverage: "use," "call," or "apply"
- onboarding: "setup," "first install," or describe the specific step
- paradigm: name the specific concept
**Exception:** None.

---

**Rule:** Define acronyms on first use in introductory and setup sections. Do not require readers to know CDA, CMA, HMAC, OAuth, SSR, SSG, CSR, BFF, CDN, CI, CD, or SSO on first encounter.
**Why:** A reader who does not know an acronym must leave the doc to look it up. The first-use expansion eliminates that interruption.
**Exception:** In deep reference sections and advanced how-to guides written explicitly for senior engineers, acronyms that are industry-standard (OAuth, CI, CDN) may appear without expansion if the doc's stated audience already knows them.

---

### C9: API Reference Completeness

These rules apply to any API backed by shared state, network I/O, or a versioned release history, most commonly SDK reference sections and their surrounding theory/advanced sections.

---

**Rule:** When an API is backed by shared, process-wide, or class-level mutable state (a static cache, a memoized variable, a singleton), the doc must state whether that state is safe under concurrent access in the runtime's normal execution model, naming the mechanism if one exists (a lock, a synchronized method, a mutex) or stating plainly that none does.
**Why:** Developers running the SDK in multi-threaded or multi-worker environments need to know before a race condition surfaces in production. Developers in single-threaded or per-request runtimes need to know the concern doesn't apply so they don't waste time investigating it.
**Exception:** Runtimes where the concept does not meaningfully apply (for example, a strict process-per-request execution model with no shared state across requests) may state this in one sentence instead of a full concurrency analysis.

---

**Rule:** Document any network operation's timeout behavior, proxy support, and the exact host(s) that must be reachable, for firewall or allowlist purposes.
**Why:** Production and enterprise deployments commonly run behind proxies and restrictive firewalls. Without this, a network failure surfaces as a mysterious runtime error instead of a known, documented constraint.
**Exception:** None for SDKs that perform network I/O as part of normal operation.

---

**Rule:** When documenting an API introduced after a package's initial release, state the minimum package version required in Prerequisites.
**Why:** A developer on an older, already-installed version has no way to know the API they are reading about does not exist yet in their dependency, and will file a confusing bug report or give up.
**Exception:** Docs for a package's very first release, where every documented API is available in every supported version.

---

**Rule:** When an API's data is backed by a cache that does not auto-refresh, Troubleshooting must include an entry for the stale-data symptom, naming the exact resolution action for that SDK (a refresh call, a restart, a rebuild command).
**Why:** Stale-cache confusion is the single most common support question for any cached registry. Omitting it from Troubleshooting guarantees it surfaces as a support ticket instead.
**Exception:** None for any API with cache behavior that lacks automatic invalidation.

---

**Rule:** When normal SDK operation reads or writes a local file (a cache, a downloaded registry), the doc must state the behavior in read-only or ephemeral filesystem environments (containers, CI/CD runners, serverless functions) and the recommended mitigation.
**Why:** A write that succeeds in local development can fail silently or throw in a container with a read-only root filesystem, and the developer has no documented path to a fix.
**Exception:** SDKs that perform no local file I/O as part of normal operation.

---

**Rule:** A how-to or feature doc shows only the parameters a reader needs to complete the task, with a link to the canonical API reference for the full contract. It does not restate the complete parameter table that the API reference already owns.
**Why:** Two full copies of a parameter contract drift apart. The API reference is the canonical source, and duplicating it in a task doc creates silent staleness.
**Exception:** A parameter whose behavior is the teaching point of the section (for example `omit_https`, or null and empty handling) is shown in full where it is taught.

---

**Rule:** A public-facing doc documents only the public API and the behavior a reader can observe. It must not present a private or internal symbol as a user-facing API or as a recommended action. Treat a symbol as internal if any of these hold: (a) its name starts with an underscore (`_regions_data`), (b) its docstring or a code comment says "internal", "private", "testing only", or "do not use" (`reset_cache()`), (c) it is absent from the package public export list (`__all__`), or (d) it is build or packaging tooling (a `setup.py` command such as `BuildPyWithRegions`).
**How to apply:**
- Describe the observable behavior in prose instead of naming the internal symbol.
- Never instruct a reader to call a testing-only or private symbol as a production step. Route them to the public equivalent (a public refresh function, a process restart, a rebuild).
- If an internal symbol must be named for debugging accuracy, name it once and mark it inline as "(internal, not part of the public API, subject to change)".
**Why:** Naming an internal symbol in a public doc invites readers to build against it, and their code breaks when it changes. Presenting a testing-only method as a fix makes readers ship test scaffolding into production.
**Exception:** Reference docs whose stated purpose is SDK internals or contributor guidance may document internal symbols, clearly scoped as such.

---

**Rule:** A Theory or Advanced section documents observable behavior and the public API, not private symbols. Any internal name that must remain in the section carries a scoped disclaimer stating it is an implementation detail, subject to change, and not part of the public API contract, while naming the supported public API alongside it.
**Why:** Readers treat anything in the doc as supported unless told otherwise. An unscoped disclaimer either warns readers off genuinely public APIs or fails to warn them off internal ones.
**Exception:** Dedicated internals or contributor-reference docs.
