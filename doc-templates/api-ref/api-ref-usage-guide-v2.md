# API reference usage guide: page anatomy

The usage guide is the landing page of an SDK's API Reference. It maps to the `sdk_usage_guides`
content type and sits above the class pages in the reference chain:

```
sdk_landing_page  ->  sdk_usage_guides  ->  classes_reference  ->  method_details
```

On disk the file is named `usage_guide.md`. One per SDK, at the root of that SDK's reference folder.

Its job is orientation, not instruction. A developer arriving here has finished Get Started and now
needs to know what the reference contains, how the SDK is shaped, and which page answers their
question. Behavioral data on the current reference index pages shows an average scroll depth of
28.85%, so every required section below sits high on the page and nothing load-bearing goes at the
bottom.

Apply the rules in the repo root `common-rules.md` alongside this file, the same as the class and
method templates do.

---

## The three-tier deduplication ladder

Read this before writing anything. It decides which of the three page shapes owns a given fact, and
it is the rule most often broken.

| Scope of the fact | Page that owns it | Section |
| --- | --- | --- |
| True of every class in the SDK | `usage_guide.md` | SDK-Wide Notes, SDK Limitations |
| True of every method in one class | `class_reference.md` | Class-Level Notes, Capability Matrix |
| True of one method | `method_details` | Warnings, Limitations |

The ladder cuts both ways. A fact true of the whole SDK belongs here once and must not be repeated
on class pages. A fact confined to one class belongs on that class page and must not be hoisted
here, because a reader who finds it here will assume it applies everywhere.

When you hoist a note up to this page, delete it from the class pages it came from in the same
change. Two copies drift, and the reader has no way to tell which one is current. See
`api-ref-class-v2.md` for the middle rung of the ladder.

---

## Page anatomy

1. **Front matter**

  Exactly three keys, in this order: `uid`, `seo_title`, `seo_description`. Fill all three. A usage
  guide is a standalone URL, so it needs real SEO text, unlike a method page, which is a fragment
  the CMS concatenates and whose SEO fields are therefore left empty.

  The `seo_title` names the SDK and the page, for example `Python Delivery SDK API Reference |
  Contentstack`. The `seo_description` says what the reference covers and names the package.

2. **Page title**

  One H1, in the form `<SDK Name> API Reference`. For example `# Python Delivery SDK API Reference`.

  **Never repeat the title as an H2 below it.** The live Get Started pages do this, and the repeated
  heading pushes the first real section below the fold on a page where readers see the top third.

3. **Intro paragraph**

  One or two sentences. State what the reference covers, name the package in inline code, and say it
  is organized by class. Say what the reader can look up here, because that is what tells them
  whether to stay.

  Example: "This reference covers the public API of the `contentstack` package, organized by class.
  Use it to look up method signatures, parameters, return types, and worked examples."

  Do not open with the page describing itself ("this guide walks you through"). Do not restate the
  H1.

4. **Before you begin block** (required, immediately after the intro)

  A single blockquote carrying three facts. It must sit immediately after the intro paragraph, before
  any other section, because it is what a reader on the wrong page needs to see first.

  Format:

  ```
  > **Before you begin:** This reference assumes you have installed and initialized the SDK. If you
  > have not, complete the [Get Started with <SDK Name>](<get-started-url>) guide first. This SDK
  > requires <runtime and versions>. This reference documents version <version>, and the
  > [changelog](<changelog-url>) lists behavior changes between releases.
  ```

  The three facts, and why each is required:

  - **The Get Started link.** Readers arrive here from search having skipped setup. The quick-back
    rate on the current reference index pages is 23.53%, which is the signature of a reader who
    landed on a page that could not help them and left rather than navigating.
  - **The runtime versions this SDK supports.** This is a prerequisite, not trivia. A developer on
    an unsupported runtime will hit failures that look like SDK bugs, and the version requirement is
    the first thing that explains them. Name the versions, not a vague floor.
  - **The SDK version this reference documents, with a changelog link.** This is what a reader needs
    when code that worked last month stopped working. Without it, an upgrade regression is
    indistinguishable from a documentation error.

  Do not expand this block into a Prerequisites section with a checklist. That is Get Started's job.
  Three facts in one blockquote, then move on.

