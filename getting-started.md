# Get Started Guide — Section Order

A Get Started Guide is the entry point for developers who are new to the product or a major feature area. Its job is to route developers to the right content fast and give them one working outcome quickly. It does not explain or teach — it orients and moves.

Apply the rules in `common-rules.md` (B1, B2, C1–C7) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | Always the form "Get Started with [Product]" |
| 3 | Overview | Required | 2–3 sentences: what the product does and what the developer will have after following the Quick Start |
| 4 | Role-Based Routing Table | Required | Routes each developer persona to the correct first doc immediately; placed before Quick Start so developers who know their path can leave fast |
| 5 | Prerequisites | Required | Only the blocking items for the Quick Start path; each links to the resource that fulfills it |
| 6 | Quick Start | Required | The single fastest path to a working outcome; time-bounded, one path only, ends with a verifiable outcome |
| 7 | Documentation Map | Required | Navigation table organized by developer goal; the developer's map of what exists and where to go next |
| 8 | Next Steps | Required | 3–5 links to the most logical reads after Quick Start, each with a one-sentence description |

**Governing rule:** A developer who knows what they want must be able to leave this page to the right doc in under 30 seconds. A developer who does not know what they want must have a working outcome within the time stated in the Quick Start.

---

## Type-Specific Rules

### RS1: Routing and Navigation

**Rule:** The Role-Based Routing Table comes immediately after the Overview, before Prerequisites and Quick Start.
**Why:** Developers who already know their goal (migration, integration, new project) should not read through the Quick Start to find their entry point. The table lets them self-select and exit to the right doc immediately.
**Exception:** If all developers share a single entry path with no meaningful branching, replace the table with one sentence pointing to the Quick Start.

---

**Rule:** The Role-Based Routing Table has three columns: "I want to...", "I am...", and "Start here". The "Start here" column links directly to the first doc in that path.
**Why:** Goal alone is sufficient to route most developers, but pairing it with role disambiguates cases where the same goal maps to different starting points (for example, a developer integrating a new stack vs. a developer migrating an existing one).
**Exception:** None.

---

**Rule:** The Documentation Map is organized by developer goal, not by doc type.
**Why:** A developer arriving at this page does not know the doc taxonomy. They know what they are trying to build. Organizing by goal ("Fetch content", "Preview live changes", "Migrate entries") matches their mental model; organizing by doc type ("Setup Guides", "How-To Guides") requires them to already understand the taxonomy.
**Exception:** None. Do not use doc type as a primary organizing dimension in the Documentation Map.

---

**Rule:** Every link in the Role-Based Routing Table and the Documentation Map must include a one-sentence description of what the developer gets from following it.
**Why:** A bare link forces the developer to click before knowing whether the destination is relevant. A description eliminates that cost and makes the table immediately actionable.
**Exception:** None.

---

### RS2: Quick Start Constraints

**Rule:** The Quick Start covers one path only — the most common one. It does not branch.
**Why:** A Quick Start that covers multiple paths requires the developer to read all of it to find the parts that apply. One clear path is faster to follow. Alternate paths belong in the Documentation Map.
**Exception:** If two paths share identical steps up to a single fork, show the fork as a one-line conditional at that step. Do not split into two full Quick Starts within a Get Started Guide.

---

**Rule:** State the time estimate in the Quick Start section heading or immediately below it. Format: "Estimated time: X minutes."
**Why:** Developers decide whether to attempt a Quick Start based on available time. An upfront estimate respects that decision and sets a baseline — a developer who takes longer knows to check their setup, not the guide.
**Exception:** If time varies significantly by environment, state a range ("5–15 minutes depending on your setup") and link to the prerequisite that causes the variance.

---

**Rule:** The Quick Start must end with a verifiable, observable outcome. The final step states what success looks like.
**Why:** A Quick Start without a success state leaves the developer unsure whether they completed it correctly. An observable outcome — a returned API response, a running local server, a rendered page — closes the loop.
**Exception:** None.

