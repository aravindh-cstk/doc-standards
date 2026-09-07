# Where the usage-guide anatomy comes from

This file records why each section in `api-ref-usage-guide-v2.md` exists, and how strong the evidence
behind it is. Read it before changing the section order, dropping a required section, or adding one.

Neither `api-ref-class-v2.md` nor `api-ref-method-v2.md` has an equivalent file. Their derivation is
reconstructible from the source corpora but was never written down, which is why the rationale for
several of their sections now lives only in the templates themselves.

---

## Read this first: the evidence here is thinner than it was for the class and method templates

The class and method templates rest on a large counted corpus:

| Source | Volume | What it covers |
| --- | --- | --- |
| `issues-output/jira.md` | 106 SDK tickets filtered to `SDK=Yes AND DocUpdate=Yes` | 37 high criticality, 69 medium |
| `issues-output/slack.md` | 111 substantive `support-sdk` threads, from 945 messages across 120 threads | 26 high, 61 medium, 24 low |
| `issues-output/support.md` | 73 Salesforce support tickets | 10 high, 55 medium, 8 low |

**Roughly 98% of that corpus is about reference-level gaps.** Counting mentions of a guide, tutorial,
or quickstart page as the failing doc:

| Corpus | Items | Guide-targeted |
| --- | --- | --- |
| `jira.md` | 106 | 0 |
| `support.md` | 73 | 0 literal, though SUP-0049 and SUP-0054 both cite a `get-started-with-*-sdk` URL as the page that failed them |
| `slack.md` | 111 | 2 (SLK-0027, SLK-0048) |

The competitor benchmark does not fill the gap either. `research-plan.md` planned four dimensions
that would have captured it (A on separation of reference from guides and tutorials, B on quickstart
existence and time-to-first-call, G, and H on developer onboarding flow), but the 110 generated
competitor profiles only carry three sections: Structure, Code Snippets, and Interactive Features.
Searching all 110 profiles for guide, getting started, tutorial, quickstart, or learning path returns
two hits, neither of them an analysis.

So the sections below fall into two classes, and the anatomy file's required sections deliberately
include both:

- **Counted-ticket grounding.** The fact was named in support signals that can be tallied. Sections
  4, 10, and 11.
- **Behavioral and structural grounding.** The fact rests on Clarity session data, competitor
  structure, and defects observable in the live pages, without a ticket count behind it. Sections 5,
  6, 7, 8, and 9.

Neither class is speculative, but the second is weaker, and a future revision that contradicts it
should be argued on evidence rather than blocked by this file.

---

## Part 1: The behavioral data

Two sources, both measuring the pages this template replaces.

### `Doc-Revamp/js-cda-dash.csv`

A raw Microsoft Clarity dashboard export for the JavaScript browser Delivery SDK reference index.

| Metric | Value |
| --- | --- |
| Total sessions | 1,378 (76 bot) |
| Pages per session | 11.39 |
| Average scroll depth | **28.85%** |
| Dead clicks | **408 (29.63%)** |
| Quick-back clicks | **324 (23.53%)** |
| Rage clicks | 31 (2.25%) |
| Excessive scrolling | 2 (0.15%) |

### `issues-output/sdk-clarity-reports/typescript/clarity-scorecard.csv`

Only 2 of 32 target URLs returned data, so this is a small sample, but the contrast is sharp.

| URL | Traffic | Dead clicks | Quick-backs | `doc_risk_score` |
| --- | --- | --- | --- | --- |
| `/content-delivery-sdk/typescript/reference` | 801 | 445 | 371 | **0.44** |
| `/content-delivery-sdk/python/reference` | 120 | 12 | 5 | 0.22 |

The TypeScript reference index carries the highest risk score of every SDK page measured.

### The rubric that turns those numbers into sections

`Doc-Revamp/clarity-plan.md` Phase 5 defines how to read each signal. Quoted verbatim, in a fenced
block because the source punctuation does not follow this repo's house style:

```
High traffic + high quick-backs / low engagement time → likely mismatch with intent
(title/H1, first screen content, wrong page ranking, missing "you are here" orientation).

High dead clicks on UI-like elements → affordance problems (buttons that are not
buttons, non-copyable code blocks, broken anchors).

High excessive scroll → information scent issues (long unstructured reference,
missing TOC, missing on-page search, poor heading hierarchy).

Low scroll depth but long page → early exit; inspect first 1–2 screens for
prerequisites, language clarity, and "minimum working example" placement.
```

Mapping each measured signal to the section that answers it:

| Signal | Rubric reading | Section it produced |
| --- | --- | --- |
| 23.53% quick-backs | Intent mismatch, missing "you are here" orientation | 4, Before you begin |
| 28.85% scroll depth | Early exit, check the first screens for a minimum working example | 5, Minimum Working Example, and the rule that nothing load-bearing goes at the bottom of the page |
| 29.63% dead clicks | Affordance problems, broken anchors | 7 and 8, and specifically the rules that every Class cell is a link and every Task Index link resolves |
| `doc_risk_score` 0.44 on the reference index | Highest-risk page in the set | The decision to build this template at all |

The 28.85% figure is the most load-bearing number in the anatomy. It is why the required section
order front-loads orientation, a working snippet, and both navigation tables, and why the template
forbids a closing Additional Resources section.

---

## Part 2: Section-by-section derivation

### The starting condition

The live `sdk_usage_guides` entry for the TypeScript Delivery SDK
(`Doc-Revamp/docs/typescript-delivery-sdk-api-reference/usage-guide.md`) is 155 bytes in full:

```markdown
---
uid: blt82ccaf40248d1b61
content_type: sdk_usage_guides
locale: en-us
updated_at: 2026-02-18T13:02:41.985Z
---

# TypeScript Delivery SDK API Reference
```

A title and nothing else. The content-type census across the whole scrape:

| `content_type` | Files |
| --- | --- |
| `method_details` | 119 |
| `classes_reference` | 12 |
| `docs_article` | 2 |
| `sdk_usage_guides` | **1, empty** |

Per `config/entries.yaml`, `sdk_usage_guides` sits between the SDK landing page and
`classes_reference` in the reference chain. So the page every developer reaches before any class page
has no body.

### Section 4: Before you begin

**Evidence class: counted tickets.** Three facts, three separate lines of evidence.