5. **Minimum Working Example** (renders as an H2)

  One complete, copy-pasteable snippet: import, initialize, make one call, use the result. It is the
  first thing on the page after the blockquote because a reader who can run one call has an anchor
  for everything below it.

  - Introduce it in under 25 words, saying what it does. The same limit the class template puts on
    its Class-Level Snippet.
  - Use the canonical placeholder tokens (`API_KEY`, `DELIVERY_TOKEN`, `ENVIRONMENT`, and the rest),
    never hardcoded values that look real.
  - Include error handling matching what the SDK actually does. If the SDK returns API rejections as
    an ordinary value with an `error` key rather than raising, the snippet checks that key. A first
    snippet that models the wrong error pattern is the one developers copy.
  - **Do not narrate installation.** No `npm install`, no `pip install`, no package-manager steps.
    That is Get Started, and repeating it here is the duplication this page exists to prevent.
  - Do not show three variants. One snippet. Variations belong in Key Usage Patterns.

6. **SDK Structure** (renders as an H2)

  Two or three sentences explaining the call model, then one sentence on where a chain starts.

  Contentstack SDKs use a builder pattern, and it is the single fact that makes the rest of the
  reference readable: each call returns a new object representing a narrowed scope or an added
  modifier, and a terminal call executes the request. Name the terminal calls explicitly, for example
  `fetch` for one result and `find` for a collection.

  State it even though it feels obvious. Only 3 of 110 benchmarked API documentation sets organize
  around SDK classes rather than REST resources, so a developer arriving with a REST mental model has
  no reason to expect this shape, and nothing else on the page tells them.

  This section also carries the reason errors surface where they do. A chainable setter stores a
  value and returns the instance, so an invalid argument fails on the terminal call, not where it was
  passed. Saying so once here saves the reader from misreading every Validation section in the
  reference.

  **No code in this section.** Item 5 already showed a working call and item 8 shows variations. A
  third snippet here adds nothing and pushes the navigation tables down the page.

7. **Class Overview** (renders as an H2)

  A table mapping every class in this SDK to its role and how a caller reaches it. With the Task
  Index, this is the page's primary navigation, and both must be reachable inside the top third of
  the page.

  **Columns, exactly these three, in this order:** Class | Role | Accessed via

  ```
  | Class | Role | Accessed via |
  | --- | --- | --- |
  | [Entry](Entry/class_reference.md) | Reads a single entry of a content type. | `stack.content_type(uid).entry(uid)` |
  | [Taxonomy](Taxonomy/class_reference.md) | Lists taxonomies and filters entries by term. | `stack.taxonomy()` |
  ```

  - **Every Class cell is a link** to that class's `class_reference.md`. A class name in plain text
    is the affordance failure the dead-click data measures: readers click it, nothing happens, and
    they have no other route to the page.
  - **Every class in the SDK appears exactly once.** A class missing from this table is unreachable
    from the reference landing page. A class listed twice implies two classes.
  - **Role is one sentence naming what the class represents.** Not what its methods do. That is the
    class page's Method Index.
  - **Accessed via shows the immediate call only**, in inline code. Not the full chain from
    initialization. The reader wants to know which handle returns this class, and a five-call chain
    obscures it.
  - **Do not list methods in this table.** Each class page's Method Index is the only list of that
    class's methods.
  - Group the table with bold lead-in sentences rather than headings if the SDK has more than about
    ten classes, following the same rule the class template applies to a long Method Index.

8. **Task Index** (renders as an H2)

  A table mapping common goals to the page where each one starts. This is the second entry point into
  the reference, for readers who know what they want to build but not which class owns it.

  It exists because the class hierarchy is not how developers arrive. 102 of 110 benchmarked
  documentation sets organize by resource or task rather than by SDK class, and the most frequent
  navigation recommendation in the support corpus is scenario-based routing with direct links into
  the reference. This table is that routing, and it does not replace the Class Overview, it sits
  beside it.

  **Columns, exactly these three, in this order:** Task | Start here | Class

  ```
  | Task | Start here | Class |
  | --- | --- | --- |
  | Fetch one entry by UID | [fetch](Entry/methods/fetch.md) | Entry |
  | Filter entries by a field value | [where](Query/methods/where.md) | Query |
  | Resize or reformat an image | [ImageTransform](ImageTransform/class_reference.md) | ImageTransform |
  ```

  - **Task is phrased as the reader's goal**, starting with a verb, in their words rather than the
    SDK's. "Fetch one entry by UID", not "Entry retrieval".
  - **Start here links to the specific page that answers it**, a method page when one method is the
    answer and a class page when the answer is a chain.
  - **Every link must resolve.** A dead link here is worse than an absent row, because the reader
    has already committed to the route.
  - Cover the common goals, not every possible one. Eight to twelve rows. A table that lists
    everything is a second Class Overview and gets scanned like one.

