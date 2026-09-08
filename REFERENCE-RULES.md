<!-- Generated file. Do not edit manually. -->
<!-- Source: scripts/data/rules-registry.json and scripts/data/check-sources.json -->
<!-- Regenerate: cd scripts && npm run build:readme -->

# Rule catalog

Every rule in `scripts/data/rules-registry.json`, grouped by prefix. This is the complete
catalog. For what the groups mean and how tiers behave, read the Rule system section of
[README.md](README.md). For which check enforces a rule, read [REFERENCE-CHECKS.md](REFERENCE-CHECKS.md).

The registry holds **182 rules**: 78 tier 1, 57 tier 2, 47 tier 3.

Linting this file reports tier-1 findings, and that is expected. A rule that bans a phrase has to
print the phrase in order to state itself, so every finding here falls inside quoted registry
text. The generated prose around the quotes carries none. The editor hook excludes this
repository, so nothing blocks on it.

## Counts by group

| Group | Rules | Tier 1 | Tier 2 | Tier 3 | Stated in |
| --- | --- | --- | --- | --- | --- |
| [AR](#ar-api-reference-page-anatomy) | 10 | 8 | 2 | 0 | `api-ref/api-ref-method-v2.md` |
| [UG](#ug-usage-guide-anatomy) | 13 | 9 | 3 | 1 | `api-ref/api-ref-usage-guide-v2.md` |
| [B1](#b1-the-ordered-audit-checklist) | 11 | 3 | 3 | 5 | `types/common-rules.md` |
| [B2](#b2-the-anti-pattern-table) | 9 | 3 | 3 | 3 | `types/common-rules.md` |
| [C1](#c1-structure-and-flow) | 6 | 5 | 1 | 0 | `types/common-rules.md` |
| [C2](#c2-scannability) | 15 | 5 | 4 | 6 | `types/common-rules.md` |
| [C3](#c3-language-and-tone) | 30 | 10 | 12 | 8 | `types/common-rules.md` |
| [C4](#c4-code-versus-prose) | 8 | 0 | 4 | 4 | `types/common-rules.md` |
| [C5](#c5-cross-references) | 6 | 0 | 4 | 2 | `types/common-rules.md` |
| [C6](#c6-content-accuracy-and-grouping) | 8 | 0 | 2 | 6 | `types/common-rules.md` |
| [C7](#c7-duplication) | 6 | 0 | 2 | 4 | `types/common-rules.md` |
| [C8](#c8-developer-tone) | 9 | 8 | 0 | 1 | `types/common-rules.md` |
| [C9](#c9-cli-command-documentation) | 4 | 0 | 3 | 1 | `types/common-rules.md` |
| [FM](#fm-front-matter) | 2 | 2 | 0 | 0 | `section-order.json`, `parse-markdown.js` |
| [MIG](#mig-migration-guide-specifics) | 9 | 4 | 2 | 3 | `types/migration-guide.md` |
| [RS1](#rs1-role-based-routing) | 4 | 3 | 0 | 1 | `types/getting-started.md` |
| [RS2](#rs2-quick-start-constraints) | 4 | 2 | 1 | 1 | `types/getting-started.md` |
| [RS3](#rs3-what-a-get-started-guide-excludes) | 3 | 2 | 0 | 1 | `types/getting-started.md` |
| [CLI](#cli-shared-cli-rules) | 20 | 13 | 7 | 0 | `cli-templates/cli-common-rules.md`, `cli-templates/cli-command-reference.md` |
| [PLG](#plg-plugin-guide-specifics) | 5 | 1 | 4 | 0 | `cli-templates/cli-plugin-guide.md` |

## How to read a row

| Column | Meaning |
| --- | --- |
| ID | The stable rule identifier. A finding reports this ID. |
| Tier | 1 blocks, 2 is advisory, 3 needs adjudication. |
| Doc types | `all`, or the specific types the rule is scoped to. |
| Rule | What the rule requires, quoted from the registry. |
| Why | The rationale, quoted from the registry. |
| Exception | When the rule does not apply. |
| Check | The `checkId` that enforces it, or `none` for tier 3. |

## AR, API reference page anatomy

Stated in: `api-ref/api-ref-method-v2.md`.

### AR-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `front-matter-api-ref` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** API reference pages carry exactly three front-matter keys: uid, seo_title, seo_description. Method pages leave both SEO fields empty, class pages fill them.

**Why.** The api-ref content type has no title/description/url fields, so the generic front-matter rule does not apply. A stray key silently fails to round-trip through the CMS converter.

**Exception.** None.

### AR-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-heading-levels` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** A method page has exactly one H3, matching its filename, and every subsection is H4. A class page uses one H1 and H2 subsections.

**Why.** The CMS renders a method page as a fragment inside a class page, so an H1 or H2 on a method page breaks the assembled outline.

**Exception.** None.

### AR-03

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-section-order` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** Method page sections appear in this order: optional Instance State, then Validation, Behavior, Example.

**Why.** Readers scan for the constraint before the mechanism and the mechanism before the sample. A different order forces a re-read.

**Exception.** Instance State appears only when the return type depends on the argument.

### AR-04

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-returns-line` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** Every method page has a Returns line shaped as the bold label, the type, a period, then a noun-phrase sentence.

**Why.** The converter reads the type from this line into the CMS returns field, and the sentence is reused verbatim in the class Method Index.

**Exception.** None.

### AR-05

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-param-table` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** A parameter table has exactly the five columns Name, Type, Required, Default, Description. The Default cell is never blank and never an em dash. Required parameters use Not applicable.

**Why.** The converter maps these five columns positionally onto the CMS parameters array. A blank Default reads as an undocumented default, and an em dash violates C3-05.

**Exception.** Methods that take no parameters omit the table entirely.

### AR-06

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `api-ref` |
| Check | `api-ref-additional-resource` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** An Additional Resource callout closes the Validation section of any method that makes an HTTP call, with the label agreeing in number with the number of links it carries.

**Why.** The generic HTTP error codes belong in one linked reference rather than repeated per method, and a plural label over a single link reads as a missing link.

**Exception.** Pure client-side utility methods that make no request omit it.

### AR-07

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `api-ref` |
| Check | `api-ref-trailing-rule` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** Method pages end with a horizontal rule. Class pages and usage guides do not.

**Why.** The rule marks the end of a method fragment when several are concatenated into one rendered class page. A class page and a usage guide are never concatenated, so the rule would render as a stray divider.

**Exception.** None.

### AR-08

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-method-index-sole-list` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** The Method Index table is the only list of a class's methods. No trailing bullet list of method links.

**Why.** Two lists of the same methods drift apart, and the converter derives the CMS methods array from the index.

**Exception.** None.

### AR-09

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-index-completeness` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** Every method file is linked exactly once from its class Method Index, and every relative link in the doc set resolves.

**Why.** A method absent from the index is unreachable in the rendered page, and a method listed twice implies two callable methods.

**Exception.** None.

### AR-10

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-verified-defaults` |
| Source | `api-ref/api-ref-method-v2.md` |

**Rule.** Take a parameter default from the SDK signature. Never from an API reference doc or Postman collection. When the SDK sets no default, say the API applies its own without naming a number.

**Why.** Default fields in API request docs are sample values, not defaults. A fabricated default is indistinguishable from a real one to the reader.

**Exception.** A default named in the API's own prose documentation, as opposed to a request-parameter table, may be cited with the source noted.

## UG, usage guide anatomy

Stated in: `api-ref/api-ref-usage-guide-v2.md`.

### UG-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `front-matter-api-ref` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** A usage guide carries the same three front-matter keys as every api-ref page, and fills all three. Neither SEO field is left empty.

**Why.** A usage guide is a standalone URL, so its SEO text is rendered and indexed. A method page is a fragment whose SEO fields would never render, which is why AR-01 requires the opposite there.

**Exception.** None.

### UG-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-heading-levels` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** A usage guide has exactly one H1 in the form of the SDK name followed by API Reference, sections at H2, and usage-pattern titles at H3. No heading is H4 or deeper, and no H2 repeats the H1 text.

**Why.** A usage guide is a standalone page rather than a concatenated fragment, so it owns its H1. An H2 repeating the title pushes the first real section below the fold on a page whose readers see the top third.

**Exception.** None.

### UG-03

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-section-order` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** Usage guide sections appear in this order: Minimum Working Example, SDK Structure, Class Overview, Task Index, Key Usage Patterns, SDK-Wide Notes, then SDK Limitations. The Before you begin blockquote sits immediately after the intro paragraph, before the first H2.

**Why.** Average measured scroll depth on the pages this replaces is 28.85%, so orientation, a working snippet, and both navigation tables have to sit inside the top third of the page. A reordering moves at least one of them out of view.

**Exception.** SDK Limitations is omitted entirely when the SDK has no known limitations that clear the section's two entry tests.

### UG-04

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-class-overview-table` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** The Class Overview table has exactly the three columns Class, Role, and Accessed via, in that order. Every cell in the Class column is a markdown link, and every cell in the Accessed via column is inline code.

**Why.** A class name in plain text on the reference landing page is the affordance failure the 29.63% dead-click rate measures. Readers click it, nothing happens, and there is no other route to the class page.

**Exception.** None.

### UG-05

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-class-overview-completeness` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** Every class_reference.md in the doc set is linked exactly once from the Class Overview table, and every link in that table resolves.

**Why.** A class absent from the table is unreachable from the reference landing page, and a class listed twice implies two classes. This is AR-09 applied one tier up.

**Exception.** A partial review folder resolves links against the baseline tree given by the baseline flag.

### UG-06

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-task-index` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** The Task Index table has exactly the three columns Task, Start here, and Class, in that order. Every Start here cell is a link that resolves, and every Task cell starts with a verb.

**Why.** 102 of 110 benchmarked documentation sets organize by task or resource rather than by SDK class, so this table is the entry point for readers who know their goal but not which class owns it. A dead link here is worse than an absent row, because the reader has already committed to the route.

**Exception.** None.

### UG-07

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `api-ref` |
| Check | none, tier 3 is adjudicated |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** A fact true of every class in the SDK lives once in SDK-Wide Notes or SDK Limitations on the usage guide and is not repeated on class pages. A fact confined to one class lives on that class page and is not hoisted to the usage guide.

**Why.** Two copies of the same note drift, and the reader cannot tell which is current. A class-specific note found on the usage guide reads as applying to every class, which is a worse error than omitting it.

**Exception.** None.

### UG-08

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `api-ref` |
| Check | `api-ref-token-type-warning` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** SDK-Wide Notes carries a token-type warning naming the token type this SDK requires and the error a wrong token type produces.

**Why.** Auth and token scope is the largest single theme in the SDK issue corpus at 38 tickets, and the failure is close to silent. A management or preview token used where a delivery token belongs returns error code 109, We can't find that Stack, which names neither the token nor the fix.

**Exception.** An SDK that accepts exactly one token type and cannot be initialized with another omits it.

### UG-09

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-before-you-begin` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** A Before you begin blockquote follows the intro paragraph and carries three facts: a link to the Get Started guide, the runtime versions this SDK supports, and the SDK version this reference documents with a changelog link.

**Why.** The 23.53% quick-back rate is the signature of a reader who arrived without setup and left rather than navigating. The runtime version is a prerequisite that otherwise reads as an SDK bug, and the documented version is what separates an upgrade regression from a documentation error.

**Exception.** None. An SDK with no published changelog links its release notes instead.

### UG-10

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `api-ref` |
| Check | `api-ref-usage-guide-scope` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** A usage guide carries no installation or authentication setup steps, no method signatures, no flat list of methods, no FAQ or Common Questions section, and no standalone Additional Resources section.

**Why.** Each of these is a defect observed on a live page. Setup belongs to Get Started, signatures and method lists belong to the class and method pages, an FAQ heading is a sign the topic has no owner, and a closing link list sits on the part of the page the scroll data says is not read. The trailing horizontal rule is covered by AR-07.

**Exception.** A package name or install command inside a fenced code block is not a setup step and is not flagged.

### UG-11

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `api-ref` |
| Check | `api-ref-usage-patterns` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** Key Usage Patterns holds three or more H3 subsections, each titled with the scenario it demonstrates rather than a generic label such as Example 1 or Basic usage.

**Why.** The title is how a reader scanning the page picks which example to read. Benchmarked competitors carry 8 to 13 named scenarios per method against Contentstack's current 1, so three is the floor rather than the target.

**Exception.** None.

### UG-12

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-sdk-limitations` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** The SDK Limitations table uses the same three columns as the class-level Capability Matrix, Capability, Supported, and Notes / Alternative, and no Notes / Alternative cell is left blank.

**Why.** Matching the class-level columns means a reader moving between the two tiers reads the same table shape. A blank alternative leaves the reader knowing they are blocked and not knowing what to do next, which is worse than omitting the row.

**Exception.** The whole section is omitted when the SDK has no known limitations that clear the section's two entry tests. An empty table is never correct.

### UG-13

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `api-ref` |
| Check | `api-ref-sdk-wide-notes` |
| Source | `api-ref/api-ref-usage-guide-v2.md` |

**Rule.** SDK-Wide Notes is a table with exactly the three columns Concern, Behavior, and Default when unset. No Default when unset cell is blank. Required parameters use Not applicable.

**Why.** Five notes written as bold labels with bullets under each is fifteen lines of near-identical shape, and a reader after one fact has to read all of it. The three columns hold across every SDK family because each cross-cutting concern has a behavior and a default. A blank default reads as an undocumented default rather than an absent one, and undocumented parameters and defaults are the largest gap in the support corpus at 39 threads.

**Exception.** None. A concern with no default uses Not applicable rather than a blank cell.

## B1, the ordered audit checklist

Stated in: `types/common-rules.md`.

### B1-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `section-structure` |
| Source | `types/common-rules.md` |

**Rule.** Does the doc lead with setup or action before theory (Do first, understand second)?

**Why.** A developer who has to read theory before acting drops off before reaching setup.

**Exception.** None stated, part of the ordered checklist.

### B1-02

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Does each heading name accurately describe what the section contains, not what it aspires to contain?

**Why.** A heading that overpromises breaks trust the moment the mismatch is discovered.

**Exception.** None.

### B1-03

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Are all items in each section genuinely the same type of thing?

**Why.** Grouping unlike items creates false equivalence and cognitive confusion.

**Exception.** None.

### B1-04

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Does every "you must do X" instruction explain what breaks without X before stating the rule?

**Why.** A developer who understands the consequence can diagnose failures, one who only knows the rule cannot.

**Exception.** When the consequence is obvious from context.

### B1-05

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Is any prose block that could be a table or bullet list already a table or bullet list?

**Why.** Prose comparisons and sequences bury parallel items and are harder to scan.

**Exception.** Narrative-dependent items or two-item one-dimension comparisons.

### B1-06

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `acronym-first-use` |
| Source | `types/common-rules.md` |

**Rule.** Is each key term defined once on first use and abbreviated consistently thereafter?

**Why.** Inconsistent terminology forces readers to re-map terms, and AI retrieval agents may treat one concept as two entities.

**Exception.** Very long docs may redefine once per major section.

### B1-07

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `prose-guard-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** Are implementation guards, conditional flags, and required configuration values shown as code rather than described in sentences?

**Why.** A guard buried in a sentence may be missed, a code block is unambiguous.

**Exception.** None for guards, conditionals, and type checks.

### B1-08

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `callout-frequency` |
| Source | `types/common-rules.md` |

**Rule.** Has every outbound callout (Additional Resource, See also, Note) been classified as required, optional, or redundant?

**Why.** An unclassified callout interrupts reading flow without establishing whether the reader must act on it.

**Exception.** None, every callout must be classified before publishing.

### B1-09

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `duplicate-sections` |
| Source | `types/common-rules.md` |

**Rule.** If two sections are near-identical, does the second reference the first rather than repeating it?

**Why.** Verbatim duplication creates maintenance debt, one copy goes stale silently.

**Exception.** Sections intended to be read in isolation, with an explicit mirroring note.

### B1-10

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Is there any casual language, Q&A-style headers, or marketing phrasing?

**Why.** Casual and marketing language undercuts professional credibility.

**Exception.** None.

### B1-11

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Does the reader know what happens if they skip or misapply each required step?

**Why.** Without stated consequences, developers cannot judge which steps are safe to skip.

**Exception.** None.

## B2, the anti-pattern table

Stated in: `types/common-rules.md`.

### B2-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `section-structure` |
| Source | `types/common-rules.md` |

**Rule.** Avoid Understand-Understand-Do ordering.

**Why.** Developer cannot act until everything is read, creates drop-off before setup.

**Exception.** None.

### B2-02

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Avoid an aspirational heading that does not match its content.

**Why.** Developer expects one thing and finds another, erodes trust.

**Exception.** None.

### B2-03

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Avoid stating an implementation rule before its consequence.

**Why.** Developer follows the rule without understanding why, cannot diagnose failures.

**Exception.** None.

### B2-04

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `callout-frequency` |
| Source | `types/common-rules.md` |

**Rule.** Avoid an outbound callout placed mid-flow.

**Why.** Interrupts reading, and AI retrieval agents split context across doc boundaries unnecessarily.

**Exception.** None.

### B2-05

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Avoid grouping unlike things as peers (for example, a CDN listed alongside SSR, CSR, SSG).

**Why.** Creates false equivalence, developer assumes the unlike item belongs to the same category.

**Exception.** None.

### B2-06

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `duplicate-sections` |
| Source | `types/common-rules.md` |

**Rule.** Avoid near-identical sections with full content duplication.

**Why.** Maintenance debt, one section goes stale silently when the other changes.

**Exception.** None.

### B2-07

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `prose-guard-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** Avoid prose for implementation guards or conditions.

**Why.** A developer may miss a critical condition buried in a sentence.

**Exception.** None.

### B2-08

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `bare-links` |
| Source | `types/common-rules.md` |

**Rule.** Avoid bare cross-reference links without a description.

**Why.** Reader cannot judge whether the link is worth following, and AI agents cannot prioritize retrieval.

**Exception.** None.

### B2-09

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Avoid casual or marketing phrasing in technical voice.

**Why.** Undercuts authority, inconsistent with professional documentation standards.

**Exception.** None.

## C1, structure and flow

Stated in: `types/common-rules.md`.

### C1-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `section-structure` |
| Source | `types/common-rules.md` |

**Rule.** Order sections as Do, then Understand, then Debug. Setup comes before theory, troubleshooting comes last.

**Why.** Developers act first, one who cannot get a working setup will not read the theory section.

**Exception.** Conceptual-only docs with no setup steps flow from general to specific instead.

### C1-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `section-structure` |
| Source | `types/common-rules.md` |

**Rule.** The Quick Decision Guide belongs before Prerequisites, not inside Main Content.

**Why.** Developers need to orient themselves before reading what is required to start.

**Exception.** Single-path docs with no branching omit the Quick Decision Guide entirely.

### C1-03

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `section-structure` |
| Source | `types/common-rules.md` |

**Rule.** Theory sections belong after the working setup, never before it.

**Why.** A developer who has just completed setup reads theory to understand what they built, theory without context is harder to retain.

**Exception.** A one-sentence orientation in the Overview is acceptable if it prevents a common misunderstanding.

### C1-04

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `prerequisites-links` |
| Source | `types/common-rules.md` |

**Rule.** Prerequisites must link to the resource that fulfills each requirement.

**Why.** A prerequisite that names a dependency without linking to it forces the developer to search before they can start.

**Exception.** Prerequisites that are environment facts (for example, "you have Node installed") do not require links.

### C1-05

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `troubleshooting-format` |
| Source | `types/common-rules.md` |

**Rule.** Troubleshooting entries require a root cause and a resolution, not just a symptom.

**Why.** A symptom-only entry tells the developer what is wrong but not why or how to fix it.

**Exception.** None, every troubleshooting entry must be complete.

### C1-06

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `bare-links` |
| Source | `types/common-rules.md` |

**Rule.** Each link in Next Steps must include a one-sentence description of what the linked doc covers.

**Why.** Bare links do not help developers decide whether to follow them.

**Exception.** None, no bare links in Next Steps.

## C2, scannability

Stated in: `types/common-rules.md`.

### C2-01

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Use tables instead of prose for comparisons, decision matrices, and option sets with two or more dimensions.

**Why.** Prose comparisons require holding multiple values in working memory at once.

**Exception.** A two-item, one-dimension comparison may stay a short prose sentence.

### C2-02

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Use bullet lists instead of prose for sequences of conditions, requirements, or parallel items.

**Why.** Lists establish visual hierarchy, prose buries parallel items.

**Exception.** Items with significant narrative dependency may stay prose.

### C2-03

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Use an ASCII or flow diagram for data flows with three or more steps or two or more actors.

**Why.** Prose requires the developer to reconstruct the sequence mentally.

**Exception.** Single-actor, two-step flows may stay prose.

### C2-04

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `quick-reference-table` |
| Source | `types/common-rules.md` |

**Rule.** Section names in a Quick Reference table must link to the corresponding section using the relative doc URL and section anchor.

**Why.** A table without links forces the developer to scroll to find the referenced section.

**Exception.** None.

### C2-05

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `callout-frequency` |
| Source | `types/common-rules.md` |

**Rule.** Callouts are reserved for high-stakes warnings (data loss, broken preview, security issues), not general information.

**Why.** Overused callouts lose their signal value.

**Exception.** One informational Note per section is acceptable if the information would otherwise be missed in a long prose block.

### C2-06

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** When a list of values is maintained externally, include a Note stating the authoritative source and any known constraints.

**Why.** A copied list becomes stale without notice, and readers who trust it ship broken code.

**Exception.** Not required if the doc already states the list is illustrative and links the authoritative source inline.

### C2-07

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `heading-length` |
| Source | `types/common-rules.md` |

**Rule.** A heading is at most 4 words, counting an inline-code span or a hyphenated compound as one word.

**Why.** A reader scans headings to find their place. A heading that runs to a full sentence stops working as a label and becomes prose, and a table of contents built from such headings is unusable.

**Exception.** A heading that reproduces product output verbatim, so a reader searching the error text lands on the section that resolves it, may exceed 4 words. A symptom described in the author's own words is not product output.

### C2-08

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `heading-length` |
| Source | `types/common-rules.md` |

**Rule.** A heading is a complete phrase. Do not open a heading with a lowercase verb or a conjunction that depends on a subject the heading does not name.

**Why.** A fragment reads as the tail of a sentence whose subject is missing, so a reader arriving from a search result or a table of contents cannot tell what the section covers.

**Exception.** A heading may open in lowercase when the first word is itself a lowercase identifier, such as a package name or an error code.

### C2-09

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `paragraph-cohesion` |
| Source | `types/common-rules.md` |

**Rule.** Consecutive body paragraphs under one heading read as one argument or as labelled standalone facts. When the paragraphs build on each other, open each with the subordinating connective that carries the logic. When they cover separate sub-topics, give each a bolded lead-in label. Do not leave a run of three or more paragraphs that each open with a bare subject or a bare demonstrative and signal no relation to the paragraph above, and do not strand a one-sentence paragraph between two longer ones.

**Why.** A reader treats a section as one answer to one question. Paragraphs that each resolve backward, with nothing pointing forward, force the reader to reconstruct a connection the writer already knew, and a reader who cannot tell whether paragraph three continues paragraph two or starts a new topic rereads both.

**Exception.** Two short paragraphs where the second plainly continues the first need neither a label nor a connective. A procedure whose paragraphs are numbered steps carries its own sequence. A single backward demonstrative resolving the paragraph immediately above is correct and is governed by C3-24, not by this rule.

### C2-10

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `table-integrity` |
| Source | `types/common-rules.md` |

**Rule.** Every table row carries the same number of cells as its header row, and every cell's emphasis markers, parentheses and brackets close within that cell.

**Why.** A row that has lost or gained a cell renders with its values under the wrong columns, and a cell whose punctuation opens without closing renders text the author never wrote. Both survive a Markdown round trip unchanged, so no stability check can see them. A punctuation pass moved a closing parenthesis across a cell boundary in 19 rows of this corpus and the damage reached the published site.

**Exception.** A pipe that is part of a cell's content is written as "\\|" or wrapped in backticks, and is then not a cell separator. A blank leading header cell is correct in a comparison table whose first column holds the row labels, so it is only reported when no other header cell is labelled either.

### C2-11

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `callout-taxonomy` |
| Source | `types/common-rules.md` |

**Rule.** A callout uses one of four labels: Warning, Note, Tip, or Additional Resource. Do not invent another label such as Important, Attention, or Caution. The Additional Resource label takes the plural, Additional Resources, when the callout carries two or more links. AR-06 owns that agreement, so this rule governs only which words may appear. An API reference usage guide adds one label, Before you begin, which UG-09 requires on that page and on no other.

**Why.** A fixed, small set of labels lets readers learn what each one means and react consistently. Ad hoc labels dilute that signal and read as informal, and an open-ended set forces every reader to guess what a given label implies about severity.

**Exception.** None on the label set. Map the intended severity onto the closest existing label. A caveat the reader must not miss is Warning, not Important.

### C2-12

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Do not merge a stated fact, a conditional exception, an inline command reference, and a location fact into one paragraph, split each by kind into a labeled statement, table, or code block.

**Why.** A paragraph blending several kinds of information forces the reader to parse prose to extract a fact they came to scan for.

**Exception.** A short paragraph with only one or two kinds mixed, under roughly 40 words, does not need splitting.

### C2-13

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `numeric-consistency` |
| Source | `types/common-rules.md` |

**Rule.** A stated count must match the structure it counts. "Eight deliverables", "the four steps below" and a heading that says "(13)" each have to agree with the list, table or heading run that follows.

**Why.** A reader who trusts the number stops looking when they reach it. "Eight deliverables are mandatory" over a list of seven does more damage than saying nothing, because the reader never learns what the eighth was and has no reason to suspect one is missing. The count and the list drift the first time somebody edits one of them, and no round-trip or stability check can see it.

**Exception.** A count that refers to the world rather than to this page is out of scope: "Studio runs in seven regions" is a fact about Contentstack, not a claim about the list beneath it. The pointing word ("below", "following", "these") is what brings a count into scope. A count over a list whose items are alternatives rather than members is also out of scope.

### C2-14

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `link-label-fidelity` |
| Source | `types/common-rules.md` |

**Rule.** A link label names its destination. It does not describe the act of following the link ("here", "read more"), and it does not promise a page other than the one it resolves to.

**Why.** A label that resolves but misdescribes costs a reader more than a 404 does, because a 404 says something is wrong and a wrong page does not. A screen reader user tabbing between links hears only the labels, so "here, here, this page" gives them no way to choose. The same rule catches a label a bulk edit has broken into fragments, which is how 20 links shipped after a punctuation pass moved a bracket across a label boundary.

**Exception.** A label may use different words for the same thing: "Slot props" over a page titled "Data-carrying slots" names the concept while the title names the shape, and both are right. A product noun used mid-sentence is not an opaque label: "a multi-type [Reference](...) field" gets its subject from the sentence.

### C2-15

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** When a bolded lead-in label introduces more than one distinct fact, or a condition with multiple branches, format the content as a bullet list under that label, nesting a sub-bullet for each branch, rather than one prose paragraph.

**Why.** A paragraph that bundles a condition together with its outcomes forces the reader to reread to map each outcome to its trigger. Nested bullets make each branch and its outcome visible without rereading.

**Exception.** When the label introduces a single fact with no sub-parts or branches, one prose sentence is correct. Do not force a one-fact note into a list.

## C3, language and tone

Stated in: `types/common-rules.md`.

### C3-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** No casual language in prose (for example, "right away", "on its own", "you'll find", "pretty straightforward", "just").

**Why.** Casual language is inconsistent with professional documentation standards.

**Exception.** None.

### C3-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `qa-headers` |
| Source | `types/common-rules.md` |

**Rule.** No Q&A-style headers in body sections.

**Why.** Q&A headers feel like marketing copy or FAQ content.

**Exception.** A dedicated FAQ or Common Questions section at the end of the doc may use question-form headers. The page's H1 is also exempt: a conceptual guide's title stating its subject as a question, for example "What is MCP Profile Hub?", names the page rather than opening an FAQ-style body section. H2 and deeper stay in scope.

### C3-03

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** No marketing phrasing (for example, "seamless", "powerful", "instant feedback", "enhanced experience").

**Why.** Marketing language does not convey technical information.

**Exception.** None.

### C3-04

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `exhaustive-claim-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Use "for example" when the set shown is illustrative, not exhaustive. Do not use "all of the following" or "these are the only ways" unless the set is verified complete.

**Why.** "All of the following" implies completeness, creating maintenance risk when new variants are added.

**Exception.** A genuinely exhaustive, verified set (an enum or a closed list of error codes) may use "the following" without a qualifier.

### C3-05

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `em-dash-semicolon` |
| Source | `types/common-rules.md` |

**Rule.** No em dashes or semicolons in prose outside of code blocks.

**Why.** Em dashes and semicolons create grammatical ambiguity in machine-parsed content.

**Exception.** Inside code blocks, code conventions apply instead.

### C3-06

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `acronym-first-use` |
| Source | `types/common-rules.md` |

**Rule.** Define each key term once at first use using the full form, then use the abbreviation consistently.

**Why.** Inconsistent terminology forces the reader to re-map terms mentally.

**Exception.** Very long docs with independently-read sections may redefine once per major section.

### C3-07

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `sentence-concision` |
| Source | `types/common-rules.md` |

**Rule.** Write one idea per sentence. Cut hedging qualifiers and redundant justification clauses ("in practice", "which means", "rather than letting X decide", stacking two "because/so" clauses in one sentence).

**Why.** A sentence carrying two justifications forces the reader to hold both in mind before either one lands.

**Exception.** A single subordinate clause stating the direct cause of the preceding fact is fine, only stacked or redundant justification is the target.

### C3-08

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `metaphor-phrases` |
| Source | `types/common-rules.md` |

**Rule.** No figurative/spatial metaphors for technical mechanisms.

**Why.** A metaphor reads smoothly but forces the reader to reverse-engineer the actual mechanism, and reused metaphors for different operations are confusing.

**Exception.** Domain-standard structural vocabulary (ancestor/descendant/parent/child naming a real data-model relationship) is exempt.

### C3-09

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `periphrasis-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Name a concept directly instead of describing what it does in roundabout language, when a concise technical term for it is already established elsewhere in this doc set.

**Why.** A roundabout description reads fine on its own but wastes words restating what a single established term already conveys, and it makes the doc set inconsistent about how it refers to the same concept.

**Exception.** A roundabout description is fine if no shorter direct term for the concept exists yet anywhere in this doc set.

### C3-10

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `passive-voice` |
| Source | `types/common-rules.md` |

**Rule.** No passive-voice constructions (aux plus past participle, modal plus be plus participle, get-passives, or by-agent passives) where an active-voice rewrite would name the actor directly.

**Why.** Passive voice hides who or what performs an action, forcing the reader to infer the actor. Active voice states the mechanism directly and reads faster.

**Exception.** Predicate adjectives describing a state rather than an action (for example is unchanged, is unlocalized, is based on) are not passive voice and are exempt. Ambiguous config-state phrasing (is enabled, is published) is still flagged for human judgment rather than exempted.

### C3-11

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `error-code-format` |
| Source | `types/common-rules.md` |

**Rule.** Write a numeric error code or HTTP status code as inline code, never as bare prose.

**Why.** A bare number reads as a quantity, not an identifier. Inline code marks it as a literal value the reader compares against.

**Exception.** A written-out description of a status class ("a client error", "a server error") is prose and is not affected.

### C3-12

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `embedded-question-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not embed a lowercase question word ("how", "how many", "how much") mid-sentence as an indirect question. Name the thing directly ("the number of X", "the OAuth sign-in flow", "the steps to X", "the rules for combining them") instead.

**Why.** An embedded question turns a declarative technical sentence into something that reads like a spoken aside, and it is unnecessary since the fact can be named directly.

**Exception.** A capitalized "How", "How many", or "How much" starting a standalone phrase, such as a heading or a parameter table cell description, is a different and accepted convention.

### C3-13

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `retry-attempt-count-bold` |
| Source | `types/common-rules.md` |

**Rule.** Bold a spelled-out retry or attempt count stated in prose, for example **five attempts**.

**Why.** A retry limit is a fact a developer scans the page for. Bold marks it the same way the Default column marks a value, and a spelled-out number has no other visual signal the way a bare digit does.

**Exception.** None. This targets the specific retry/attempt-count convention, not every number in prose.

### C3-14

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `ordered-list-sequence` |
| Source | `types/common-rules.md` |

**Rule.** Use a numbered list only for a sequence: instructions the reader performs in order, an event flow, or a ranked list such as precedence. Every other set of parallel items is an unordered list.

**Why.** Numbers assert an order. When a set of components or concepts is numbered, the reader looks for a first step and a last step that do not exist, and the numbers become noise that hides the real steps elsewhere on the page.

**Exception.** A ranked or ordered set whose intro line names the order, for example "the highest one wins", keeps its numbers.

### C3-15

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not open a paragraph with a conversational discourse marker standing in for a callout (for example, "One caveat:", "When in doubt:", "That said", "Wait."), and do not use conversational connectives such as "either way" or "worth knowing" in prose.

**Why.** A marker of this kind announces that something important follows without saying what, so the reader carries the framing instead of the fact. The standards already define a closed set of callout labels for content that must not be missed, and an ad hoc marker bypasses it.

**Exception.** None. Delete the marker and lead with the fact, or carry the fact in a Warning, Note, Tip, or Additional Resources callout.

### C3-16

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** When a sentence names what the reader can change, create, or configure, the list must be the complete set, or it must be marked as illustrative with "for example".

**Why.** A short coordinated list after an edit verb reads as the full set of what the product allows. A reader who wants to rename a profile and sees only "change its tools or configuration" concludes the product cannot do it.

**Exception.** A list already introduced by "for example" or "such as" is illustrative by construction and needs no change.

### C3-17

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** State product behavior with the figure or the determining condition, not with a vague quantifier or frequency word ("most clients", "some are destructive", "occasionally", "usually").

**Why.** A vague quantifier gives the reader nothing to act on. "Most clients list the tools" leaves them unable to tell whether their own client is one of them.

**Exception.** A quantifier is acceptable when the exact figure is genuinely maintained outside the docs and the sentence names the authoritative source, or when the sentence already names the condition that decides the outcome.

### C3-18

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `anthropomorphism` |
| Source | `types/common-rules.md` |

**Rule.** Do not attribute intent, knowledge, perception, or volition to a system component. Name the mechanism instead, for example "a disabled profile returns an empty tool list" rather than "a disabled profile advertises zero tools".

**Why.** An intentional verb reads as an explanation while leaving the mechanism unstated. The reader cannot tell whether the component chose, computed, or merely reported the outcome, so the sentence gives them nothing to verify.

**Exception.** Protocol and network vocabulary whose intentional-sounding verb is the standard term for the operation is exempt: a server exposes tools, a client discovers them, an OAuth handshake, a PKCE exchange, a token that lacks a scope, a request that cannot reach an endpoint, a locale chain that falls back, an ID that collides, a stack that belongs to a region, an organization that owns a stack, and an LLM that reads or interprets a schema.

### C3-19

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `present-continuous` |
| Source | `types/common-rules.md` |

**Rule.** Write in simple present tense. Do not use present continuous as the main verb ("the client is holding a stale token", "confirm calls are landing").

**Why.** Documentation describes what the product does, which is always true, not what it happens to be doing while the reader watches. Continuous tense also adds a word without adding a fact.

**Exception.** A predicate adjective that happens to end in "-ing" is not a verb and is exempt ("is missing", "is confusing", "is misleading"). A passive progressive such as "is being created" belongs to C3-10, not here.

### C3-20

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Do not use a gerund phrase as the grammatical subject when the sentence names or implies an actor who should hold the verb ("clicking Duplicate and leaving does not create a profile", "omitting it uses the configured stack").

**Why.** A gerund subject attributes the action to the action itself, so nobody performs the verb. The reader cannot tell whether they, the app, or the runtime is responsible, which is the defect passive voice creates by a different route.

**Exception.** A gerund that names a concept rather than hiding an actor is correct and stays, for example "Duplicating copies a profile into a new custom profile you own". If no actor is present to promote into the subject, the gerund is doing real work.

### C3-21

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Use the specific mechanism verb rather than a general-purpose house verb ("holds", "carries", "names", "asks for", "offers", "hides", "lets you", "picks") when an exact verb is available ("contains", "stores", "includes", "specifies", "requests", "returns", "accepts", "selects").

**Why.** Each house verb is defensible in one sentence and unreadable in twenty. The doc set drifts into a vocabulary where every relationship is "carries" and no sentence says what the component actually does.

**Exception.** Protocol and network vocabulary whose intentional-sounding verb is the standard term for the operation is exempt: a server exposes tools, a client discovers them, an OAuth handshake, a PKCE exchange, a token that lacks a scope, a request that cannot reach an endpoint, a locale chain that falls back, an ID that collides, a stack that belongs to a region, an organization that owns a stack, and an LLM that reads or interprets a schema. A house verb is also acceptable when no exact verb exists for the relationship, or when the specific verb would be wrong, for example holds a lock or carries a signature.

### C3-22

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Use a contrastive connective ("but", "however", "though", "yet") only when the clauses it joins actually point in opposite directions. Where both clauses point the same way, use "and" or a period.

**Why.** A false contrast makes the reader look for a tension that is not there, and re-read to find it. "The flag lives on PUT /api/profiles, but that endpoint is internal" reads as a caveat when both halves say the same thing: here it is, you cannot use it.

**Exception.** Quoted product output and error strings are exempt, because the doc reproduces them verbatim and cannot rewrite them. A connective inside a table cell is also exempt, since a cell is not a sentence. Note that clauses which genuinely do contrast are COMPLIANT rather than exempt.

### C3-23

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** When a concept has a documented name outside this doc set, name it and link its documentation rather than describing its properties. Write "an [auth token](...)" rather than "a short-lived token the dashboard issues for its own use and never displays".

**Why.** A description is a copy of a definition, and copies go stale silently. Naming the concept and linking its canonical page keeps one source of truth, and it lets a reader searching for the term find the page at all.

**Exception.** A description is correct when the concept has no documented name, or when the sentence is USING the term rather than defining it. C3-09 covers the narrower case of roundabout language where a concise term is already established inside this doc set, so a hit that C3-09 owns is not this rule.

### C3-24

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `vague-reference` |
| Source | `types/common-rules.md` |

**Rule.** A sentence that points at a code block, table, list, or section on the same page must say where that element is. Write "the URL below", "the table above", or name the section and link it. Do not point forward with a bare demonstrative, so "this URL sets a branch:" becomes "the URL below sets a branch:", and "describes the argument like this:" becomes "describes the argument with the following text:".

**Why.** "This" tells the reader the element has already appeared. When the element is still below, the reader scrolls up, finds nothing, and re-reads the sentence to work out what it meant. The direction is one word, and the writer already knows it.

**Exception.** A demonstrative that points backward at the block immediately above is correct and stays, for example "This grants no extra access" after the behavior it summarizes. A bare "the following" introducing a verified-complete set is governed by C3-04, not by this rule, so it is never flagged here.

### C3-25

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Introduce every code block, table, and list with a sentence that names what follows, and resolve a pronoun to the noun when the nearest preceding block is an image, a table, or a code block rather than a sentence. Write "Use the Executions view to confirm..." rather than "Use it to confirm..." after a screenshot.

**Why.** A block that arrives with no lead-in makes the reader infer what they are looking at from the contents. A pronoun whose nearest antecedent is a block rather than a noun resolves to the wrong thing on a first read, and the reader only discovers the mistake after acting on it.

**Exception.** A block needs no lead-in when the heading directly above it names it, for example a Troubleshooting subsection whose heading is the error string the block quotes. A pronoun is fine when the noun it replaces is in the same sentence or the sentence immediately before, with no block between them.

### C3-26

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** A lead-in that ends in a colon must name or count what follows, in the clause that touches the colon. Write "The following places can set the same value:" or "The three cases below each return a different reason:", not "Several places can set the same value. The highest one wins:".

**Why.** The colon promises the reader something specific. When the clause before it names nothing, the reader arrives at the block without knowing what it holds or how much of it there is, and has to read the whole structure before learning what question it answers. C3-24 catches this only when the sentence uses a demonstrative, and the defect is the absence of a pointer rather than the presence of a word.

**Exception.** A lead-in already carrying a direction word, an element noun, or a link to the target satisfies the rule and is never flagged. A short lead-in whose block is self-evident from the heading directly above it, for example "This app serves:" under a heading naming the app, needs nothing added. This rule is tier 3, so a reviewer or the judge decides whether the reader is genuinely left guessing.

### C3-27

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `no-emoji` |
| Source | `types/common-rules.md` |

**Rule.** Do not use emoji, arrows, or pictographic marks in prose. Write the word.

**Why.** Emoji render differently on every operating system and font, convey nothing to a screen reader, and do not translate. Arrows are worse than decorative: one glyph stands for a UI path, a range, a mapping and a consequence, so the reader has to infer the relation the sentence should have stated.

**Exception.** Code samples are out of scope, and so are the legal marks ©, ® and ™. Box drawing characters that draw a tree inside a code fence, and the mathematical symbols ≥, ≤, ≠ and ≈, are not pictographic and are permitted.

### C3-28

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `no-italics` |
| Source | `types/common-rules.md` |

**Rule.** Do not use italics. Use bold for a visible UI element name, inline code for an identifier, and quotation marks for reported speech.

**Why.** Italics carry no meaning a reader can act on. Where emphasis matters the sentence should carry it, and where the text is a term, an identifier or a quotation another convention already owns the job and says which one it is.

**Exception.** None.

### C3-29

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `conditional-framing` |
| Source | `types/common-rules.md` |

**Rule.** Rewrite conditional framing that hides a direct cause-and-effect fact as a direct declarative statement.

**Why.** Conditional framing presents an already-true fact about the system as a hypothetical the reader must first notice.

**Exception.** Framing genuinely conditional on the reader's own setup or choices, not on system behavior, does not need rewriting.

### C3-30

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `typographic-substitutes` |
| Source | `types/common-rules.md` |

**Rule.** Do not use a typographic character in place of the word it stands for in prose: ·, §, …, ×, ≥, ≤, ≠, ±, ≈, ∞, and the bullet characters •, ‣ and ⁃. Write the word.

**Why.** Each stands for a different word depending on where it sits, so the reader reconstructs a relation the sentence should have stated. "§" is "section" in one line and a paragraph mark in another. A screen reader says nothing useful for "·" or "≥", and a translator has no target for either. These were declared out of scope when C3-27 was added, on the true observation that none is an emoji or an arrow, but nobody checked where they sat: 261 of them were in prose on published pages, and 116 of those were a heading separator.

**Exception.** Code samples, code spans, link targets and HTML attribute values are out of scope, as they are for every prose rule. Box drawing characters are not covered at all: inside a fence they draw a diagram, and the fence is where they belong. The legal marks ©, ® and ™ are permitted, and so is ° in a temperature or an angle, which has no word form that reads better. Dashes belong to C3-05, not here.

## C4, code versus prose

Stated in: `types/common-rules.md`.

### C4-01

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** State the consequence before the implementation rule.

**Why.** A developer who understands what breaks can diagnose failures, one who only knows the rule cannot.

**Exception.** When the consequence is obvious from context, a brief rule-first statement is acceptable.

### C4-02

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `prose-guard-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** Show implementation guards as code, not as prose.

**Why.** A guard buried in a sentence may be missed, a code block is unambiguous.

**Exception.** None for guards, conditionals, and type checks.

### C4-03

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `placeholder-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** Use parameterized placeholders for user-supplied values in instructional code blocks. Reserve specific values for examples where the value itself is the point of the example.

**Why.** Specific values imply the value should be copied literally or is the recommended default.

**Exception.** Quick Reference and decision guide tables may use specific representative values to stay scannable.

### C4-04

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Show required values, conditional flags, and SDK options in code rather than describing them in sentences.

**Why.** A sentence describing an option is less actionable than a code snippet showing it in context.

**Exception.** A one-sentence prose definition before the code block is acceptable when introducing an option for the first time.

### C4-05

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `try-catch-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** Error handling patterns (try-catch) must appear in code examples that involve async operations or external calls.

**Why.** A code example without error handling is an implicit instruction to omit it, developers copy examples as-is.

**Exception.** Inline single-expression fragments do not require try-catch wrapping.

### C4-06

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** SDK error messages documented in troubleshooting entries must include the bad value or condition, the corrective action, and a link to help.

**Why.** A message that only names the error leaves the developer without a path to resolution.

**Exception.** Generic system errors not specific to the SDK do not require this format.

### C4-07

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `ui-element-bold` |
| Source | `types/common-rules.md` |

**Rule.** Write the name of a UI element (tab, button, menu item, screen, section, field, status badge, card action) in bold, never as inline code.

**Why.** Inline code tells the reader this is a literal they type or paste. A tab label is neither, so marking it as code sends them looking for it in a config file instead of on the screen.

**Exception.** A name the reader supplies or the product derives is a value, not a UI element, and stays in code.

### C4-08

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Bold is for a UI element the reader can see and read on the screen. Name an icon that carries no visible label, and shows its name only as a hover tooltip, in double quotes instead.

**Why.** Bold tells the reader to look for that text on the screen. An icon has no text to find, so bolding its tooltip sends them hunting for a label the app never displays.

**Exception.** A table or list whose own purpose is to document the literal tooltip string keeps bold in that table, because it quotes UI text rather than naming the icon. The exception covers only the table itself. Prose elsewhere on the page still names the icon in quotes, and a table documenting an icon's tooltip is evidence that the prose naming it has no visible label to bold.

## C5, cross-references

Stated in: `types/common-rules.md`.

### C5-01

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `callout-frequency` |
| Source | `types/common-rules.md` |

**Rule.** Classify every outbound callout as required, optional, or redundant.

**Why.** An unclassified callout interrupts reading flow without establishing whether the reader must act on it.

**Exception.** None, every callout must be classified before publishing.

### C5-02

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Required cross-references include a brief inline summary of the critical fact.

**Why.** A link without a summary places a context-switching cost on the developer.

**Exception.** For an extremely long referenced doc, a section anchor plus a one-sentence description of what to look for is acceptable.

### C5-03

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `callout-frequency` |
| Source | `types/common-rules.md` |

**Rule.** Optional cross-references are grouped at the end of the section or in Next Steps, not scattered mid-flow.

**Why.** Mid-flow optional links interrupt the primary task.

**Exception.** A parenthetical "(see also: X)" directly after the paragraph that mentioned it is acceptable.

### C5-04

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `duplicate-links` |
| Source | `types/common-rules.md` |

**Rule.** Remove cross-references that duplicate links already present in Prerequisites or Next Steps.

**Why.** A link that appears in three places adds noise, not three times the value.

**Exception.** A mandatory Prerequisites link may be repeated as a reminder in a subsection of a long doc.

### C5-05

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `additional-resource-phrasing` |
| Source | `types/common-rules.md` |

**Rule.** Phrase an Additional Resource callout as "For more information on <topic>, refer to the [Doc Name](url) documentation.", or "For detailed steps on <task>..." when the target carries a procedure.

**Why.** The fixed opener tells the reader within three words that the callout is optional reading, so they can skip the line without parsing it. A sentence leading with the target's contents reads as body prose.

**Exception.** A callout pointing at another section of the same page closes with "refer to the [Section Name](#anchor) section", because "documentation" names a separate document.

### C5-06

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** An instruction that routes the reader elsewhere must carry the destination. Give a link, a mailto address, or the named screen, and say what to do when you get there.

**Why.** "Raise a support request" or "ask an admin" names an action and then abandons the reader, who now has a second research task before they can act. The destination is usually one link, and the writer already knows it.

**Exception.** An instruction is exempt when the destination is genuinely outside Contentstack and unknowable from the docs, for example asking a colleague, a network administrator, or an internal IT team. Naming who to ask is then the whole of the available answer.

## C6, content accuracy and grouping

Stated in: `types/common-rules.md`.

### C6-01

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Heading names describe the actual content of the section, not aspirational or intended content.

**Why.** A heading that overpromises breaks the developer's trust the moment they see the mismatch.

**Exception.** None, rename the heading or scope the section to match.

### C6-02

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Items grouped in the same section must belong to the same category of thing.

**Why.** A developer scanning a section assumes its items are equivalent.

**Exception.** None, unlike items belong in their own sections with orientation text.

### C6-03

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `section-length-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** If a section grows beyond its heading's scope, rename the section or split it.

**Why.** An overgrown section misleads developers about what they will find and makes the doc harder to navigate by heading.

**Exception.** None.

### C6-04

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** Do not cite internal implementation details as justification for a claim, describe an internal endpoint and the credential it authenticates with, or state that a check fails open when it cannot reach the data it checks against.

**Why.** Internal identifiers are meaningless to the reader and go stale when the implementation changes. Fail-open behavior and internal credential models are worse than meaningless: they tell someone probing the product where a control stops holding, and no reader needs either fact to finish a task.

**Exception.** None for externally published docs. Internal-only engineering documentation, explicitly marked as such and never published, is not subject to this rule.

### C6-05

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** The first sentence of the Overview states what this page covers, in its own main clause. It does not open with a clause about another page's topic, and it does not leave the topic to a trailing result clause.

**Why.** The Overview's first sentence is where a reader decides whether this is the page they want. An opener that leads with a comparison to a different task, or that states background and reaches the topic only after "so", makes the reader work for an answer the sentence was supposed to give.

**Exception.** A page whose subject is the product itself may open by naming and defining the product, since that sentence already states the topic.

### C6-06

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `heading-uniformity` |
| Source | `types/common-rules.md` |

**Rule.** When the same category of change recurs across sibling sections, use one consistent heading name and table shape for every instance.

**Why.** A reader scanning several sibling sections for the same kind of fact should find it under the same heading every time.

**Exception.** A heading describing a behavior change unique to that instance is not subject to this rule.

### C6-07

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** A heading that is the only subsection under its parent, and does not belong to a recurring category, should be collapsed into a lead-in sentence.

**Why.** A heading with no siblings and no recurring counterpart elsewhere in the doc adds a navigation stop without adding scan value.

**Exception.** Keep the heading if the doc's table of contents or an existing cross-reference anchors directly to it.

### C6-08

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** A quantitative or capability claim must be verified against the current source of truth before publishing, and state the concrete verified fact.

**Why.** An unverified count or capability claim reads as confident and specific, but if wrong, actively misleads a reader who trusts the doc over checking the source.

**Exception.** If verification is not possible before publishing, state the claim as approximate or omit it.

## C7, duplication

Stated in: `types/common-rules.md`.

### C7-01

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `duplicate-sections` |
| Source | `types/common-rules.md` |

**Rule.** When two sections are near-identical, the second references the first and adds only what is genuinely different.

**Why.** Verbatim duplication creates maintenance debt, one copy goes stale silently.

**Exception.** Sections intended to be read in isolation may duplicate with an explicit mirroring note.

### C7-02

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** A fact stated in Prerequisites must not be restated mid-doc as a general reminder.

**Why.** A restated prerequisite reads as a second, possibly different requirement, and the reader cannot tell which statement is authoritative.

**Exception.** A second mention is acceptable when it links to the canonical statement rather than restating the fact, for example "see [Enable and disable a profile](#enable-and-disable-a-profile)". Distance alone is not an exception: a fact restated in full a hundred lines later is still two statements that can drift apart.

### C7-03

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** If two implementation patterns share the same underlying setup, one section is the source of truth and the other is a pointer to it.

**Why.** Keeping two full copies in sync across doc revisions is error-prone.

**Exception.** If the patterns differ in more than two meaningful ways, they are not near-identical and each gets full content.

### C7-04

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `table-restatement` |
| Source | `types/common-rules.md` |

**Rule.** When a table already documents an item, any callout, bullet, or paragraph within ten lines of that table must add only what the table cannot show, not restate the table's own cells.

**Why.** A reader who already read the table gains nothing from a block repeating its columns, and two copies of one fact double the maintenance surface. A callout restating one row also mis-signals, implying that row matters more than the rows no callout mentions.

**Exception.** A one-clause restatement is acceptable when it introduces the block's genuinely new content, avoiding an orphaned bullet or callout with no lead-in.

### C7-05

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** A callout or bolded paragraph placed beside a table must carry a fact the table does not. Restating a row in different words is still restating it.

**Why.** C7-04 catches a block that repeats a row's wording. A block can also repeat a row's meaning while sharing none of its words, which costs the reader the same second read and leaves the same two copies to maintain.

**Exception.** A block that states an instruction the table has no column for, such as what the reader should do about the row, adds a genuine fact. Move it into the table only when the table has somewhere to put it.

### C7-06

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** State a fact once on a page. Where a second mention is genuinely needed, make one statement canonical and have the others link to it rather than restating it.

**Why.** A fact stated three times in three sections gives the reader no way to tell which statement is authoritative, and the three copies drift apart the first time one of them is edited.

**Exception.** A second mention is acceptable when it links to the canonical statement rather than restating the fact, for example "see [Enable and disable a profile](#enable-and-disable-a-profile)". Distance alone is not an exception: a fact restated in full a hundred lines later is still two statements that can drift apart.

## C8, developer tone

Stated in: `types/common-rules.md`.

### C8-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not use empty superlatives (powerful, robust, comprehensive, seamless, effortless, best-in-class, world-class, industry-leading, cutting-edge, next-generation).

**Why.** These words describe perceived quality, not technical behavior, and signal the sentence was not written for a technical audience.

**Exception.** None.

### C8-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not make unmeasurable benefit promises ("saves you time," "eliminates complexity," "just works," "in under 5 minutes," "in minutes").

**Why.** Unverifiable claims erode trust.

**Exception.** A literally measurable, verified time claim is acceptable.

### C8-03

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not use emotional unlock language (unlock, empower, transform, revolutionize, supercharge, elevate).

**Why.** These verbs describe a feeling, not a technical outcome.

**Exception.** Acceptable only in marketing materials explicitly not developer documentation.

### C8-04

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not use vague readiness claims (production-ready, enterprise-grade, battle-tested, proven).

**Why.** These phrases claim a quality without specifying what it means.

**Exception.** None.

### C8-05

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not use out-of-the-box language ("out of the box," "zero-config," "plug-and-play").

**Why.** These phrases hide the actual default behavior.

**Exception.** None.

### C8-06

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not use vague AI or enterprise buzzwords (guardrails, agentic, mental model, single source of truth, filler end-to-end, opinionated, zero-downtime, re-platform, golden path, leverage, onboarding, paradigm, surface as a verb).

**Why.** Each word sounds technical but names no specific behavior, forcing the reader to infer meaning.

**Exception.** None.

### C8-07

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `acronym-first-use` |
| Source | `types/common-rules.md` |

**Rule.** Define acronyms on first use in introductory and setup sections (CDA, CMA, HMAC, OAuth, SSR, SSG, CSR, BFF, CDN, CI, CD, SSO).

**Why.** A reader who does not know an acronym must leave the doc to look it up.

**Exception.** In deep reference sections for senior engineers, industry-standard acronyms (OAuth, CI, CDN) may appear without expansion.

### C8-08

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `types/common-rules.md` |

**Rule.** Do not editorialize about the product's own defects. This covers calling a shipped control dead or pointless, saying a label or message misleads the reader, and asides about how the product reads to a customer.

**Why.** Telling a customer the product lies to them damages trust further than the defect does. The judgement also never survives the fix: when the defect is repaired the criticism is left behind, still published and now wrong.

**Exception.** None. A defect worth naming in a doc is worth filing for engineering. Record it there and document the current behavior neutrally.

### C8-09

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** State a real limit as a neutral fact: the boundary, when the reader meets it, and what to do instead. Do not frame the limit as the product failing the reader, or add that it gives no warning, does nothing, or acts silently.

**Why.** The reader needs the boundary in order to plan. Adverbs such as silently and quietly add no boundary, and phrasing a cap as a failure invites the reader to distrust every other limit on the page.

**Exception.** When the absence of a signal is itself the fact the reader must act on, state it plainly and once. A filtered view that looks empty but is not needs the reader to know that.

## C9, CLI command documentation

Stated in: `types/common-rules.md`.

### C9-01

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `cli-mutation-statement-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** State whether a CLI command mutates stack data or is read-only, in the Overview or Prerequisites, for any command that connects to a live stack.

**Why.** Developers using a scoped or shared management token need to know the blast radius before running an unfamiliar command.

**Exception.** Commands whose name unambiguously states the action may skip a standalone statement.

### C9-02

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `token-scope-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** Every Mandatory prerequisite that names a token must state the minimum required permission or scope inline, not only as a Troubleshooting root cause.

**Why.** Surfacing the required scope only after a failure forces the developer to fail first, then debug, then retry.

**Exception.** None.

### C9-03

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `all` |
| Check | `legacy-version-callout-heuristic` |
| Source | `types/common-rules.md` |

**Rule.** If a newer version of the documented command or tool exists, state that in one sentence at the top of the Overview with a link, in addition to any detailed comparison table elsewhere.

**Why.** A developer landing on a legacy version's page by search should not have to read the entire doc to discover a newer version exists.

**Exception.** Docs for the current or only version do not need this.

### C9-04

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `all` |
| Check | none, tier 3 is adjudicated |
| Source | `types/common-rules.md` |

**Rule.** State known coverage gaps in a Limitations section rather than leaving them implicit.

**Why.** A developer who assumes complete coverage from silence will not think to double check the gap until something breaks in production.

**Exception.** Tools with no known coverage gaps can omit the section.

## FM, front matter

Stated in: `section-order.json`, `parse-markdown.js`.

### FM-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `front-matter` |
| Source | `section-order.json` |

**Rule.** SEO front matter must include a title, a description, and a url.

**Why.** These are the machine-readable metadata fields every Section Order table marks as Required for search and indexing.

**Exception.** None.

### FM-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `front-matter` |
| Source | `parse-markdown.js` |

**Rule.** Every non-blank, non-list front matter line must be a valid key colon value pair.

**Why.** A malformed line (for example a stray heading marker prepended to a key) can silently drop that key from the parsed front matter.

**Exception.** YAML list item lines (leading dash) are not key-value pairs and are not flagged.

## MIG, migration guide specifics

Stated in: `types/migration-guide.md`.

### MIG-01

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `migration-guide` |
| Check | none, tier 3 is adjudicated |
| Source | `types/migration-guide.md` |

**Rule.** The Overview of a migration guide must state, in order: when the guide applies, what breaks, and what the reader gains.

**Why.** A developer landing on a migration guide needs an answer to "does this apply to me, and what do I have to do" in the first sentences.

**Exception.** None.

### MIG-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `migration-guide` |
| Check | `migration-specific` |
| Source | `types/migration-guide.md` |

**Rule.** Include a `version` field in the SEO front matter, holding the target version the guide applies to.

**Why.** Migration guides are version-specific, without the field search and indexing cannot distinguish guides for different upgrade paths.

**Exception.** None.

### MIG-03

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `migration-guide` |
| Check | `migration-before-after` |
| Source | `types/migration-guide.md` |

**Rule.** Every Main Content subsection must contain a Before block and an After block with labeled code examples.

**Why.** Developers migrating code need to see the old and new pattern side by side.

**Exception.** A subsection introducing a capability with no prior equivalent may state that explicitly instead of a Before block.

### MIG-04

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `migration-guide` |
| Check | `migration-specific` |
| Source | `types/migration-guide.md` |

**Rule.** The Type Mapping Reference is a table with minimum columns Area, old API identifier with version label, new API identifier with version label.

**Why.** A table lets developers scan the old column for what to replace, then read across to the new column.

**Exception.** A two-row table is valid if fewer than three identifiers changed.

### MIG-05

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `migration-guide` |
| Check | `type-mapping-row-grouping` |
| Source | `types/migration-guide.md` |

**Rule.** Each row in the Type Mapping Reference covers one renamed or replaced identifier, do not group multiple renames into one row.

**Why.** A grouped row prevents developers from searching the table for a single identifier and finding a clean match.

**Exception.** None.

### MIG-06

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `migration-guide` |
| Check | `migration-specific` |
| Source | `types/migration-guide.md` |

**Rule.** The Pre-Upgrade Checklist is an ordered list of single, discrete actions, each linking to the subsection covering the full change.

**Why.** The checklist is a completeness tool, an item without a link requires searching the doc, a bundled item cannot be checked off independently.

**Exception.** Test-and-verify steps at the end without a corresponding doc section do not need subsection links.

### MIG-07

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `migration-guide` |
| Check | none, tier 3 is adjudicated |
| Source | `types/migration-guide.md` |

**Rule.** The Gradual Migration section, if present, must state what the adapter does not restore.

**Why.** An adapter that appears to solve the migration without caveats creates false confidence.

**Exception.** None.

### MIG-08

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `migration-guide` |
| Check | `section-structure` |
| Source | `types/migration-guide.md` |

**Rule.** Do not include theory sections in migration guides.

**Why.** A developer performing a migration is executing a task under time pressure, background belongs in a linked conceptual doc.

**Exception.** A one-sentence orientation in the Overview is acceptable if it prevents a common misunderstanding.

### MIG-09

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `migration-guide` |
| Check | none, tier 3 is adjudicated |
| Source | `types/migration-guide.md` |

**Rule.** Prose describing what both the old and new version do for the same fact must state each version as its own explicitly labeled V1/V2 statement, not blended sentences.

**Why.** A migrating developer needs to know exactly what changed, if the old version's behavior is only implied by contrast, the reader must reverse-engineer it.

**Exception.** Does not apply to Before/After code blocks or Type Mapping Reference rows, which already separate old and new by construction.

## RS1, role-based routing

Stated in: `types/getting-started.md`.

### RS1-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `getting-started` |
| Check | `getting-started-specific` |
| Source | `types/getting-started.md` |

**Rule.** The Role-Based Routing Table comes immediately after the Overview, before Prerequisites and Quick Start.

**Why.** Developers who already know their goal should not read through the Quick Start to find their entry point.

**Exception.** If all developers share a single entry path with no branching, replace the table with one sentence pointing to the Quick Start.

### RS1-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `getting-started` |
| Check | `getting-started-specific` |
| Source | `types/getting-started.md` |

**Rule.** The Role-Based Routing Table has three columns: "I want to...", "I am...", and "Start here", and "Start here" links directly to the first doc in that path.

**Why.** Goal alone is insufficient to route developers whose goal maps to different starting points depending on role.

**Exception.** None.

### RS1-03

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `getting-started` |
| Check | none, tier 3 is adjudicated |
| Source | `types/getting-started.md` |

**Rule.** The Documentation Map is organized by developer goal, not by doc type.

**Why.** A developer arriving here does not know the doc taxonomy, only what they are trying to build.

**Exception.** None, do not use doc type as a primary organizing dimension.

### RS1-04

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `getting-started` |
| Check | `bare-links` |
| Source | `types/getting-started.md` |

**Rule.** Every link in the Role-Based Routing Table and Documentation Map must include a one-sentence description.

**Why.** A bare link forces the developer to click before knowing whether the destination is relevant.

**Exception.** None.

## RS2, quick start constraints

Stated in: `types/getting-started.md`.

### RS2-01

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `getting-started` |
| Check | none, tier 3 is adjudicated |
| Source | `types/getting-started.md` |

**Rule.** The Quick Start covers one path only, the most common one, and does not branch.

**Why.** A Quick Start covering multiple paths requires reading all of it to find the relevant parts.

**Exception.** Two paths sharing identical steps up to a single fork may show the fork as a one-line conditional at that step.

### RS2-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `getting-started` |
| Check | `getting-started-specific` |
| Source | `types/getting-started.md` |

**Rule.** State the time estimate in the Quick Start heading or immediately below it, in the form "Estimated time: X minutes."

**Why.** Developers decide whether to attempt a Quick Start based on available time.

**Exception.** If time varies significantly by environment, state a range and link to the prerequisite causing the variance.

### RS2-03

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `getting-started` |
| Check | `quick-start-verification` |
| Source | `types/getting-started.md` |

**Rule.** The Quick Start must end with a verifiable, observable outcome.

**Why.** Without a success state, the developer cannot tell whether they completed it correctly.

**Exception.** None.

### RS2-04

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `getting-started` |
| Check | `getting-started-specific` |
| Source | `types/getting-started.md` |

**Rule.** The Quick Start covers at most 10 steps.

**Why.** More than 10 steps signals the Quick Start is actually a full setup guide.

**Exception.** None, split the content instead of exceeding the limit.

## RS3, what a get started guide excludes

Stated in: `types/getting-started.md`.

### RS3-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `getting-started` |
| Check | `getting-started-specific` |
| Source | `types/getting-started.md` |

**Rule.** No theory sections, link to the relevant conceptual guide instead.

**Why.** The Get Started Guide is an entry point, not a teaching doc, theory delays the first working outcome.

**Exception.** One sentence of orientation in the Overview is acceptable if it prevents a common, blocking misunderstanding.

### RS3-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `getting-started` |
| Check | `getting-started-specific` |
| Source | `types/getting-started.md` |

**Rule.** No troubleshooting section, resolutions for Quick Start failures belong in the linked setup guide or feature doc.

**Why.** Troubleshooting blurs the "start here" signal with "debug here" content and inflates page length for first-time visitors.

**Exception.** A single inline one-sentence callout for a known, blocking, platform-specific failure is acceptable at the step where it occurs.

### RS3-03

| Field | Value |
| --- | --- |
| Tier | 3 |
| Doc types | `getting-started` |
| Check | none, tier 3 is adjudicated |
| Source | `types/getting-started.md` |

**Rule.** No feature explanation beyond what is needed to complete the Quick Start.

**Why.** The Get Started Guide is not a feature tour, feature explanation belongs in feature docs.

**Exception.** None.

## CLI, shared CLI rules

Stated in: `cli-templates/cli-common-rules.md`, `cli-templates/cli-command-reference.md`.

### CLI-01

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-specific` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** A flag or option table must use the columns Flag, Type, Required, Default, Description, Notes, in that order.

**Why.** CLI-C2 extends C9's four columns with the two the CLI needs. Type and Default are facts a reader checks before running a command, and the CLI declares 62 explicit flag defaults across its V2 plugins. 16 distinct column signatures are in use across the CLI docs, and 106 of the 167 tables already carry Type and Default, so the six-column shape is also the closest to current practice.

**Exception.** A table with only one or two flags and no caveats may use a two-column Flag and Description format, per C9.

### CLI-02

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook` |
| Check | `cli-specific` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** A CLI command reference or task runbook must have a Prerequisites section.

**Why.** Every CLI command needs at minimum the CLI installed, an authenticated session, and a configured region, because the base command class throws without them. A doc that omits Prerequisites lets a reader start and fail.

**Exception.** A module reference runs no command and deliberately has none.

### CLI-03

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-specific` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Prerequisites must be an H2, not nested under another section.

**Why.** The section-order comparison reads H2 text only, so a Prerequisites heading at H3 or H4 registers as missing rather than as misleveled, and the two need different fixes. At H4 it is also absent from the page navigation.

**Exception.** None.

### CLI-04

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-specific` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Each Prerequisites item links to the resource that fulfils it.

**Why.** A prerequisite the reader cannot act on is a blocker rather than a requirement.

**Exception.** A bare version requirement such as a Node.js version may have no link target.

### CLI-05

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-specific` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** No CLI doc uses H4 or deeper. Where a fourth level of structure is needed, use a bold lead-in on its own line.

**Why.** The docs platform emits an anchor id and a right-hand navigation entry for H2 and H3 only, so an H4 is unlinkable and absent from the page's own navigation whatever it contains. This is a fact about the rendering platform rather than about a template, so it binds on every CLI doc including ones typed migration-guide, feature-doc or setup-guide. CLI Authentication and Adding Tokens puts all seven auth procedures at H4, which is why 26 inbound deep links across the corpus resolve to nothing.

**Exception.** None. A bold lead-in carries no anchor either, so content that genuinely needs to be linked to should be promoted to H3.

### CLI-06

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-specific` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Tag shell code fences bash and payload fences json.

**Why.** All 1,782 fences in the CLI corpus are untagged, so nothing highlights and a reader cannot tell a command from a JSON payload at a glance.

**Exception.** Output transcripts and directory trees have no meaningful language tag.

### CLI-07

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference` |
| Check | `cli-specific` |
| Source | `cli-templates/cli-command-reference.md` |

**Rule.** A doc that instructs the reader to run plugins:install must carry an Installation section.

**Why.** An install step the reader has to hunt for is an install step they skip, and the command then fails as command not found. Whether a plugin is bundled is a fact about oclif.plugins rather than about the page, so a script can only enforce this direction of CMD4.

**Exception.** A doc that mentions plugins:install only as an aside about a different plugin.

### CLI-08

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-flag-prose-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Write user-supplied values as <UPPER_SNAKE_CASE>. Do not use double angle brackets.

**Why.** The corpus splits 41 against 40 between the two forms, so this has never been decided and both appear in sibling docs. Single angle brackets with upper snake case is the form C4 already mandates product-wide, so the CLI follows rather than inventing a second convention.

**Exception.** A literal value that is the point of the example, per C4, is not a placeholder.

### CLI-09

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `callout-taxonomy` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Callout labels put the colon inside the bold, as > **Note:** rather than > **Note**:.

**Why.** The corpus splits 218 against 82, so the majority form is established and the minority form is drift rather than a competing convention. The four permitted labels are the closed set in common-rules.md.

**Exception.** None.

### CLI-10

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-error-entry-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** No shell prompt inside a code fence. Write csdx cm:stacks:export, not $ csdx cm:stacks:export.

**Why.** A reader copies the whole line, and a leading dollar sign makes the paste fail while adding nothing, because the fence already establishes that the line is a command. The corpus is 1,247 against 2, so this codifies existing practice.

**Exception.** A transcript that deliberately shows both input and output may keep the prompt, because there the prompt is what separates the two.

### CLI-11

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-command-form-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Recurring section names are plural: Limitations, Troubleshooting, Next Steps.

**Why.** These names are the anchor targets other docs link to. A singular variant produces a different anchor id, so a link written against the plural form silently resolves to nothing. Current splits are 22 against 4, 16 against 6, and 12 against 2.

**Exception.** None. The plural is the form every template's Section Order table uses.

### CLI-12

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-scope-statement-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** State whether the documented commands mutate stack data or are read-only, in the Overview or Prerequisites.

**Why.** This is C9's first rule, restated because it binds on task runbooks as hard as on command references. These are the docs that export, overwrite and delete stack content across more than one command, so a reader who misjudges the blast radius damages a stack rather than getting a failed command.

**Exception.** Commands whose name unambiguously states the action may skip a standalone statement, per C9.

### CLI-13

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook` |
| Check | `cli-auth-step-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Prerequisites state, in order: CLI installed with the Node version from engines.node, csdx auth:login, region configured. Add a management token via csdx auth:tokens:add with its minimum scope stated inline when any documented command takes --alias, and csdx plugins:install when the plugin is absent from oclif.plugins.

**Why.** The first three are not editorial choices. The base command class every command extends throws when email is unset and exits when region is unset, so a reader missing either fails before their command runs. A fixed order means a reader who has read one CLI doc can skim the section in the next.

**Exception.** A module reference runs no command and has no Prerequisites section, per MOD3.

### CLI-14

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-placeholder-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Any claim that a flag, command or behavior was added, renamed or removed in a given version cites the changelog and names the version.

**Why.** The CLI's public surface moved substantially at 2.0.0: short flags were removed across six plugins, --api-version was dropped from two bulk commands, and tsgen's --token-alias became --alias. A doc describing a flag GA removed reads as authoritative and sends the reader to a command that fails. The changelog is the source of record, not package.json in a local clone, which can sit behind the released version.

**Exception.** None. If a version cannot be verified before publishing, omit the claim rather than approximating it.

### CLI-15

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-exit-code-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** A doc derived from a previous version's page must have every flag name, flag description and worked example re-verified against the released manifest for the version being documented.

**Why.** Migrate your Content using the CLI Migration Command \| V2.x.x was created from a correct V1 page and shipped documenting --config-file, which GA removed, while describing --config as doing what --inline-config now does. Both worked examples were wrong. Nothing looked wrong because every sentence had once been true. --config kept its name and changed its meaning, which no name diff catches and no reader can detect, since a V1 script still parses.

**Exception.** None.

### CLI-16

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `banned-phrases` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** A doc must not assert that documentation does not exist. Do not write that a guide is missing, planned, coming soon or yet to come. If a topic has no guide, omit the topic rather than announcing the gap.

**Why.** An absence claim outlives the gap it describes, because no publishing step revisits it. Both Install the CLI pages said the guide to create a plugin was yet to come, and pointed readers at oclif's own documentation instead, while Create Custom CLI Plugins for Contentstack was live in both versions at roughly 1,030 and 770 lines and present in the sidebar. A developer looking for CLI 2.0.0 plugin information read the note, concluded Contentstack had no plugin docs, and built their plugin from the source repo and oclif's docs. The note answered the question wrongly on the page where the question is first asked, so the reader never reached the guide two clicks away. CLI-10 and CLI-15 govern claims about a product that has moved on. This governs claims about the documentation itself, which go stale the same way.

**Exception.** A deprecation notice pointing at a live replacement is not an absence claim.

### CLI-17

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `all` |
| Check | `internal-link-form` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** Links to the Contentstack docs site must be root-relative, /docs/headless-cms/install-the-cli, never absolute. Links to the application and to third parties stay absolute.

**Why.** An absolute docs link resolves to production from every environment, so a reader reviewing on staging is thrown back to production the moment they click one, and a link path cannot be reviewed before it ships. Nine such links were in the corpus, and one of them also pointed at the wrong version: Create Custom CLI Plugins for Contentstack \| V1.x.x linked the V2 install page, so a V1 reader landed on 2.0.0 instructions. The word relative appeared exactly once in the whole standard before this rule, inside C2-04, which is about Quick Reference tables only, and no check anywhere tested for http:// at all.

**Exception.** The application at contentstack.com/login and any third-party host. Neither is environment mirrored and neither has a relative form.

### CLI-18

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-plugin-boundary-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** No CLI doc, old or new, carries a page-level Troubleshooting H2. Every failure mode belongs in the CLI troubleshooting hub. Link the reader there instead, in whichever section fits the page.

**Why.** The CLI troubleshooting hub already holds 30 ticket-sourced articles across five groups. A Troubleshooting section copied onto every command page that can produce a given error goes stale in as many places as it was copied, while one hub entry linked from every page that can hit it stays current when the error message or the fix changes.

**Exception.** None. See CLI-19 for the machine-checked half of this rule.

### CLI-19

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `section-structure` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** A CLI command reference, task runbook, or module reference must not carry a page-level Troubleshooting section. Link the CLI troubleshooting hub instead.

**Why.** The CLI troubleshooting hub already holds 30 ticket-sourced articles across five groups. A Troubleshooting section on a CLI page duplicates content that goes stale wherever it is copied, and the hub is the one place a reader searching an error message is likely to land.

**Exception.** None.

### CLI-20

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-command-reference`, `cli-task-runbook`, `cli-module-reference` |
| Check | `cli-version-drift-heuristic` |
| Source | `cli-templates/cli-common-rules.md` |

**Rule.** A code-sourced Limitations finding must be classified before it is published: a boundary on function (a closed list, an unsupported operation, a safely-rejected input format) is a limitation and gets written. A weakness in how the CLI protects data (a secret exposed via argv, disk, or logs, unsanitized input reaching a shell or file path, encryption or auth that is off by default, a check that fails open) is a possible vulnerability and does not get published anywhere in the docs. When unsure, treat it as a vulnerability and report it to whoever asked for the pass instead.

**Why.** A docs site is public, indexed, and not reviewed by a security team before it ships, so it is the wrong place for a vulnerability to surface first. "The CLI cannot do X" and "the CLI does X in a way that leaks Y" read as the same sentence shape from outside the code, so a pass built to find limitations can walk into a vulnerability without noticing unless it reads past the matched line into the surrounding function.

**Exception.** A vulnerability already publicly disclosed, such as a fixed CVE or a changelog entry describing the fix, is fine to reference as a version-specific claim per CLI-C10.

## PLG, plugin guide specifics

Stated in: `cli-templates/cli-plugin-guide.md`.

### PLG-01

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-plugin-guide` |
| Check | `plugin-scaffold-heuristic` |
| Source | `cli-templates/cli-plugin-guide.md` |

**Rule.** The directory layout in Plugin Structure uses real file and folder names exactly as the CLI plugin scaffolding creates them, such as src/commands/ and oclif.manifest.json, not renamed or reorganized for readability.

**Why.** A reader building their first plugin is about to create these exact files. A paraphrased layout either does not match what their scaffolding tool produces, or leaves out a file the plugin will not load without.

**Exception.** None.

### PLG-02

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-plugin-guide` |
| Check | `plugin-manifest-heuristic` |
| Source | `cli-templates/cli-plugin-guide.md` |

**Rule.** A TypeScript example under Creating a Plugin or Commands and Flags is a complete, compilable command class, not a fragment that only illustrates a shape.

**Why.** The reader pastes this into a file and builds it. A fragment that reads correctly but does not compile fails at the moment a plugin guide most needs to work, before the reader has anything running to debug from.

**Exception.** A snippet explicitly introduced as showing one option in isolation does not need to be a full class, provided the surrounding prose says so.

### PLG-03

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-plugin-guide` |
| Check | `plugin-publish-heuristic` |
| Source | `cli-templates/cli-plugin-guide.md` |

**Rule.** Plugin Registration and Linking includes a command the reader runs to confirm the plugin loaded, not only the linking command itself.

**Why.** A linking command succeeding is not the same as the new command being usable. A namespace collision or a skipped build step fails silently otherwise, and the reader spends the rest of the guide debugging a step that already went wrong.

**Exception.** None.

### PLG-04

| Field | Value |
| --- | --- |
| Tier | 2 |
| Doc types | `cli-plugin-guide` |
| Check | `plugin-test-heuristic` |
| Source | `cli-templates/cli-plugin-guide.md` |

**Rule.** A reference section such as Available Methods and Utilities, where it runs long enough that a reader would scroll past what they need, opens with a table mapping each method or utility to its subsection.

**Why.** The same reasoning as MOD2, restated for the one section in this type shaped like a lookup page rather than a procedure. A developer skimming for one method should not have to read the whole appendix to find it.

**Exception.** A reference section short enough to read in full does not need an index.

### PLG-05

| Field | Value |
| --- | --- |
| Tier | 1 |
| Doc types | `cli-plugin-guide` |
| Check | `section-structure` |
| Source | `cli-templates/cli-plugin-guide.md` |

**Rule.** Do not add a Troubleshooting H2 to this type. Link the CLI troubleshooting hub instead, per CLI-C14.

**Why.** Same reason as the other CLI types: one entry in the hub stays current, a copy on this page does not.

**Exception.** None. checks/section-structure.js reports CLI-19 if one is added back.

