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
Each entry requires three elements: a symptom (what the developer sees), a root cause (why it happens), and a resolution (what to do). Symptom-only entries are not complete. Each troubleshooting entry should be independently understandable without reading sibling entries. Format each entry as the symptom stated as the heading, followed by a bolded `**Root Cause**` or `**Root Causes**` label and a bolded `**Resolution**` label, in that order. Use `**Root Cause**` (singular) with a single sentence when there is one cause. Use `**Root Causes**` (plural) with a bullet list when there are several genuinely distinct causes. Write `**Resolution**` as a single sentence or step when there is one fix, or as a numbered list when the fix involves multiple steps.

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

**Rule:** Label the root-cause element `**Root Cause**` (singular) when there is exactly one cause, or `**Root Causes**` (plural) with a bulleted list when there are several genuinely distinct causes.
**Why:** A plural label over a single sentence implies causes the reader has not been told about. A singular label over a list that actually covers multiple independent triggers hides that there is more than one thing to check.
**Exception:** None.

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

**Rule:** When a bolded lead-in label (e.g., `**One method, two endpoints.**`) introduces more than one distinct fact, or a condition with multiple branches, format the content as a bullet list under that label, nesting sub-bullets for each branch, rather than one prose paragraph.
**Why:** A paragraph that bundles a condition together with its outcomes ("with no filter chained it does X, with any filter chained it does Y") forces the reader to reread to map each outcome to its trigger. Nested bullets make each branch and its outcome visible without rereading.
**Exception:** When the label introduces a single fact with no sub-parts or branches, one prose sentence is correct. Do not force a one-fact note into a list.

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

**Rule:** The only valid callout labels are `Warning`, `Note`, `Tip`, and `Additional Resources`. Do not invent other labels such as `Important`, `Attention`, or `Caution`.
**Why:** A fixed, small set of labels lets readers learn what each one means and react consistently. Ad hoc labels dilute that signal and read as informal.
**Exception:** None. Map the intended severity onto the closest existing label instead of adding a new one (a caveat the reader must not miss is `Warning`, not `Important`).

---

**Rule:** When a list of values is maintained externally (a live registry, an API response, or a build artifact), include a Note stating the authoritative source and any known constraints (such as a value that applies to one region only).
**Why:** A list copied from an external source becomes stale without notice. Readers who trust an incomplete or out-of-date list ship broken code. Citing the source gives the reader a path to the current truth. Special-case constraints discovered at read time prevent runtime errors that would otherwise appear only in troubleshooting.
**Exception:** If the doc already states explicitly that the list is illustrative and not exhaustive, and the authoritative source is linked inline, a separate Note is not required.

---

**Rule:** A heading is at most 4 words. Count the words in the heading text, treating an inline-code span as one word and a hyphenated compound as one word.
**Why:** A reader scans headings to find their place in a page. A heading that runs to a full sentence stops working as a label and becomes prose, so the reader has to read it rather than scan it, and a table of contents built from such headings is unusable.
**Exception:** A heading that reproduces product output verbatim, so that a reader searching the error text lands on the section that resolves it, may exceed 4 words. This covers only text the product itself emits. A heading that describes a symptom in the author's own words is not product output and is not exempt.

---

**Rule:** A heading is a complete phrase. Do not open a heading with a lowercase verb or a conjunction that depends on a subject the heading does not name.
**Why:** A fragment such as "uses a secure HTTP trigger, which is not supported yet" reads as the tail of a sentence whose subject is missing, so a reader arriving from a search result or a table of contents cannot tell what the section covers.
**Exception:** A heading may open in lowercase when the first word is itself a lowercase identifier, such as a package name or an error code. Otherwise name the subject, or reproduce the product's message in full under the verbatim-product-output exception above.

---