*The Get Started link.* SUP-0049 and SUP-0054 are both cases of a developer working from a
`get-started-with-*-sdk` page and failing. SUP-0049: "They followed the sample code provided in our
documentation exactly ... They used a freshly generated Management Token but are encountering
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`." The 23.53% quick-back rate is the same failure at population
scale.

*The runtime versions.* SLK-0027 is one of only two guide-targeted threads in the entire Slack
corpus. A Dart SDK that does not support Dart 3.0+, filed against "Content Delivery SDK / Dart /
Getting started & requirements". SLK-0048 is the other: wrong Maven coordinates in the Java
Management SDK docs, filed against "Management SDK / Java / Get started + reference (Maven
dependency)". Both of the only two guide-targeted signals in the corpus are version and compatibility
facts, which is why they are required here rather than optional.

*The documented SDK version and changelog link.* `version_upgrade_regression` is 11 of 73 support
tickets, and versioning appears in 7 Jira tickets and 8 Slack threads (STD-VERSIONING). Three
concrete cases:

- SLK-0014 and SUP-0003, the same incident from two channels: Management SDK v1.9.2 broke the
  previous global-field update pattern. SUP-0003 records that the "user requested to update the
  docs."
- SLK-0032: RTE HTML stopped rendering after an SDK upgrade from v1.4.1 to v3.1.2. The recorded gap
  is "No clear mapping in docs between SDK package versions and RTE HTML rendering behavior."
- SUP-0017: a doc improvement asking to "Publish a version migration guide with breaking changes,
  rollback steps, and before/after code examples."

`config/support_taxonomy.yaml` carries that last line as its `version_upgrade_regression` high
severity `recommendation_template`, which is how it reached the support corpus in the first place.

**A design change recorded here.** An earlier draft of this anatomy put these facts in a standalone
"Version and Compatibility" section near the bottom of the page. That contradicted the 28.85%
scroll-depth finding, so they folded into the Before you begin block instead. The section count
dropped from 13 to 11 in the same change.

### Section 5: Minimum Working Example

**Evidence class: behavioral.** Directly from the fourth rubric line quoted above, which reads low
scroll depth on a long page as an early exit and prescribes inspecting the first one or two screens
for prerequisites, language clarity, and "minimum working example" placement. The phrase "minimum
working example" is the plan's own, and this section is it.

Supporting structural evidence from `output/benchmark-run-2026-06-14/benchmark-scorecard.csv`:
Contentstack's own row records `shows_imports: False` and `shows_auth: False`. Neither the imports
nor the authentication step appear in the documented snippets, so a reader cannot run what they copy.
The rule that this snippet includes imports and uses the canonical placeholder tokens comes from
there, plus `doc-structure/code-snippet-rules`, which fixes the token list (`API_KEY`,
`DELIVERY_TOKEN`, `ASSET_UID`, `ENTRY_UID`, `ENVIRONMENT`, `MANAGEMENT_TOKEN`, `BRANCH_UID`) and
forbids hardcoding.

The rule that the snippet's error handling must match what the SDK actually does is inherited from
`api-ref-method-v2.md`, which states it for method pages: "A page that instructs the reader to check
for `error` and then shows a bare `try` and `except` teaches the opposite of what it says, and the
example is what gets copied."

### Section 6: SDK Structure

**Evidence class: structural.** From `final.md` and `manager-report.md`, across 110 benchmarked
documentation sets:

| Structural pattern | Companies |
| --- | --- |
| Category or resource grouping | 102 |
| Class to method hierarchy | **3** (Supabase, Supabase Auth, Cloudinary) |
| Flat endpoint list | 4 |

`final.md` states the conclusion: Contentstack uses a class to method hierarchy that only 3 other
benchmarked companies use, so its structural philosophy is in the minority, and most of the industry
organizes documentation around REST resources and endpoints rather than SDK objects.

A developer arriving with a REST mental model therefore has no reason to expect the builder pattern,
and nothing else on the page tells them. Hence the requirement to state it explicitly rather than let
the class list imply it.

The section's second job, explaining that a chainable setter fails on the terminal call rather than
where the argument was passed, is inherited from `api-ref-method-v2.md`'s "Where the error surfaces"
rule. Stating it once here prevents the reader from misreading every Validation section in the
reference below.

### Section 7: Class Overview

**Evidence class: behavioral.** The 29.63% dead-click rate, read through the rubric line "High dead
clicks on UI-like elements to affordance problems (buttons that are not buttons, non-copyable code
blocks, broken anchors)." A class name rendered as plain text on the reference landing page is
exactly that: readers click it, nothing happens, and there is no other route to the class page.

Structurally the table is the usage guide's analogue of the class page's Method Index, so it inherits
that section's two hardest rules and the reasoning behind them, from `AR-08` and `AR-09`: it is the
sole list of classes, and every class appears exactly once. `AR-09`'s rationale transfers directly. A
class absent from the index is unreachable in the rendered page, and a class listed twice implies two
classes.

The "Accessed via shows the immediate call only" rule comes from the existing draft at
`Doc-Revamp/templates/base/api-reference-intro-template.md`, which already stated it.

### Section 8: Task Index

**Evidence class: counted tickets plus structural.** The strongest single recommendation in the
support corpus, and the one section with no equivalent in the existing draft.

`documentation_discoverability` is 13 of 73 support tickets, the second largest theme. Its two
`recommendation_template` strings in `config/support_taxonomy.yaml`, which is what generated the
"Doc improvement" field on those tickets:

- Medium severity: "Improve doc navigation with scenario-based guides and direct API-reference
  cross-links."
- High severity: "Create a task-based docs hub that links all critical implementation paths and
  troubleshooting content."

The medium-severity string is the most repeated guide-related doc improvement in `support.md`,
appearing on 11 tickets.

`manager-report.md` recommendation 3 asks for the same thing from the competitor side: improve
discoverability for REST-background developers by adding a resource or category view as an
alternative navigation to the class to method hierarchy, explicitly not replacing it, just offering a
second entry point. The Task Index is that second entry point, which is why the anatomy keeps both
tables rather than choosing between them.

`slack.md`'s STD-CLARITY standard covers the same ground from the thread side, at 11 threads: "Lead
each method with a clear purpose statement, when-to-use guidance, and cross-links to related
methods/concepts."

### Section 9: Key Usage Patterns

**Evidence class: counted tickets plus structural.** STD-EXAMPLES in `slack.md`, at 7 threads:
"Provide a runnable, copy-pasteable example for every method in each supported language, showing
realistic inputs and the expected response/output."

The named-scenario-title rule and the ban on titles like "Example 1" are inherited from
`api-ref-method-v2.md`, which applies the same rule at the method tier with its own list of correct
and incorrect titles.

The floor of three examples comes from the existing draft. The competitor comparison argues it should
be higher over time: `manager-report.md` recommendation 2 asks to adopt Supabase's approach of 8 to
13 named scenarios per method, and `final.md` records multi-language and multi-scenario examples as
the one area where benchmarked competitors pull ahead of Contentstack (Algolia at 12 languages,
SendGrid at 7, Cloudinary at 2, Contentstack at 1). The scorecard confirms Contentstack's row:
`snippet_languages: 1`, `has_language_tabs: no`.

Three is therefore the floor, not the target, and that is how the anatomy words it.

### Section 10: SDK-Wide Notes

**Evidence class: counted tickets.** This section is the top rung of the deduplication ladder, and
each note traces to a distinct theme.

*Authentication and token type, and its required warning.* Authentication is the single largest theme
in the Jira corpus:

| `jira.md` theme | Tickets |
| --- | --- |
| **Auth and token scope** | **38** |
| Input validation and parameters | 26 |
| General SDK behavior clarity | 15 |
| Environment and endpoint setup | 13 |
| Versioning and migration | 7 |
| Retry, timeout, and limits | 7 |

`authentication_and_tokens` is a further 7 of 73 support tickets. The specific warning text comes
from a documented pattern rather than a guess. `Doc-Revamp/templates/typescript-delivery-sdk-get-started-template.md`
carries it as a `[REQUIRED]` block with its sources named inline:

> "TOKEN-TYPE WARNING [REQUIRED]: This warning must be present. It is a top support ticket pattern:
> developers who accidentally use a Management Token or Preview Token instead of a Delivery Token
> receive error code 109 ("We can't find that Stack") with no clear explanation. Source: SUP-0055,
> DX-1200."

SUP-0045 in `support.md` is that exact failure recorded independently: `error_code 109, status 412,
api_key: ['is not valid.']`. STD-AUTH in `slack.md` states the standard: "State the auth/token type,
required scope/permissions, and exactly where it is passed for every method."

*Regions and endpoints.* 13 Jira tickets under "Environment and endpoint setup", plus 5 support
tickets under `environment_region_endpoint`. STD-REGION in `slack.md`: "Show region/endpoint/
environment configuration for each method, with per-region base-URL examples." The live TypeScript
Get Started page carries a broken region enum placeholder (`Region.>` rather than real enum values),
recorded as fix 2 in its template's KEY FIXES list.

*Rate limiting and retry.* 7 Jira tickets and STD-LIMITS at 13 threads. SLK-0006 is the concrete
case: a 429 during a Launch build, where the recorded gap is that the Management SDK reference for
`entry().query().find()` "does not document CMA rate limits (429), the absence of
auto-pagination/throttling, or that bulk `find()` can exceed rate limits." DX-175 asks to "Document
SDK retry/timeouts and rate-limit handling with expected responses and recommended backoff settings."
`support_taxonomy.yaml` carries the `performance_rate_limit_retry` high-severity template: "Add
performance and retry guidance with backoff defaults, timeout strategy, and rate-limit recovery
patterns."

The both-branches wording ("does auto-retry" and "does not auto-retry") is copied verbatim from
`api-ref-class-v2.md` rather than reworded, specifically so the two tiers cannot drift. The class
template's own note on the failure mode applies unchanged at this tier: developers assume retry is
built in when it is not.

*Locales and fallback.* 6 support tickets under `data_model_reference_localization`.

*Why the section is a table rather than a run of bold labels.* The first draft used the class
template's convention, a bold label per note with bullets under each. Five notes in that form is
about fifteen lines of near-identical shape, and a reader after one fact has to read all of it. The
table gives every concern one column, so the reader finds the row and stops.

The three columns are Concern, Behavior, and Default when unset. That shape was checked against the
concern volumes in the corpus, counting mentions across all three files:

| Concern | Mentions | Has a behavior and a default |
| --- | --- | --- |
| Regions and endpoints | 109 | Yes, the default region |
| Authentication and tokens | 106 | Yes, `Not applicable` when required |
| Rate limiting and retry | 68 | Yes, the retry count or none |
| Timeouts | 58 | Yes, the timeout value |
| Locales and fallback | 47 | Yes, the master locale |
| Branches | 30 | Yes, `main` |
| Proxy configuration | 24 | Yes, none |

Every one of them has a behavior and a default, which is why the shape holds rather than only
fitting the Delivery SDKs. The concern set differs by SDK family, and the corpus names five (Delivery
at 194 mentions, Management at 125, App at 68, Utils at 16, Marketplace at 6). A Management SDK swaps
the token row and adds authorization scope. An App SDK carries field access and unsaved-entry rows
instead of regions. The columns do not change.

The Default when unset column is the one doing the most work. STD-PARAMS, undocumented parameters
and defaults, is the largest gap in the corpus at 39 threads, and this column is that standard
applied at the SDK tier. Its never-blank rule and its `Not applicable` convention are copied from
`AR-05` so the two tiers read alike, and `AR-10`'s prohibition on taking a default from an API
reference doc or a Postman collection applies here unchanged.

The token-type warning stays a blockquote below the table. It does not compress into a cell, and it
is the highest-volume single failure in the corpus.

*Why the section exists at all, rather than these notes living on class pages.* `api-ref-class-v2.md`
already states the reasoning one rung down: "Placing these notes at the class level avoids the
repetition that results from copying the same note into 10+ method sections." The same argument
applies again at the SDK tier. The TypeScript SDK has 12 classes, so an authentication note true of
all of them is currently either repeated 12 times or absent.

### Section 11: SDK Limitations

**Evidence class: counted tickets.** STD-CAPABILITY in `slack.md`, at 14 threads: "Explicitly
document capability boundaries, what each method can and cannot do, and link the supported
alternative when something is unsupported." `sdk_capability_gap` is a further 8 of 73 support
tickets, and `support_taxonomy.yaml` carries its medium-severity template: "Add a capability matrix
that clarifies what is and is not supported by each SDK method."

The four sample rows in the anatomy file are real tickets, not invented examples:

| Sample row | Source |
| --- | --- |
| Query across multiple content types in one request | SUP-0053, SUP-0054 |
| Recursive resolution of embedded items inside references | DX-2347 |
| Reference resolution deeper than two levels | DX-2347 |
| Automatic encoding of special characters in query values | DX-4468, SUP-0059 |

Two of those deserve their full context, because they are the reason this section lives on the
reference landing page rather than the setup page:

- **SUP-0054**: the customer asked to fetch all entries of all content types in one query. The
  resolution notes this "is not possible ... It is also mentioned in our official documentation as
  well", citing a `get-started-with-javascript-delivery-sdk#get-multiple-entries` URL. The limitation
  was documented and the customer still opened a ticket.
