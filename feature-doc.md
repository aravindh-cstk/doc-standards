# Feature Doc: Section Order

A feature doc describes a specific product feature: what it does, how to enable it, and how to configure it.

Apply the rules in `common-rules.md` (B1, B2, C1-C7) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point |
| 3 | Overview | Required | 1-3 sentences: what this feature does and who it is for |
| 4 | Quick Decision Guide | If multiple approaches | Orients developers before they read requirements |
| 5 | Prerequisites | If setup is involved | Blocking and non-blocking requirements, separated |
| 6 | Main Content | Required | Feature setup, configuration, and usage |
| 7 | Theory Sections | Optional | Explanatory content, placed after working setup |
| 8 | Troubleshooting | Required | Root cause and resolution for each known failure |
| 9 | Next Steps | Required | Links to what comes after, each with a description |

**Governing rule:** Do first, understand second, debug last. Developers act before they read theory.

---

## Type-Specific Rules

No rules beyond `common-rules.md`.
