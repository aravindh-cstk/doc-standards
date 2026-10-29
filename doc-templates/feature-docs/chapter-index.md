# Chapter Index: Section Order

A chapter index is the landing page of a documentation chapter. It orients a reader who has arrived at the chapter, lists what the chapter holds, and hands them on. It teaches nothing itself: every fact on it belongs to one of the pages it links.

This type was added after a classification pass over the corpus. Fifteen `index.md` pages and nine chapter overviews were being judged against the Get Started Guide row, because routing a reader is what a Role-Based Routing Table does and no other row described routing at all. The result was 72 findings asking a chapter index for a Quick Start, a Role-Based Routing Table and a Documentation Map, none of which belongs on one. A chapter index that carried all three would be a second Get Started Guide.

The distinction is scope. A Get Started Guide is the single entry point to a product, and it routes a reader to a chapter. A chapter index is the entry point to one chapter, and it routes a reader to a page.

Apply the rules in `common-rules.md` (B1, B2, C1-C7) alongside this file.

---

## Section Order

| # | Section | Required | Purpose |
|---|---|---|---|
| 1 | SEO front matter (title, description, URL) | Required | Machine-readable metadata for search and indexing |
| 2 | Page title | Required | The chapter's name, not a sentence |
| 3 | Overview | Required | 1-2 sentences: what this chapter covers and who needs it. No preamble before it |
| 4 | On this chapter | Required | Every page in the chapter, each as a link plus one sentence saying what it holds. Grouped under sub-headings when the chapter has more than six pages |
| 5 | Continue | Optional | The chapter a reader goes to next, with the reason. Omitted on a terminal chapter |
| 6 | See also | Required | Links out of the chapter: back to the docs home, and to chapters that share its subject |

**Governing rule:** a chapter index is navigation. If a reader can learn a fact from it that no page in the chapter states, the fact is on the wrong page.

---

## Type-Specific Rules

- **No Troubleshooting section.** A symptom belongs on the page that documents the behavior producing it. A chapter index that carries its own troubleshooting splits the answer across two pages.
- **No Prerequisites section.** Prerequisites are per task, and a chapter is not a task. Link the setup chapter from See also instead.
- **No Quick Start, Role-Based Routing Table, or Documentation Map.** Those three belong to the Get Started Guide, which is the product's single entry point. A chapter index that carries them competes with it.
- **Every link in On this chapter carries a description.** A bare list of page titles tells a reader nothing they could not get from the navigation sidebar, which is already on screen.
- **Next Steps is replaced by Continue and See also.** The chapter's own pages already end in Next Steps, so a chapter index repeating one would send a reader back into the chapter they just finished. Continue names the chapter after this one, and See also names the neighbours.
- **The Overview does not restate the chapter's pages.** It says what the chapter is for. On this chapter says what is in it.
