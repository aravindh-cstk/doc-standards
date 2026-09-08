<!-- Generated file. Do not edit manually. -->
<!-- Source: scripts/data/rules-registry.json and scripts/data/check-sources.json -->
<!-- Regenerate: cd scripts && npm run build:readme -->

# Check catalog

Every entry in `scripts/data/check-sources.json`, which maps a `checkId` to the module that
implements it and the rules it addresses. For the architecture these modules sit in, read the
Toolchain section of [README.md](README.md). For rule text, read [REFERENCE-RULES.md](REFERENCE-RULES.md).

The map holds **86 entries**, of which 21 have no module behind them.

## Counts by kind

| Kind | Entries | What it means |
| --- | --- | --- |
| `structural` | 39 | Parses the document model and reports on shape, order or completeness. |
| `unimplemented` | 21 | Registered with no module behind it. The rule is stated and tiered, but nothing enforces it. |
| `regex` | 16 | Matches a named pattern against prose, outside code fences. |
| `wordlist` | 8 | Matches entries from a JSON data file, so the rule widens by data rather than by code. |
| `candidate` | 2 | Emits a tier-3 candidate for human or judge adjudication rather than a finding. |

A `rules` array is a claim about what a check **addresses**, not what it emits. Several rules
legitimately share one emitted finding, so the two lists do not have to match one for one.

## Implemented checks