- **SUP-0053**: the same limitation again, on the TypeScript Delivery SDK, recorded as "a known
  limitation documented in the SDK guidelines."

The same fact, documented, generating repeat tickets. That is a discoverability failure rather than a
coverage failure, and it is why ownership moved.

**The ownership decision.** The SDK-wide limitation list previously lived in the SDK Get Started
template's `## Limitations` section, which carries these items with their sources:

1. CDN URL size cap (DX-1144, DX-3440)
2. No multiple content type referencing in one query
3. No Global Field schema querying, workaround available
4. Reference depth capped at two levels (DX-2347)
5. Special characters in query values not auto-encoded (DX-4468)

It now lives here. A developer who hits a limitation is reading the reference, not re-reading a setup
page they visited once during installation. See the loose ends below for what that handoff still
needs.

The entry bar, that a row must be a capability developers genuinely attempt and a fact true of the
whole SDK, is inherited from `api-ref-class-v2.md`'s Capability Matrix rule ("Include only
capabilities that developers genuinely ask about or attempt and fail. Do not list every impossible
thing, only the ones that cause real support friction") and from `api-ref-method-v2.md`'s Error
Reference decision rule, which uses the same two-condition shape.

The rule that the `Notes / Alternative` cell is never blank comes from
`api-ref-method-v2.md`'s Limitations format, "Does not {capability}. Use {alternative} instead", and
its instruction to "Link to the supported alternative or workaround for each limitation."