9. **Key Usage Patterns** (renders as an H2)

  Three or more short examples showing the chaining style in practice, each under its own H3.

  - **Each example needs a named scenario title** describing the situation it demonstrates. The title
    is how a reader scanning the page picks which one to read.
    - Correct: "Fetch a single entry with its references resolved"
    - Correct: "Paginate a large query"
    - Correct: "Transform an image on delivery"
    - Wrong: "Example 1", "Basic usage", "The following examples demonstrate these patterns."
  - **Assume the setup from item 5.** Do not repeat the import and initialization in every snippet.
    Say once, above the examples, that they assume an initialized `stack`.
  - Keep each snippet focused on the chain being shown, with minimal surrounding boilerplate.
  - Use realistic field and content-type names, never `field1` or `my_field`.
  - Three is the floor, not the target. Add a fourth or fifth when the SDK has a genuinely distinct
    pattern, and stop when the next example would only rename a variable.

10. **SDK-Wide Notes** (renders as an H2)

  The cross-cutting facts true of every class in this SDK, documented once, in one table. This is the
  top rung of the deduplication ladder.

  **Columns, exactly these three, in this order:** Concern | Behavior | Default when unset

  ```
  | Concern | Behavior | Default when unset |
  | --- | --- | --- |
  | Authentication | Reads the API key, delivery token, and environment from the `Stack` instance. No method takes credentials directly. | Not applicable, the constructor takes all three. |
  | Regions and endpoints | Pass `region` to `contentstack.stack({...})` to target a region other than the default. | North America. |
  | Branches | Every method accepts the optional `branch` parameter on the `Stack` instance. | `main`. |
  | Rate limiting and retry | This SDK does not auto-retry on `429`, so implement backoff in your calling code. | No retry. |
  | Locales and fallback | Send `locale` on the call, and chain `include_fallback` to accept an earlier locale in the hierarchy. | The stack's master locale, with no fallback. |
  ```

  A table rather than a run of bold labels with bullets under each. Five notes in the label-and-bullet
  form is fifteen lines of near-identical shape, and a reader looking for one fact has to read all of
  it. The table puts every concern in one column so the reader finds the row and stops.

  - **The Behavior cell is one or two sentences.** If a concern needs a paragraph, it is not
    SDK-wide, or it belongs in its own linked doc. Point at that doc from the cell instead.
  - **The Default when unset cell is never blank.** Name the value the SDK falls back to, or write
    `Not applicable` when the parameter is required and has no default. This mirrors the never-blank
    Default rule on the method-level parameter table, and for the same reason: a blank cell reads as
    an undocumented default rather than an absent one. Undocumented parameters and defaults are the
    single largest gap in the support corpus, at 39 threads, so this column is the one doing the most
    work on this page.
  - **Never take a default from an API reference doc or a Postman collection.** Read it off the SDK
    signature. The same rule as AR-10, one tier up.

  **Rows that recur.** Include a row when the concern is true of every class in the SDK, omit it when
  it is not, and never pad the table to fill this list. The list is not closed, so add a row for any
  other concern that is genuinely SDK-wide.

  - **Authentication** *(required)*: which credentials the SDK reads, where they are passed, and which
    token type this SDK needs.
  - **Regions and endpoints** *(required when the SDK serves more than one region)*: the region values
    the SDK accepts. The default matters most here, because a stack in a non-default region returns
    authentication-shaped failures when the SDK talks to the wrong host.
  - **Branches** *(required when every class supports branch scoping)*. If branch support is confined
    to some classes, this row belongs on those class pages instead.
  - **Rate limiting and retry** *(required when the SDK talks to a rate-limited API tier)*: use the
    same wording as the class template so the two tiers cannot drift.
    - If auto-retry is built in: "This SDK automatically retries on 429 with configurable delay and
      attempt limits."
    - If auto-retry is not built in: "This SDK does not auto-retry on 429, so implement backoff in
      your calling code."
    - Do not omit this row. The failure mode is developers assuming retry is built in when it is not,
      and they discover it under production load.
    - Do not inline the full retry configuration. Point at the retry doc from the Behavior cell.
  - **Timeouts** *(required when the SDK accepts a timeout)*.
  - **Locales and fallback** *(required when locale handling is uniform across classes)*.
  - **Proxy configuration** *(required when the SDK accepts proxy settings)*.

  The three columns hold for every SDK family even though the concerns differ, because each concern
  has a behavior and a default. A Management SDK swaps the token row and adds authorization scope. An
  App SDK carries field access and unsaved-entry rows instead of regions. The shape does not change.

  **The token-type warning goes immediately below the table**, not in a cell. Authentication is the
  largest single theme in the SDK issue corpus at 38 tickets, and the failure is close to silent:
  a management or preview token used where a delivery token belongs returns error code `109`, "We
  can't find that Stack", which names neither the token nor the fix. A reader holding a valid token
  has no way to tell it is the wrong kind, and that warning does not compress into a table cell.

  ```
  > **Warning:** This SDK requires a delivery token. A management token or a preview token returns
  > error code `109`, "We can't find that Stack", which does not report that the token type is wrong.
  > Create a delivery token under Settings, Tokens in your stack.
  ```

  Every row must be true of every class. When you find yourself writing "except for the Asset class",
  the fact belongs on the class pages, not here.