**Rule:** Consecutive body paragraphs under one heading read as one argument or as labelled standalone facts. When the paragraphs build on each other, open each with the subordinating connective that carries the logic ("Because", "When", "Only", "Since", "Unless"). When they cover separate sub-topics, give each a bolded lead-in label. Do not leave a run of three or more paragraphs that each open with a bare subject or a bare demonstrative and signal no relation to the paragraph above, and do not strand a one-sentence paragraph between two longer ones.
**Why:** A reader treats a section as one answer to one question. Paragraphs that each resolve backward, with nothing pointing forward, force the reader to reconstruct a connection the writer already knew, and a reader who cannot tell whether paragraph three continues paragraph two or starts a new topic rereads both. A one-sentence paragraph stranded between two longer ones reads as an afterthought the writer could not place.
**Exception:** Two short paragraphs where the second plainly continues the first need neither a label nor a connective. A procedure whose paragraphs are numbered steps carries its own sequence. A single backward demonstrative resolving the paragraph immediately above is correct and is governed by C3-24, not by this rule.

**How to judge a borderline case:** ask whether the paragraphs answer one question or several. Several means bolded lead-ins, because the reader arrives at each fact separately. One means connectives, because the reader needs the logic and a label would freeze the break in the wrong place. The permitted connectives are subordinating conjunctions that carry logic. The conversational discourse markers C3-15 bans ("That said", "either way", "One caveat:", "When in doubt:") are still banned here, and reaching for one is a sign the paragraph order is wrong rather than the opener.

**Rule:** A callout must use one of exactly four labels: Warning, Note, Tip, or Additional Resource.
**Why:** An open-ended label set forces every reader to guess what a given label implies about severity.
**Exception:** None.

---

**Rule:** Do not merge a stated fact, a conditional exception, an inline command reference, and a location fact into one paragraph, split each by kind into a labeled statement, table, or code block.
**Why:** A paragraph blending several kinds of information forces the reader to parse prose to extract a fact they came to scan for.
**Exception:** A short paragraph with only one or two kinds mixed, under roughly 40 words, does not need splitting.

**Rule:** A stated count must match the structure it counts. "Eight deliverables", "the four steps below" and a heading that says "(13)" each have to agree with the list, table or heading run that follows.
**Why:** A reader who trusts the number stops looking when they reach it. "Eight deliverables are mandatory" over a list of seven does more damage than saying nothing, because the reader never learns what the eighth was and has no reason to suspect one is missing. The count and the list drift the first time somebody edits one of them, and no round-trip or stability check can see it.
**Exception:** A count that refers to the world rather than to this page is out of scope: "Studio runs in seven regions" is a fact about Contentstack, not a claim about the list beneath it. The pointing word ("below", "following", "these") is what brings a count into scope. A count over a list whose items are alternatives rather than members is also out of scope.

---

**Rule:** A link label names its destination. It does not describe the act of following the link ("here", "read more"), and it does not promise a page other than the one it resolves to.
**Why:** A label that resolves but misdescribes costs a reader more than a 404 does, because a 404 says something is wrong and a wrong page does not. A screen reader user tabbing between links hears only the labels, so "here, here, this page" gives them no way to choose. The same rule catches a label a bulk edit has broken into fragments, which is how 20 links shipped after a punctuation pass moved a bracket across a label boundary.
**Exception:** A label may use different words for the same thing: "Slot props" over a page titled "Data-carrying slots" names the concept while the title names the shape, and both are right. A product noun used mid-sentence is not an opaque label: "a multi-type [Reference](...) field" gets its subject from the sentence.

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

**Rule:** Write one idea per sentence. Cut hedging qualifiers and redundant justification clauses, such as "in practice", "which means", "rather than letting X decide", or stacking two "because/so" clauses in one sentence.
**Why:** A sentence carrying two justifications forces the reader to hold both in mind before either one lands. Developers scan for the fact, not the reasoning path that produced it.
**Exception:** A single subordinate clause that states the direct cause of the preceding fact is fine. The rule targets stacked or redundant justification, not all subordinate clauses.

---

**Rule:** Define each key term once at first use using the full form ("server-side rendering (SSR)"). Use the abbreviation consistently thereafter.
**Why:** Inconsistent terminology forces the reader to re-map terms mentally throughout the doc. AI retrieval agents may treat the same concept as two different entities.
**Exception:** If the doc is very long and sections are intended to be read independently, redefine the term once per major section.

---

