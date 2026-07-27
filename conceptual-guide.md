# Conceptual Guide: Section Order

A conceptual guide explains a product concept, feature behavior, or architectural pattern. It builds understanding rather than guiding through a task.

Apply the rules in `common-rules.md` (B1, B2, C1-C7) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point |
| 3 | Overview | Required | 1-3 sentences: what the user will learn from this doc and who it is for |
| 4 | Quick Reference | Optional | Navigation table (Use Case / Section / Key Call) for multi-section docs where orientation and navigation matter |
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

Use Quick Reference whenever the doc has many distinct sections and developers are likely to arrive with a specific task in mind rather than reading top to bottom. Place Quick Reference directly after the Overview with a one-line lead-in, per the Quick Reference definition in `common-rules.md`.