---

**Rule:** The Quick Start covers at most 10 steps.
**Why:** More than 10 steps signals that the Quick Start is actually a full setup guide. If more steps are required, extract them into a linked setup guide and reference it from the Quick Start.
**Exception:** None. Split the content rather than exceeding the limit.

---

### RS3: What a Get Started Guide Does Not Contain

**Rule:** No theory sections. Link to the relevant conceptual guide instead.
**Why:** The Get Started Guide is an entry point, not a teaching doc. Conceptual content extends reading time and delays the first working outcome. A developer who wants to understand the product follows a link in the Documentation Map.
**Exception:** One sentence of orientation in the Overview is acceptable if it prevents a common, blocking misunderstanding about what the product does or does not do.

---

**Rule:** No troubleshooting section. Resolutions for Quick Start failures belong in the linked setup guide or feature doc for the step that fails.
**Why:** Troubleshooting in a Get Started Guide blurs the "start here" signal with "debug here" content. It also inflates the page length for first-time visitors who are not yet debugging.
**Exception:** A single inline callout — one sentence — for a known, blocking failure on a specific platform (for example, a known Node version conflict) is acceptable at the step where the failure occurs.

---

**Rule:** No feature explanation beyond what is needed to complete the Quick Start.
**Why:** The Get Started Guide is not a feature tour. Feature explanation belongs in feature docs, linked from the Documentation Map.
**Exception:** None.

---

## Section Definitions (Get Started Guide Specific)

**Role-Based Routing Table**
A table with three columns: "I want to...", "I am...", and "Start here". Each row maps one developer intent and role to the first doc they should read. The "Start here" cell links directly to that doc and includes a one-sentence description. Cover the four to six most common entry scenarios. Do not attempt to cover every scenario — the Documentation Map covers the full topology.

Example row structure:

| I want to... | I am... | Start here |
|---|---|---|
| Build a new website | Starting from scratch | [Kickstart Next.js](link) — a runnable starter that fetches and renders Contentstack content using the Delivery SDK. |
| Migrate content from another CMS | Already have content to port | [CLI Migration Guide](link) — step-by-step instructions for exporting and importing content via the CLI. |

**Quick Start**
A numbered list of steps, each beginning with an imperative verb. Steps are concrete and actionable; no step can be completed without the information provided in that step or a linked prerequisite. The section opens with the time estimate. The final step is always a verification step with an observable success state.

**Documentation Map**
A table with three columns: "Goal", "Doc", and "What you get". Organized by what the developer is trying to accomplish. Each row covers one goal and links to the single best doc for that goal. Do not list multiple docs per row — if multiple docs apply, link to the most common entry point and let that doc link to the others.

---

## Anti-Patterns Specific to Get Started Guides

| Anti-Pattern | Why It Fails | Fix |
|---|---|---|
| Quick Start with more than one path | Developer must read all paths to find theirs; the fast-path illusion disappears | Cover one path; send others to the Role-Based Routing Table |
| Documentation Map organized by doc type | Requires the developer to know the taxonomy before they can navigate it | Organize by developer goal |
| Overview longer than 3 sentences | Developer has to read a paragraph before reaching the routing table | Cut to 2–3 sentences |
| Troubleshooting section included | Signals the Quick Start is unreliable; inflates page length for first-time visitors | Move resolutions to the relevant setup or feature doc |
| Theory section included | Delays action; contradicts the entry-point purpose | Link to the conceptual guide from the Documentation Map |
| Bare links in Routing Table or Documentation Map | Developer cannot judge whether to follow the link without clicking | Every link includes a one-sentence description |
| Quick Start exceeds 10 steps | No longer a Quick Start; becomes a full setup guide | Extract excess steps to a linked setup guide |
| Missing time estimate in Quick Start | Developer cannot decide whether to attempt it now | Add "Estimated time: X minutes" at the top of the section |
| No verifiable outcome at end of Quick Start | Developer does not know if they succeeded | Add a final verification step with an observable success state |