**Rule:** No figurative or spatial metaphors for technical mechanisms (tree-walking, family relationships, container-unwrapping, path-crossing language). Remove phrases such as "walks the tree", "grandparent locale", "unwrapped", "pass over". Describe the actual mechanism directly instead.
**Why:** A metaphor reads smoothly but forces the reader to reverse-engineer what actually happens. Reusing the same metaphor for two different operations (for example "walk" meaning both tree traversal and list pagination) is actively confusing.
**Exception:** Domain-standard structural vocabulary is not a metaphor and is exempt, for example "ancestor", "descendant", "parent", or "child" when naming an actual data-model relationship (taxonomy terms, entry references). Flag the term only when it stands in for an operation instead of naming a real relationship.

---

**Rule:** Name a concept directly instead of describing what it does in roundabout language, when a concise technical term for it is already established elsewhere in this doc set. Replace phrases such as "read in pages", "returned in pages", or "a long list retrieved across pages" with "paginate" or "for pagination".
**Why:** A roundabout description reads fine on its own but wastes words restating what a single established term already conveys, and it makes the doc set inconsistent about how it refers to the same concept. A reader searching for "pagination" will not find the page that spells it out longhand.
**Exception:** A roundabout description is fine if no shorter direct term for the concept exists yet anywhere in this doc set. Introducing the concise term is then the better fix, so define it once and use it from there on.

---

**Rule:** Write a numeric error code or HTTP status code as inline code (`429`), never as bare prose (429).
**Why:** A bare number reads as a quantity, not an identifier. Inline code marks it as a literal value the reader compares against, matching how the same code appears in a request or response body.
**Exception:** A written-out description of a status class ("a client error", "a server error") is prose and is not affected.

---

**Rule:** Do not embed a lowercase "how many" or "how much" indirect question mid-sentence, such as "depth limits how many levels the response covers". State the count directly instead, for example "depth limits the number of levels the response covers".
**Why:** An embedded question turns a declarative technical sentence into something that reads like a spoken aside, and the same fact states directly without it.
**Exception:** A capitalized "How many"/"How much" starting a standalone phrase, such as a parameter table cell description ("How many levels above the term to traverse."), is a different, accepted convention and is not affected.

---

**Rule:** Bold a spelled-out retry or attempt count stated in prose, for example "retries automatically, up to **five attempts**".
**Why:** A retry limit is a fact a developer scans the page for. Bold marks it the same way the Default column marks a value, and a spelled-out number carries no other visual signal the way a bare digit does.
**Exception:** None. This targets the specific retry/attempt-count convention, not every number that appears in prose.

---

**Rule:** No passive-voice constructions (auxiliary plus past participle, modal plus be plus participle, get-passives, or by-agent passives) where naming the actor directly would be clearer. Remove or rewrite phrases such as "is chained", "are stored", "can be tagged with", "gets validated", "is sent by find".
**Why:** Passive voice hides who or what performs an action, forcing the reader to infer the actor. Active voice states the mechanism directly.
**Exception:** Predicate adjectives describing a state, not an action, are not passive voice and are exempt, for example "is unchanged", "is unlocalized", "is based on", "is located at". Ambiguous config-state phrasing such as "is enabled" or "is published" is still flagged for a human to judge rather than exempted, since it is genuinely ambiguous whether an actor is implied.

**How to judge a borderline case:** ask whether a specific actor performed the action at a specific moment. If yes, it is passive and needs rewriting, so "conditions are stored in a dictionary" becomes "the SDK stores conditions in a dictionary". If the phrase instead describes what something *is* rather than what happened to it, leave it, so "the legacy path is unchanged" stays. Two rewrites work when the actor is genuinely absent: promote the affected thing to subject ("the match excludes it" rather than "it is excluded from the match"), or name the mechanism ("`find` serializes the condition" rather than "the condition is serialized").

**Who counts as the actor:** reserve "you" for what the caller does and name the library "the SDK" or the bare method for what it does on its own. Writing "you" for library behavior implies the reader controls something they do not. The authoritative exemption list lives in `scripts/data/passive-voice/*.json`, so add a new exemption there rather than only in prose.

---

**Rule:** Write in simple present tense. Do not use present continuous as the main verb, so "the client is holding a stale token" becomes "the client holds a stale token" and "confirm calls are landing" becomes "confirm calls reach Contentstack".
**Why:** Documentation describes what the product does, which is always true, not what it happens to be doing while the reader watches. Continuous tense also adds a word without adding a fact.
**Exception:** A predicate adjective that happens to end in "-ing" is not a verb and is exempt, for example "is missing", "is confusing", "is misleading". A passive progressive such as "is being created" belongs to the passive-voice rule above, not to this one.