| Check ID | Kind | Module | Rules | Data files | Patterns |
| --- | --- | --- | --- | --- | --- |
| `acronym-first-use` | wordlist | `checks/acronym-first-use.js` | B1-06, C3-06, C8-07 | `data/acronyms.json` | `ACRONYM_RE` |
| `additional-resource-phrasing` | regex | `checks/additional-resource-phrasing.js` | C5-05 | none | `CALLOUT_RE`, `OPENER_RE`, `REFER_RE` |
| `anthropomorphism` | wordlist | `checks/anthropomorphism.js` | C3-18 | `data/anthropomorphism/*.json` | `PROTOCOL_CONTEXT_RE` |
| `api-ref-additional-resource` | structural | `checks/api-ref-structure.js` | AR-06 | none | none |
| `api-ref-before-you-begin` | structural | `checks/api-ref-structure.js` | UG-09 | none | none |
| `api-ref-class-overview-completeness` | structural | `checks/api-ref-structure.js` | UG-05 | none | none |
| `api-ref-class-overview-table` | structural | `checks/api-ref-structure.js` | UG-04 | none | none |
| `api-ref-heading-levels` | structural | `checks/api-ref-structure.js` | AR-02, UG-02 | none | none |
| `api-ref-index-completeness` | structural | `checks/api-ref-structure.js` | AR-09 | none | none |
| `api-ref-method-index-sole-list` | structural | `checks/api-ref-structure.js` | AR-08 | none | none |
| `api-ref-param-table` | structural | `checks/api-ref-structure.js` | AR-05 | none | none |
| `api-ref-returns-line` | structural | `checks/api-ref-structure.js` | AR-04 | none | none |
| `api-ref-sdk-limitations` | structural | `checks/api-ref-structure.js` | UG-12 | none | none |
| `api-ref-sdk-wide-notes` | structural | `checks/api-ref-structure.js` | UG-13 | none | none |
| `api-ref-section-order` | structural | `checks/api-ref-structure.js` | AR-03, UG-03 | none | none |
| `api-ref-task-index` | structural | `checks/api-ref-structure.js` | UG-06 | none | none |
| `api-ref-token-type-warning` | structural | `checks/api-ref-structure.js` | UG-08 | none | none |
| `api-ref-trailing-rule` | structural | `checks/api-ref-structure.js` | AR-07 | none | none |
| `api-ref-usage-guide-scope` | structural | `checks/api-ref-structure.js` | UG-10 | none | none |
| `api-ref-usage-patterns` | structural | `checks/api-ref-structure.js` | UG-11 | none | none |
| `banned-phrases` | wordlist | `checks/banned-phrases.js` | B1-10, B2-09, C3-01, C3-03, C3-15, C8-01, C8-02, C8-03, C8-04, C8-05, C8-06, C8-08, CLI-16 | `data/banned-phrases/*.json` | none |
| `bare-links` | structural | `checks/next-steps-links.js` | B2-08, C1-06, RS1-04 | none | `BARE_LINK_SECTIONS` |
| `callout-frequency` | structural | `checks/heuristic-flags.js` | B1-08, B2-04, C2-05, C5-01, C5-03 | none | none |
| `callout-taxonomy` | structural | `checks/callout-taxonomy.js` | C2-11 | none | `CALLOUT_RE`, `VALID_LABELS` |
| `cli-specific` | structural | `checks/cli-specific.js` | CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07 | none | none |
| `conditional-framing` | regex | `checks/conditional-framing.js` | C3-29 | none | `IF_YOU_RE` |
| `duplicate-links` | structural | `checks/heuristic-flags.js` | C5-04 | none | none |
| `duplicate-sections` | structural | `checks/heuristic-flags.js` | B1-09, B2-06, C7-01 | none | none |
| `em-dash-semicolon` | regex | `checks/em-dash-semicolon.js` | C3-05 | none | `DASH_SEMI_RE`, `INLINE_CODE_RE` |
| `embedded-question-phrases` | regex | `checks/embedded-question-phrases.js` | C3-12 | none | `PHRASE_RE`, `REWRITES` |
| `error-code-format` | regex | `checks/error-code-format.js` | C3-11 | none | `CODE_RE` |
| `exhaustive-claim-phrases` | wordlist | `checks/banned-phrases.js` | C3-04 | `data/banned-phrases/*.json` | none |
| `front-matter` | structural | `checks/front-matter.js` | FM-01, FM-02 | none | `BASE_REQUIRED_KEYS` |
| `front-matter-api-ref` | structural | `checks/api-ref-structure.js` | AR-01, UG-01 | none | none |
| `getting-started-specific` | structural | `checks/getting-started-specific.js` | RS1-01, RS1-02, RS2-02, RS2-04, RS3-01, RS3-02 | none | none |
| `heading-length` | regex | `checks/heading-length.js` | C2-07, C2-08 | none | `MAX_WORDS`, `LOWERCASE_IDENTIFIER_RE`, `PLACEHOLDER_RE` |
| `heading-uniformity` | structural | `checks/heading-uniformity.js` | C6-06 | none | none |
| `internal-link-form` | regex | `checks/internal-link-form.js` | CLI-17 | none | `LINK_RE`, `BAD_FORMS` |
| `link-label-fidelity` | candidate | `checks/link-label-fidelity.js` | C2-14 | none | `OPAQUE_LABELS`, `STOP_WORDS` |
| `metaphor-phrases` | wordlist | `checks/metaphor-phrases.js` | C3-08 | `data/metaphors/*.json` | none |
| `migration-before-after` | structural | `checks/heuristic-flags.js` | MIG-03 | none | none |
| `migration-specific` | structural | `checks/migration-specific.js` | MIG-02, MIG-04, MIG-06 | none | none |
| `no-emoji` | regex | `checks/no-emoji.js` | C3-27 | none | `EMOJI_RE`, `ALLOWED`, `HINTS` |
| `no-italics` | regex | `checks/no-italics.js` | C3-28 | none | `AST_RE`, `UND_RE`, `HTML_ITALIC_RE` |
| `numeric-consistency` | candidate | `checks/numeric-consistency.js` | C2-13 | none | `COUNT_RE`, `POINTER_RE`, `UNIT_NOUNS`, `NOT_A_NOUN` |
| `ordered-list-sequence` | structural | `checks/ordered-list-sequence.js` | C3-14 | none | `SEQUENCE_SIGNAL_RE`, `IMPERATIVE_VERBS` |
| `paragraph-cohesion` | structural | `checks/paragraph-cohesion.js` | C2-09 | none | none |
| `passive-voice` | wordlist | `checks/passive-voice.js` | C3-10 | `data/passive-voice/*.json` | none |
| `periphrasis-phrases` | wordlist | `checks/periphrasis-phrases.js` | C3-09 | `data/periphrasis/*.json` | none |
| `prerequisites-links` | structural | `checks/heuristic-flags.js` | C1-04 | none | none |
| `present-continuous` | regex | `checks/present-continuous.js` | C3-19 | none | `CONTINUOUS_RE`, `PARTICIPIAL_ADJECTIVES` |
| `qa-headers` | regex | `checks/qa-headers.js` | C3-02 | none | `QUESTION_RE` |
| `quick-reference-table` | structural | `checks/quick-reference-table.js` | C2-04 | none | none |
| `quick-start-verification` | structural | `checks/heuristic-flags.js` | RS2-03 | none | none |
| `retry-attempt-count-bold` | regex | `checks/retry-attempt-count-bold.js` | C3-13 | none | `COUNT_RE` |
| `section-structure` | structural | `checks/section-structure.js` | B1-01, B2-01, C1-01, C1-02, C1-03, MIG-08, CLI-19, PLG-05 | `data/section-order.json` | none |
| `sentence-concision` | regex | `checks/sentence-concision.js` | C3-07 | `data/wordy-connectors.json` | `WORD_LIMIT`, `CAUSAL_RE` |
| `table-integrity` | structural | `checks/table-integrity.js` | C2-10 | none | `TABLE_ROW_RE`, `ALIGNMENT_ROW_RE` |
| `table-restatement` | regex | `checks/table-restatement.js` | C7-04 | none | `CALLOUT_RE`, `BOLD_LEADIN_RE`, `THRESHOLD` |
| `troubleshooting-format` | structural | `checks/troubleshooting-format.js` | C1-05 | none | `ROOT_CAUSE_RE`, `RESOLUTION_RE` |
| `try-catch-heuristic` | structural | `checks/heuristic-flags.js` | C4-05 | none | none |
| `type-mapping-row-grouping` | structural | `checks/heuristic-flags.js` | MIG-05 | none | none |
| `typographic-substitutes` | regex | `checks/typographic-substitutes.js` | C3-30 | none | `BANNED`, `BANNED_RE`, `ALLOWED`, `HINTS` |
| `ui-element-bold` | regex | `checks/ui-element-bold.js` | C4-07 | none | `LABEL_RE`, `UI_CUE_RE` |
| `vague-reference` | wordlist | `checks/vague-reference.js` | C3-24 | `data/vague-reference/*.json` | `LEAD_IN_RE`, `TABLE_ROW_RE`, `LIST_ITEM_RE` |

