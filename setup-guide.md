# Setup Guide: Section Order

A setup guide configures an environment, SDK, runtime, or integration. It results in a working, verifiable configuration the developer can build on.

Apply the rules in `common-rules.md` (B1, B2, C1-C7) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Human-readable entry point |
| 3 | Overview | Required | 1-3 sentences: what the developer will have configured after following this guide |
| 4 | Quick Decision Guide | If multiple environments | Required when the setup differs by environment, runtime, or hosting platform |
| 5 | Prerequisites | Required | Blocking and non-blocking requirements, separated, all items link to the resource that fulfills them |
| 6 | Main Content | Required | Installation, configuration, and verification steps |
| 7 | Theory Sections | Rare | Only when understanding a concept is necessary to configure correctly |
| 8 | Troubleshooting | Required | Root cause and resolution for each known failure mode during setup |
| 9 | Next Steps | Required | Links to what the developer builds or configures next |

**Governing rule:** The developer must end up with a verified, working configuration. Every main-content section ends with a verification step or a clear observable outcome.

---

## Type-Specific Rules

No rules beyond `common-rules.md`.