---

**Rule:** Do not use a gerund phrase as the grammatical subject when the sentence names or implies an actor who should hold the verb. Rewrite "clicking Duplicate and leaving does not create a profile" as "Contentstack creates a profile only when you save the duplicate", and "omitting it uses the configured stack" as "if you omit it, the call runs against the configured stack".
**Why:** A gerund subject attributes the action to the action itself, so nobody performs the verb. The reader then cannot tell whether they, the app, or the runtime is responsible, which is the same defect passive voice creates by a different route.
**Exception:** A gerund that names a concept rather than hiding an actor is correct and stays, for example "Duplicating copies a profile into a new custom profile you own" or "Deleting a profile immediately breaks every client anyone has connected to its URL". This rule is tier 3, so `checks/tier3-candidates.js` surfaces the sentence and a reviewer decides.

**How to judge a borderline case:** ask whether the sentence, or the one before it, already names who acts. If it does, that actor belongs in the subject position. If the sentence states a property of an operation in the abstract, and no actor is present to promote, the gerund is doing real work and stays.

---

**Rule:** Do not open a paragraph with a conversational discourse marker standing in for a callout, such as "One caveat:", "The catch is", "When in doubt:", "That said", "Heads up", or "Wait.". Do not use conversational connectives such as "either way" or "worth knowing" in prose. Delete the marker and lead with the fact, or carry the fact in a callout.
**Why:** A marker of this kind announces that something important follows without saying what, so the reader carries the framing instead of the fact. C2 already defines a closed set of callout labels for content that must not be missed, and an ad hoc marker bypasses it while reading as an aside rather than as a rule.
**Exception:** None. The four callout labels (`Warning`, `Note`, `Tip`, `Additional Resources`) cover every case a marker was reaching for, and plain prose covers the rest.

**How to choose the replacement:** if ignoring the fact breaks a client, loses data, or blocks a task, it is a `Warning`. If the reader only needs it in passing, delete the marker and state it as the first sentence of the paragraph. A three-sentence explanation is prose, not a callout, because C1 reserves callouts for content that is high-stakes and short enough to scan.

---

**Rule:** When a sentence names what the reader can change, create, or configure, the list must be the complete set, or it must open with "for example". Do not write "change its tools or configuration" when the product also edits the name and the description.
**Why:** A short coordinated list after an edit verb reads as the full set of what the product allows. A reader who wants to rename a profile and sees only "tools or configuration" concludes the product cannot do it, and no other sentence on the page corrects them.
**Exception:** A list already introduced by "for example" or "such as" is illustrative by construction and needs no change. This rule is tier 3, so `checks/tier3-candidates.js` surfaces the sentence and a reviewer decides whether the set is complete.

---

**Rule:** State product behavior with the figure or the determining condition, not with a vague quantifier or frequency word. Rewrite "most clients list the connected server", "some are destructive", and "the sign-in occasionally opens two tabs".
**Why:** A vague quantifier gives the reader nothing to act on. "Most clients list the tools" leaves them unable to tell whether their own client is one of them, and "occasionally" gives them no way to know whether what they are seeing is the documented case.
**Exception:** A quantifier is acceptable when the exact figure is maintained outside the docs and the sentence names the authoritative source, or when the sentence already names the condition that decides the outcome. This rule is tier 3, so a reviewer judges whether a figure or a condition is available.

---

**Rule:** Do not attribute intent, knowledge, perception, or volition to a system component. Name the mechanism instead, so "a disabled profile advertises zero tools" becomes "a disabled profile returns an empty tool list". The same applies to "the runtime decides", "a stack means nothing to them", "the highest one wins", and "the agent run outlasted the timeout".
**Why:** An intentional verb reads as an explanation while leaving the mechanism unstated. The reader cannot tell whether the component chose, computed, or merely reported the outcome, so the sentence gives them nothing to verify. It differs from C3-08 in kind: a metaphor substitutes a picture for an operation that exists, while an intentional verb invents an actor that does not.
**Exception:** Protocol and network vocabulary whose intentional-sounding verb is the standard term for the operation is exempt: a server exposes tools, a client discovers them, an OAuth handshake, a PKCE exchange, a token that lacks a scope, a request that cannot reach an endpoint, a locale chain that falls back, an ID that collides, a stack that belongs to a region, an organization that owns a stack, and an LLM that reads or interprets a schema.