### The forbidden sections

Each one is a defect observed on a live page.

| Forbidden | Where it was observed |
| --- | --- |
| Installation or authentication setup steps | `typescript-about-typescript-delivery-sdk.md` carries a `## Quickstart With TypeScript Delivery SDK` section with `### Initializing the SDK`, `### Create a Stack Instance`, and `### Execute Queries`, all of which `templates/base/about-template.md` explicitly forbids: "Do NOT add a Quickstart section, all hands-on content lives in Get Started." |
| An H2 repeating the H1 | `typescript-get-started-with-typescript-delivery-sdk.md` opens `# [TypeScript] - Get Started with TypeScript Delivery SDK` followed immediately by `## Get Started with TypeScript Delivery SDK`. Recorded as fix 1 in its template's KEY FIXES list. |
| A Common Questions or FAQ section | The same page carries `### What Node.js version is required?`, which duplicates its own Prerequisites section. Its template's structural rules state: "Do NOT add a 'What [RUNTIME] version is required?' FAQ, answered in Prerequisites." |
| A flat list of methods | `AR-08`, transferred one tier up. |
| A standalone Additional Resources section | The 28.85% scroll depth. A closing link list is on the part of the page that is not read, and it separates every link from the context explaining why to follow it. |
| A trailing horizontal rule | `AR-07`. Method pages carry one because the CMS concatenates them into a rendered class page. A usage guide is standalone, so the rule renders as a stray divider. |

