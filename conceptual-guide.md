# Conceptual Guide: Section Order

A conceptual guide explains a product concept, feature behavior, or architectural pattern. It builds understanding rather than guiding through a task.

Apply the rules in `common-rules.md` (B1, B2, C1 through C7) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point |
| 3 | Overview | Required | 1 to 3 sentences: what the user will learn from this doc and who it is for |
| 4 | What You'll Learn | Required unless Quick Reference is used | Outcome-focused bullets. Sets developer expectation |
| 4a | Quick Reference | If What You'll Learn is omitted | Navigation table (Use Case, Section, Key Call) for multi-section docs where orientation and navigation matter equally |
| 5 | Quick Decision Guide | If multiple paths | Orients developers before they read requirements |
| 6 | Prerequisites | If setup is involved | Blocking and non-blocking requirements, separated |
| 7 | Main Content | Required | Setup, configuration, implementation |
| 8 | Theory Sections | Optional | Explanatory content, placed after working setup |
| 9 | Troubleshooting | Recommended | Root cause and resolution for each failure |
| 10 | Next Steps | Required | Links to what comes after, each with a description |

**Governing rule:** Do first, understand second, debug last. Developers act before they read theory.

---

## Type-Specific Rules

Architecture diagrams belong in Theory Sections. If the doc has no Theory Sections, omit architecture diagrams entirely.

**Quick Reference vs What You'll Learn**

Use Quick Reference instead of What You'll Learn when the doc has many distinct sections and developers are likely to arrive with a specific task in mind rather than reading top to bottom. A Quick Reference table has three columns: Use Case, Section, and Key Call. Each row maps one developer intent to the section that addresses it and the primary API call or code pattern involved. Place Quick Reference directly after the Overview with a one-line lead-in. Do not use both sections in the same doc.