**How to judge a borderline case:** ask whether the verb names an operation the reader could look up. `exposes` maps to `tools/list` in the MCP specification, so it survives. `advertises` maps to nothing, so it does not. Where the specification supplies a verb, use the specification's verb. The authoritative entry list lives in `scripts/data/anthropomorphism/*.json` and the protocol veto in `checks/anthropomorphism.js`, so add a new exemption there rather than only in prose.

---

**Rule:** A sentence that points at a code block, table, list, or section on the same page must say where that element is. Write "the URL below", "the table above", or name the section and link it. Do not point forward with a bare demonstrative, so "this URL sets a branch:" becomes "the URL below sets a branch:", and "describes the argument like this:" becomes "describes the argument with the following text:".
**Why:** "This" tells the reader the element has already appeared. When the element is still below, the reader scrolls up, finds nothing, and re-reads the sentence to work out what it meant. The direction is one word, and the writer already knows it.
**Exception:** A demonstrative that points backward at the block immediately above is correct and stays, for example "This grants no extra access" after the behavior it summarizes. A bare "the following" introducing a verified-complete set is governed by C3-04, not by this rule, so it is never flagged here.

**How to judge a borderline case:** ask where the referent sits relative to the sentence. Backward and adjacent is correct. Forward, or backward past an intervening block, needs the direction word or the noun. The entry list lives in `scripts/data/vague-reference/*.json` and the forward-lookahead gate in `checks/vague-reference.js`, so add a new phrase there rather than only in prose.

---

**Rule:** Introduce every code block, table, and list with a sentence that names what follows, and resolve a pronoun to the noun when the nearest preceding block is an image, a table, or a code block rather than a sentence. Write "Use the Executions view to confirm..." rather than "Use it to confirm..." after a screenshot.
**Why:** A block that arrives with no lead-in makes the reader infer what they are looking at from the contents. A pronoun whose nearest antecedent is a block rather than a noun resolves to the wrong thing on a first read, and the reader only discovers the mistake after acting on it.
**Exception:** A block needs no lead-in when the heading directly above it names it, for example a Troubleshooting subsection whose heading is the error string the block quotes. A pronoun is fine when the noun it replaces is in the same sentence or the sentence immediately before, with no block between them. This rule is tier 3, so a reviewer judges whether the lead-in or the noun is genuinely missing.

---

**Rule:** A lead-in that ends in a colon must name or count what follows, in the clause that touches the colon. Write "The following places can set the same value:" or "The three cases below each return a different reason:", not "Several places can set the same value. The highest one wins:".
**Why:** The colon promises the reader something specific. When the clause before it names nothing, the reader arrives at the block without knowing what it holds or how much of it there is, and has to read the whole structure before learning what question it answers. C3-24 catches this only when the sentence uses a demonstrative, so a lead-in that names nothing while using no flagged vocabulary passes every wordlist in the corpus.
**Exception:** A lead-in already carrying a direction word, an element noun, or a link to the target satisfies the rule and is never flagged. A short lead-in whose block is self-evident from the heading directly above it, for example "This app serves:" under a heading naming the app, needs nothing added. This rule is tier 3, so a reviewer or the judge decides whether the reader is genuinely left guessing.

**How to judge a borderline case:** read only the clause that touches the colon, because that is the promise the reader is holding when they reach the block. If it names an element, a direction, or a link, the rule is satisfied. If it names only the subject the sentence is about, it is not, which is why "the same value" does not rescue "Several places can set the same value. The highest one wins:". The generator lives in `checks/tier3-candidates.js` as `unnamedLeadInReferent` and the judge prompt in `judge-tone.js`, so a new exemption belongs in `ELEMENT_NOUN_RE` there rather than only in prose.

**Rule:** Rewrite conditional framing that hides a direct cause-and-effect fact as a direct declarative statement.
**Why:** Conditional framing presents an already-true fact about the system as a hypothetical the reader must first notice.
**Exception:** Framing genuinely conditional on the reader's own setup or choices, not on system behavior, does not need rewriting.

