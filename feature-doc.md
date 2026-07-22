# Feature Doc: Section Order

A feature doc describes a specific product feature: what it does, how to enable it, and how to configure it.

Apply the rules in `common-rules.md` (B1, B2, C1 through C7) alongside this file.

---

## SEO Front Matter Format

Every Feature Doc must begin with a YAML front matter block:

```yaml
---
title: "Configure Region Endpoints in PHP Content Delivery SDK"
description: "Configure the PHP CDA SDK to connect to the correct Contentstack endpoint for any supported region."
slug: /docs/php-cda/region-endpoint-integration
---
```

**Fields:**

| Field | Pattern | Example |
|---|---|---|
| `title` | `Configure Region Endpoints in {SDK Name} SDK` | `Configure Region Endpoints in Ruby Content Delivery SDK` |
| `description` | One sentence shown in search results and link previews | `Configure the Ruby CDA SDK to connect to the correct Contentstack endpoint for any supported region.` |
| `slug` | Relative URL path | `/docs/ruby-cda/region-endpoint-integration` |

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point |
| 3 | Overview | Required | 1 to 3 sentences: what this feature does and who it is for |
| 4 | What You'll Learn | Required | Outcome-focused bullets. Sets developer expectation |
| 5 | Quick Decision Guide | If multiple approaches | Orients developers before they read requirements |
| 6 | Prerequisites | If setup is involved | Blocking and non-blocking requirements, separated |
| 7 | Main Content | Required | Feature setup, configuration, and usage |
| 8 | Theory Sections | Optional | Explanatory content, placed after working setup |
| 9 | Troubleshooting | Required | Root cause and resolution for each known failure |
| 10 | Next Steps | Required | Links to what comes after, each with a description |

**Governing rule:** Do first, understand second, debug last. Developers act before they read theory.

---

## Type-Specific Rules

No rules beyond `common-rules.md`.
