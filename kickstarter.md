# Kickstarter: Section Order

A kickstarter is a starter app template that demonstrates a working integration. It is a runnable reference implementation, not a conceptual explanation.

Apply the rules in `common-rules.md` (B1, B2, C1-C7) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point |
| 3 | Overview | Required | 1-3 sentences: what the starter does and what stack it uses |
| 4 | Quick Decision Guide | Rarely | Only if the repo offers meaningfully different configurations (for example, SSR vs SSG variants) |
| 5 | Prerequisites | Required | Blocking requirements with links: Node version, package manager, Contentstack stack setup |
| 6 | Main Content | Required | Clone, install, configure, run steps, each step ends with a verifiable outcome |
| 7 | Theory Sections | Not used | Conceptual explanation belongs in linked docs, not in the kickstarter |
| 8 | Troubleshooting | Optional | Root cause and resolution for common local-run failures |
| 9 | Next Steps | Required | Links to the conceptual guide, feature docs, or how-to guides the developer should read next |

**Governing rule:** A developer with no prior context must be able to clone, configure, and run the starter using only this doc. Every step is explicit.

---

## Type-Specific Rules

No rules beyond `common-rules.md`.