**Rule:** Do not use a typographic character in place of the word it stands for in prose: ·, §, …, ×, ≥, ≤, ≠, ±, ≈, ∞, and the bullet characters •, ‣ and ⁃. Write the word.
**Why:** Each stands for a different word depending on where it sits, so the reader reconstructs a relation the sentence should have stated. "§" is "section" in one line and a paragraph mark in another. A screen reader says nothing useful for "·" or "≥", and a translator has no target for either. These were declared out of scope when C3-27 was added, on the true observation that none is an emoji or an arrow, but nobody checked where they sat: 261 of them were in prose on published pages, and 116 of those were a heading separator.
**Exception:** Code samples, code spans, link targets and HTML attribute values are out of scope, as they are for every prose rule. Box drawing characters are not covered at all: inside a fence they draw a diagram, and the fence is where they belong. The legal marks ©, ® and ™ are permitted, and so is ° in a temperature or an angle, which has no word form that reads better. Dashes belong to C3-05, not here.

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

**Rule:** Write the name of a user interface element in bold, never as inline code. This covers tabs, buttons, menu items, screens, sections, fields, status badges, and card actions. Reserve inline code for what a reader types, copies, or receives back: identifiers, parameters, file paths, commands, literal values, and error strings.
**Why:** Inline code tells the reader "this is a literal you type or paste". A tab label is neither, so marking it as code sends the reader looking for it in a config file or a payload instead of on the screen. Keeping the two conventions apart lets a reader tell at a glance what lives in the product and what goes into their code.
**Exception:** A name that the reader supplies or that the product derives is a value, not a UI element, and stays in code even when it also appears on screen (`CMS` imports as `CMS (imported)`, which derives `cms_imported`).

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

**Rule:** To link out to another doc, hyperlink an existing plain-text keyword directly in the sentence only when that keyword is unformatted prose (no bold, no inline code, no existing link). If the sentence has no such keyword, or the only candidate word is already bolded, inline code, or otherwise special-characterized, add a separate `Additional Resources` callout instead of forcing the link onto formatted text.
**Why:** Wrapping a link around text that already carries its own formatting (`` `retry_strategy` ``, a bolded label) makes the sentence carry two signals at once and is easy to misread as the formatting itself being the link target. A plain keyword can absorb a link without adding visual noise.
**Exception:** None. Pick the plain keyword or fall back to the callout, never link formatted text.

---

**Rule:** Required cross-references include a brief inline summary of the critical fact so the developer does not have to switch docs to complete the current task.
**Why:** A link without a summary places a context-switching cost on the developer. The summary eliminates that cost for most readers.
**Exception:** If the referenced doc is extremely long and the relevant section is not easily summarized, provide the section anchor link and a one-sentence description of what to look for.

---

**Rule:** Phrase an `Additional Resource` callout as "For more information on <topic>, refer to the [Doc Name](url) documentation." When the target carries a procedure, open with "For detailed steps on <task>" instead. Never phrase the callout as a statement about what the target contains ("[X] covers Y", "[X] explains Y", "[X] lists Y").
**Why:** The fixed opener tells the reader within three words that the callout is optional reading, so they can skip the whole line without parsing it. A sentence that leads with the target's contents reads as body prose and interrupts the flow the callout exists to protect.
**Exception:** A callout pointing at another section of the same page closes with "refer to the [Section Name](#anchor) section", because "documentation" names a separate document.

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

**Rule:** Do not cite internal implementation details as justification for a claim: internal function or variable names, internal PR numbers or repo paths, or process attributions such as "as confirmed by engineering." Do not describe an internal endpoint and the credential it authenticates with, or state that a check fails open when it cannot reach the data it checks against. State only the resulting user-facing behavior and status.
**Why:** Internal identifiers and process attributions are meaningless to the reader, can leak unreleased or unstable implementation details, and go stale the moment the internal implementation changes, unlike the documented behavior. Fail-open behavior and internal credential models are worse than meaningless to a reader: they tell someone probing the product where a control stops holding, and no reader needs either fact to finish a task.
**Exception:** None for externally published docs. Internal-only engineering documentation, explicitly marked as such and never published externally, is not subject to this rule.

