1. **Class Name  H2 level**
2. **Briefing of the class:**

- One-line Summary:  The {classname}  and state what this class represents and its primary responsibility.
- When to Use This Class: A short, outcome-oriented explanation of *when a developer should reach for this class*.
- Conceptual Role (Optional but powerful):  Where this class fits in the SDK (e.g., "Acts as a query builder for assets").

1. Returns:  Type | Description (Short within 5-6 words)
2. ### **Instance State** (required if method availability depends on how the class was initialized)
  When different initialization arguments unlock different sets of methods, document this upfront as scannable bullets, not as a paragraph. This prevents developers from hitting runtime errors and wondering why.
   Format:
  - Call `.ClassName()` without a UID to operate on the collection (e.g., `Find`, `FindAsync`).
  - Call `.ClassName(uid)` to operate on a specific item (e.g., `Fetch`, `Create`, `Update`, `Delete`).
  - Optionally pass additional scoping arguments as further positional parameters (e.g., `.ClassName(uid, branch)`).
   Follow this section immediately with any **IMPORTANT** positional argument warnings if the constructor or factory method accepts positional string parameters that the SDK does not validate.
   **Do not enumerate every method here.** Name two per branch as examples, as the format above does, then point at the Method Index for the full set. Listing all of them twice means the two lists drift apart, and the index is the one readers scan.
   **State what happens on the wrong branch.** The value of this section is preventing a runtime surprise, so say which exception the reader gets when they call a method the other branch owns (for example, `AttributeError` in Python, or a compile error in a typed SDK), and call out any argument that is silently accepted but does not do what it looks like. An empty string that is falsy and quietly takes the no-UID branch belongs here as a `Warning` callout, because nothing in the reader's code will fail at the point of the mistake.
3. ### **Class-Level Notes** (required for cross-cutting concerns)
  If any behavior, constraint, or optional parameter applies uniformly to **all methods** in the class, document it once here as a named subsection. Do not repeat it in every method.
   Common examples:
  - **Branch Scoping:** "All methods support branch scoping through the optional `branch` parameter. When provided, the SDK sends the request against the specified branch."
  - **Authentication:** Any auth requirement shared across all methods.
  - **Pagination:** If pagination behavior is consistent across all query methods.
  - **Rate Limiting & Retry** *(required when the class interacts with a rate-limited API tier)*: State in one sentence whether the SDK auto-retries on 429 and what to do if it does not. Then link to the SDK's retry configuration docs. Do not duplicate retry configuration details inline.
    - If auto-retry **is** built in: "This SDK automatically retries on 429 with configurable delay and attempt limits."
    - If auto-retry **is not** built in: "This SDK does not auto-retry on 429, so implement backoff in your calling code."
    - Do not omit this note for classes that make bulk or high-frequency calls. The key failure mode is developers assuming retry is built in when it is not.
    - The retry configuration parameter (e.g., `retry_strategy`) is inline code, so it cannot carry the link itself. Point the reader to the SDK's retry configuration doc with an `Additional Resources` callout instead of an inline "see ... →" sentence.
   Placing these notes at the class level avoids the repetition that results from copying the same note into 10+ method sections.
- **Linking out to another doc (e.g., a feature guide or conceptual doc):**
  - If a plain-text keyword already exists in the sentence, and it is not bolded, inline code, or otherwise special-characterized, hyperlink that keyword directly. No separate callout needed.
  - If there is no such keyword, or the only candidate is already formatted (e.g., `` `retry_strategy` ``), add an `Additional Resources` callout instead.
4. ### **Capability Matrix** *(optional, use when the class has capabilities that are commonly assumed but not supported)*
  A scannable table of what this class can and cannot do. Include only capabilities that developers genuinely ask about or attempt and fail. Do not list every impossible thing, only the ones that cause real support friction.
  | Capability | Supported | Notes / Alternative |
  |---|---|---|
  | Query across multiple content types | No | Run a separate query per content type |
  | Recursive embedded item resolution | No | Fetch embedded items of references via additional calls |
  | Auto-retry on 429 | No | Implement retry in calling code |
  | Nested array filtering (`$elemMatch`) | No | Use `include_publish_details: true` and filter client-side |

  Omit this section entirely if the class has no commonly-assumed-but-unsupported behaviors.
5. ### **Class-Level Properties Table** (optional  applicable only if the class has any properties)
  1. Class-level properties that define what this class holds
  2. **Table format with the following columns:** Property | Type | Access | Default | Description
6. **Method Index:**
  1. Quick, scannable list of available actions.
  2. Table format: Method Name | Returns | Description
    - The Returns column should use the same noun-phrase style as the method-level Returns section (e.g., "The requested entry variant." not "ContentstackResponse object").
    - For async variants, note the return type as `Task<ContentstackResponse>`.
  3. The Method Index table is the only list of the class's methods. Do not also add a separate flat bullet list of method links (e.g., a trailing "## Methods" section) elsewhere in the doc, it duplicates the table with no added information.
  4. **Group the index when a flat table stops being scannable.** Group it if the class has more than about ten methods, or if method availability depends on instance state. One table of eighteen rows tells the reader nothing about which methods work together, and a reader who has an instance in hand cannot tell which half of the table applies to them.
    - Group by what the reader is trying to do, not by the SDK's internal class hierarchy. Readers arrive with a goal, not a type diagram. When the goal-based grouping happens to match the instance-state split, say so once in a lead-in sentence.
    - Head each group with a **bold sentence, not a heading**. An H3 per group fragments the page outline and pushes the real sections down the table of contents.
    - Follow the bold label with an availability sentence naming the call shape that reaches the group, for example "Available on `stack.taxonomy()` when you chain no filter." Apply this to every group, including the last one, so the pattern does not break.
    - Give a method exactly one row across all groups. When one method serves two groups, keep the single row and link it from the other group's availability sentence instead. Two rows with the same name imply two callable methods.
    - Put a method available on every instance in its own final group rather than repeating it in each.
  5. The Returns cell must be the same sentence as the method page's Returns line, not a paraphrase. These two drift silently, and the index is what readers trust.
7. **Class-Level Snippet**:
  1. One complete, copy-pasteable end-to-end example showing the most common workflow.
  2. Short introduction before the code snippet under 25 words with the following information included
    - What is this code snippet
    - What does it do
