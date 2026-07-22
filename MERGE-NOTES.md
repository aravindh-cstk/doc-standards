# Merge Notes

This folder is a merged, deduplicated canonical version of five independent `doc-standards` folders found on the Desktop on 2026-07-21:

- `CS Assets/doc-standards`
- `cursor/doc-standards`
- `skills/doc-standards`
- `Agentic AI/doc-standards`
- `Dynamic URL/doc-standards`

All five copies started from one shared template and were edited independently over time. `common-rules.md` in particular ranged from 20 KB to 41 KB across the five copies, each revision adding rules the others never received. This folder consolidates every unique rule from every copy into one source of truth. The five original folders were left untouched, this folder is new.

## Decisions made by the user during the merge

- **Overview style:** the Overview section definition in `common-rules.md` uses problem-first framing (lead with the problem or limitation, then state what the feature enables, do not open with the API or SDK name). This was the `Dynamic URL` copy's rewrite. The other four copies used gain-first framing ("state what the developer achieves or gains"). Problem-first was chosen as canonical.
- **Migration guide Prerequisites:** `migration-guide.md` keeps both a Mandatory and an Optional subsection in Prerequisites. The `CS Assets` copy had a rule forbidding an Optional subsection entirely. That rule was not carried into the merged file.
- **Originals:** the five source folders were left completely untouched. Nothing in them was edited or deleted.

## Default resolutions applied to common-rules.md (not asked, applied as sensible defaults)

- Restored the `CS Assets`-only exception allowing a Note callout in a migration guide's Overview when one change requires significantly more effort than the rest. Every later revision had silently dropped it.
- Restored the `Agentic AI`-only "write for a developer audience" rule in C3 (Language and Tone). The `Dynamic URL` revision had dropped it. It is kept as a distinct rule from C8's tone principle since it concerns assumed reader competence and level, not marketing language.
- Kept the `Dynamic URL` revision's broadened no-dash rule (extends to en dashes and table cells, adds parentheses and colon as remedies) as canonical, since it is a strict superset of the older, narrower wording.
- Consolidated two overlapping C5 (Cross-References) rules, "remove duplicate cross-references" and "point to exactly one canonical section", into one combined rule rather than keeping them as two near-parallel rules.
- Relocated the Quick Reference table completeness requirement out of the Section Definitions prose (where the `Dynamic URL` copy had left it as an oddly placed inline rule) into C6 (Content Accuracy and Grouping), for structural consistency with every other rule in the document.
- Kept C8 (Developer Tone, present in 3 of 5 copies) and C9 (API Reference Completeness, unique to `Dynamic URL`) in full. Both are purely additive with no conflicts against anything else in the corpus.

## Migration-guide.md structural resolution

The `CS Assets` copy and the other four copies disagreed on migration-guide.md's section order and on the name of the type-mapping table. The merged file:

- Reinstates "What You'll Learn" as a required section (present in the four-copy version, absent from `CS Assets`).
- Renames "Breaking Changes Reference" (the `CS Assets` name) to "Type Mapping Reference" to match `section-matrix.md` and four of the five copies.
- Keeps "Minimal Migration Path" as an added section, unique to the `CS Assets` copy, and adds a corresponding row to `section-matrix.md`.
- Keeps all of the `CS Assets` copy's additional rigor that did not conflict with the above: the effort-outlier callout in the Overview, the Quick Decision Guide "concrete codebase signals" rule, the Main Content "compile blockers first" ordering rule, three-part Troubleshooting entries tagged Compile blocker or Behavior change, and the Pre-Upgrade Checklist "verification tool, not sequence guide" framing.
- Merges both variants' Theory Sections exceptions (a one-sentence Overview orientation, or a one-sentence consequence statement before a Before/After block) since they are non-contradictory alternatives rather than a conflict.

## Other file merges

- `feature-doc.md`: based on the `Dynamic URL` copy (the only one with the SEO Front Matter Format section). One label was renamed from "Decision Guide" to "Quick Decision Guide" to match the term used everywhere else.
- `section-matrix.md`: based on the larger variant (`CS Assets`, `cursor`, `Dynamic URL`, the only version with the Get Started Guide column), plus one new row for Minimal Migration Path.
- `getting-started.md`, `conceptual-guide.md`, `how-to-guide.md`, `setup-guide.md`, `kickstarter.md`: identical content across all five source folders, carried over with no content changes.
- `writing-guide-agent-skills.md`: carried over from `skills/doc-standards/.writing-guide.md` (the only copy that had it), made visible by dropping the leading dot, with a scope note added at the top clarifying it is specific to Agent Skills documentation and supplements, rather than replaces, `common-rules.md` C3 and C8.

## A note on style

Every file in this folder, including this one, avoids em dashes, en dashes, and semicolons in prose, per the no-dash rule in `common-rules.md` C3. Several of the original five copies (especially the older, smaller revisions) used dashes and semicolons throughout. Those were rewritten for internal consistency during the merge. This is a wording change only, not a content change.