---

**Rule:** When a multi-fact paragraph is converted into a bulleted list under a bolded lead-in label, the label must name the specific grouping the bullets share, not a generic placeholder such as "Note," "Important," or "Important Points."
**Why:** A generic label gives the reader no scan value and no way to judge relevance before reading the list. A specific label lets the reader decide whether the list matters to them.
**Exception:** None.

**Rule:** When the same category of change recurs across sibling sections, use one consistent heading name and table shape for every instance.
**Why:** A reader scanning several sibling sections for the same kind of fact should find it under the same heading every time.
**Exception:** A heading describing a behavior change unique to that instance is not subject to this rule.

---

**Rule:** A heading that is the only subsection under its parent, and does not belong to a recurring category, should be collapsed into a lead-in sentence.
**Why:** A heading with no siblings and no recurring counterpart elsewhere in the doc adds a navigation stop without adding scan value.
**Exception:** Keep the heading if the doc's table of contents or an existing cross-reference anchors directly to it.

---

**Rule:** A quantitative or capability claim must be verified against the current source of truth before publishing, and state the concrete verified fact.
**Why:** An unverified count or capability claim reads as confident and specific, but if wrong, actively misleads a reader who trusts the doc over checking the source.
**Exception:** If verification is not possible before publishing, state the claim as approximate or omit it.

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

**Rule:** When a table already documents an item, any callout, bullet, or paragraph within ten lines of that table must add only what the table cannot show (behavioral nuance, side effects, cross-references), not restate the table's own cells.
**Why:** A reader who already read the table gains nothing from a block that repeats what the table's own columns already said. Restating table content lengthens the doc without adding information and doubles the maintenance surface for facts already established once. A callout that restates one row also mis-signals, because it implies that row matters more than the rows no callout mentions.
**Exception:** A one-clause restatement is acceptable when it is needed to introduce the block's genuinely new content, avoiding an orphaned bullet or callout with no lead-in.

---

**Rule:** A callout or bolded paragraph placed beside a table must carry a fact the table does not. Restating a row in different words is still restating it.
**Why:** The previous rule catches a block that repeats a row's wording. A block can also repeat a row's meaning while sharing none of its words, which costs the reader the same second read and leaves the same two copies to maintain. A reader who meets the same fact twice in two voices also cannot tell which one is authoritative.
**Exception:** A block that states an instruction the table has no column for, such as what the reader should do about the row, adds a genuine fact. Move it into the table only when the table has somewhere to put it.

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

**Rule:** Do not editorialize about the product's own defects. State the behavior and what the reader does about it. This covers calling a shipped control dead or pointless, saying a label or a message misleads the reader, and any aside about how the product reads to a customer.
**Why:** A doc that tells a customer the product lies to them, or that a shipped feature does nothing, damages trust further than the defect itself does. The judgement also never survives the fix: when the defect is repaired the sentence carrying the criticism is left behind, still published and now wrong.
**Exception:** None. A defect worth naming in a doc is worth filing for engineering. Record it there and document the current behavior neutrally.

---

**Rule:** State a real limit as a neutral fact. Give the boundary, when the reader meets it, and what to do instead. Do not frame the limit as the product failing the reader, and do not add that the product gives no warning, does nothing, or acts silently.
**Why:** The reader needs the boundary in order to plan. Adverbs such as "silently" and "quietly" add no boundary, and phrasing a cap as a failure invites the reader to distrust every other limit on the page. A neutral limit still enables the reader to work around it.
**Exception:** When the absence of a signal is itself the fact the reader must act on, state it plainly and once. A filtered view that looks empty but is not needs the reader to know that, because otherwise they draw a false conclusion from it.

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

---

**Rule:** Flag or parameter reference tables must separate required-ness and caveats into their own columns (Flag, Required, Description, Notes) rather than folding purpose, requiredness, and constraints (exclusivity rules, edge cases, side effects) into a single Description column.
**Why:** A Description column that mixes what a flag does with when it applies and what it conflicts with becomes too dense to scan. Separate Required and Notes columns let a reader check applicability and caveats without rereading a full paragraph per row.
**Exception:** A table with only one or two flags and no caveats may use a simpler two-column Flag/Description format.