## Registered with no check

These entries carry `kind: unimplemented`. Each names rules that are stated and tiered but that
nothing enforces, so a page can break them and still lint clean. Closing one is the job the
`/doc-gap` workflow exists for.

| Check ID | Rules with no enforcement |
| --- | --- |
| `api-ref-verified-defaults` | AR-10 |
| `cli-auth-step-heuristic` | CLI-13 |
| `cli-command-form-heuristic` | CLI-11 |
| `cli-error-entry-heuristic` | CLI-10 |
| `cli-exit-code-heuristic` | CLI-15 |
| `cli-flag-prose-heuristic` | CLI-08 |
| `cli-mutation-statement-heuristic` | C9-01 |
| `cli-output-block-heuristic` | CLI-09 |
| `cli-placeholder-heuristic` | CLI-14 |
| `cli-plugin-boundary-heuristic` | CLI-18 |
| `cli-scope-statement-heuristic` | CLI-12 |
| `cli-version-drift-heuristic` | CLI-20 |
| `legacy-version-callout-heuristic` | C9-03 |
| `placeholder-heuristic` | C4-03 |
| `plugin-manifest-heuristic` | PLG-02 |
| `plugin-publish-heuristic` | PLG-03 |
| `plugin-scaffold-heuristic` | PLG-01 |
| `plugin-test-heuristic` | PLG-04 |
| `prose-guard-heuristic` | B1-07, B2-07, C4-02 |
| `section-length-heuristic` | C6-03 |
| `token-scope-heuristic` | C9-02 |

## Claimed but never emitted

Pairs where a module owns the rule but never names its ID as a literal. Some are legitimate,
because one finding can cover several rules or the ID is built from a variable. The list is
frozen by `test/gap-loop.test.js` so it can shrink but not grow unnoticed.

Current count: 18.

- `bare-links:B2-08`
- `bare-links:C1-06`
- `bare-links:RS1-04`
- `callout-frequency:B1-08`
- `callout-frequency:B2-04`
- `callout-frequency:C5-01`
- `callout-frequency:C5-03`
- `duplicate-sections:B1-09`
- `duplicate-sections:B2-06`
- `getting-started-specific:RS3-01`
- `getting-started-specific:RS3-02`
- `migration-specific:MIG-02`
- `section-structure:B1-01`
- `section-structure:B2-01`
- `section-structure:C1-03`
- `section-structure:CLI-19`
- `section-structure:MIG-08`
- `section-structure:PLG-05`