---

## Part 3: What the anatomy does not yet rest on, and open loose ends

### Unmined evidence

`Doc-Revamp/Slack Support Threads/` holds over 1,000 raw daily JSON exports across three channels.
Only one has been mined:

| Channel | Files | Mined |
| --- | --- | --- |
| `support-sdk` | 208 | Yes, into `slack.md` |
| `support-cli-dev` | ~250 | **No** |
| `support-marketplace-apps` | ~400+ | **No** |

CLI and Marketplace-app questions are workflow-shaped rather than method-shaped, so they are the
likeliest place to find counted evidence for sections 5, 6, 7, 8, and 9, which currently rest on
behavioral and structural grounding alone. Mining them is the single highest-value follow-up to this
work.

### The benchmark's missing dimensions

`research-plan.md` planned to capture separation of reference from guides (dimension A), quickstart
existence and time-to-first-call (B), and developer onboarding flow (H). The generated profiles
captured none of them. Re-running the benchmark against those dimensions would give the guide layer
the same competitor grounding the reference layer already has.

### The Limitations ownership handoff is not fully enforced

`## SDK Limitations` now belongs to this page, but nothing checks that it left the Get Started
template. Three specifics:

1. The SDK Get Started template lives at
   `Doc-Revamp/templates/base/get-started-template.md`, outside the doc-standards repo. It has never
   been migrated in, so no linter covers it.
2. The doc-standards root `getting-started.md` is a *product* Get Started standard, not an SDK one.
   Its Section Order is Overview, Role-Based Routing Table, Prerequisites, Quick Start, Documentation
   Map, Next Steps. It has no Limitations section at all, so there is nothing to amend there.
3. `common-rules.md` defines a `**Limitations**` section scoped to "any doc describing a scanning,
   validation, or detection tool", placed after Troubleshooting and before Next Steps. That scope
   matches no SDK doc, and the section appears in no root doc-type's Section Order table and no row
   of `section-matrix.md`. It is an orphan definition and should either be broadened or removed.

Until the SDK Get Started template is migrated into doc-standards, the handoff holds by convention
rather than by check.