11. **SDK Limitations** (renders as an H2, required when any are known)

  A scannable table of things developers attempt with this SDK and cannot do. This page owns the
  SDK-wide list. It is not duplicated on the Get Started page, and a limitation confined to one class
  belongs in that class's Capability Matrix instead.

  It lives here rather than on the setup page because a developer who hits a limitation is reading
  the reference, not re-reading a page they visited once during installation. The known failure is a
  limitation that was documented and never found.

  **Columns, exactly these three, in this order:** Capability | Supported | Notes / Alternative

  These are the same columns as the class-level Capability Matrix, so a reader moving between the two
  tiers reads the same table shape.

  ```
  | Capability | Supported | Notes / Alternative |
  | --- | --- | --- |
  | Query across multiple content types in one request | No | Run a separate query per content type. |
  | Recursive resolution of embedded items inside references | No | Fetch embedded items of each reference in a further call. |
  | Reference resolution deeper than two levels | No | Fetch the deeper references directly. |
  | Automatic encoding of special characters in query values | No | Encode the value before passing it. |
  ```

  Two tests every row must pass:

  - **It is a capability developers genuinely attempt and fail at**, traceable to a real support
    signal. Not a list of everything the SDK cannot do. An exhaustive list of impossibilities reads
    as noise and buries the four rows that matter.
  - **It is true of the whole SDK.** A limitation that applies to one class goes in that class's
    Capability Matrix. A reader who finds it here will assume it applies everywhere.

  **The Notes / Alternative cell is never blank.** Name the supported workaround, or state plainly
  that none exists. A row with an empty alternative leaves the reader knowing they are blocked and
  not knowing what to do next, which is worse than no row at all.

  Omit the whole section when the SDK has no known limitations that clear both tests. Do not leave an
  empty table.

---

## Linking out to another doc

The same convention as the class and method templates. All three files must agree, because a reader
moving between them should not have to learn a second linking style.

- If a plain-text keyword already exists in the sentence, and it is not bolded, inline code, or
  otherwise special-characterized, hyperlink that keyword directly. No separate callout needed.
- If there is no such keyword, or the only candidate is already formatted (for example
  `` `retry_strategy` ``), add an `Additional Resources` callout instead of forcing the link onto
  formatted text or bolting it onto an unrelated word.
- Make the callout label agree in number with what it holds. One link is an `Additional Resource`
  callout, two or more are `Additional Resources`.

Links belong inline, in the section that needs them. **Do not add a standalone Additional Resources
section at the end of the page.** A closing link list separates every link from the context that
explains why the reader would follow it, and on a page whose readers see the top third, a bottom
section is not read at all.

---

## What does not belong on this page

Each of these is a defect observed on a live page, not a hypothetical.

- **Installation or authentication setup steps.** No `npm install`, no `pip install`, no token
  generation walkthrough. That is Get Started. The live About page carries a Quickstart section its
  own template forbids, and the result is three pages describing the same setup differently.
- **Method signatures, or any flat list of methods.** Each class page's Method Index is the only list
  of that class's methods, and the method pages own the signatures.
- **An H2 repeating the H1.**
- **A Common Questions or FAQ section.** An answer belongs in the section that owns the topic. A
  question restated as a heading at the bottom of the page is a sign the topic has no owner.
- **A standalone Additional Resources section.** See above.
- **A trailing horizontal rule.** Method pages end with one because the CMS concatenates them into a
  rendered class page. A usage guide is a standalone page, so the rule renders as a stray divider.

---

## Provenance

The evidence behind each section, including which sections rest on counted support signals and which
rest on behavioral data alone, is recorded in `usage-guide-derivation.md` in this folder. Read it
before changing the section order or dropping a required section.
