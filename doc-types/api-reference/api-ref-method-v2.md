1. **Method Name**  H3 level
2. One-Sentence Summary:
  - The {methodname} action (e.g., "Retrieves," "Creates," "Deletes") {what}
3. Returns:  Type | Description (Short within 5-6 words)
  - Format as a single line: **Returns:** followed by the Type, a period, then the Description. For example: `**Returns:** Promise. The requested entry variant.`
  - Describe what the response **contains**, not what the operation did. Avoid vague process words like "confirmation of", "result of the operation", or "response from". Instead use noun phrases that name the content: "The requested entry variant.", "The variants associated with the specified entry.", "The deletion result."
4. The Five-Column Parameter Table: Every table must include exactly these columns, in this order:
  - **Name:** The variable name.
  - **Type:** The exact data type (e.g., String, Int, Enum). This should be confirmed by the codebase. If the type is not known, report to the user.
  - **Required:** A clear Yes/No indicator.
  - **Default:** The value used when the parameter is omitted.
    - For optional parameters: state the actual default (e.g., `"en-us"`, `false`, `100`).
    - When the SDK itself sets no default and the API applies its own: write `"API default"` and name the value if known (e.g., `"API default (100)"`).
    - For required parameters: write `Not applicable`. Do not use an em dash. C3-05 forbids em dashes outside code blocks, and a table cell is not a code block.
    - Never leave this column blank.
    - **Never take a default from an API reference doc or a Postman collection.** Those `Default:` fields are sample request values, not API defaults, and they are wrong often enough to be unusable. Tell-tale signs: a `skip` parameter with a non-zero "default", a `limit` listed on a single-item fetch endpoint, or a required parameter carrying a "default" at all. Read the default off the SDK signature instead. When the SDK sets none, say the API applies its own page size or value and do not invent a number. Naming a fabricated default is worse than saying the value is undocumented, because the reader cannot tell it is wrong.
  - **Description:** The specific purpose of the parameter. It should contain the following in under 10 words.
    - Functional Definition: What the property is or what it defines (e.g., "Defines the caching strategy").
    - Outcome-oriented statement.

## **Validation**

- Explain what errors would be thrown if there are invalid, null, or empty values for each parameter.
- Always explain **why** the constraint exists, not just what is thrown. Format: "Throws `X` if `Y` because `Z`." For example: "Throws `InvalidOperationException` if no variant UID is set because `Fetch()` retrieves a single variant and requires a specific identifier."
- Mention any cases where errors would not be thrown even if the value provided is null, empty, or invalid.
- **Where the error surfaces** *(required for any method in a chainable API)*: A chainable setter or filter almost never raises. It stores a value and returns the instance, so the failure appears later, on the terminal call. Name the terminal call explicitly rather than leaving the reader to assume this method validates its own input. Format: "Errors that do occur come from the `find()` call that follows, not from `limit()`."
- **The raise-versus-return-an-error distinction** *(required when the SDK returns the raw API response)*: Many SDKs raise only on transport failure and hand back an API rejection as an ordinary return value carrying an `error` key. A reader who wraps the call in `try` and nothing else will silently treat a 422 as success. When this is how the SDK behaves, say so as a nested list under the "where the error surfaces" bullet, in this order:
  - The terminal call raises an exception only for network failures (timeout, DNS error, dropped connection).
  - An API-level rejection returns as a normal result with an `error` key. It does not raise an exception.
  - Check the result for an `error` key even inside a `try` block.
  Confirm the behavior against the SDK's HTTP layer before asserting it. If the SDK does raise on HTTP error status, omit this list rather than inverting it. Whatever you state here must match the first code example on the page (see **Implementation & Examples**).
- **Error Reference** *(required for methods that make an HTTP call, omit for pure client-side utility methods)*:
Generic HTTP errors (401, 403, 429, 500) that can occur on any API call are already documented in the full error references. Link to the appropriate one at the bottom of the Validation section:
  - Delivery SDK methods → [Delivery API Errors](https://www.contentstack.com/docs/developers/apis/content-delivery-api#errors)
  - Management SDK methods → [Management API Errors](https://www.contentstack.com/docs/developers/apis/content-management-api#errors)
  In addition, add an inline table **only** for errors that require method-specific context to diagnose: errors that arise from a specific parameter combination, payload structure, or state unique to this method, and that a developer cannot correctly diagnose by reading the general error reference alone.

  | HTTP Status | Error Code | Cause                                 | Fix                                                    |
  | ----------- | ---------- | ------------------------------------- | ------------------------------------------------------ |
  | 422         | 141        | Payload not wrapped in `global_field` | Wrap all attributes inside `{ global_field: { ... } }` |

  Decision rule: include a row if:
  - The error only occurs under conditions specific to this method (not just "invalid auth" or "rate limit"), **and**
  - A developer seeing only the error code cannot identify the fix without knowing this method's behavior.
  If all likely errors are already covered by the general reference, skip the inline table entirely and use only the link.

## **Warnings and Important Notes**

- Use `**IMPORTANT:`** for constraints that, if violated, produce silent failures or misleading errors with no clear indication of the root cause (e.g., positional argument order, irreversible operations).
- Use `> **Warning:`** (blockquote format) for destructive or irreversible operations (e.g., Delete, hard resets).
- Use `> **Note:`** for informational context that is helpful but not critical.
- **Document each warning only once** at the most appropriate level:
  - If a warning applies to a single method, place it in that method's section.
  - If it applies to all methods in a class, place it in the class intro. Do not repeat it in every method.
  - Never duplicate the same warning across sibling methods (e.g., Find, Fetch, Create all repeating the same positional-arg note).
- **Linking out to another doc (e.g., a feature guide or conceptual doc):**
  - If a plain-text keyword already exists in the sentence, and it is not bolded, inline code, or otherwise special-characterized, hyperlink that keyword directly. No separate callout needed.
  - If there is no such keyword, or the only candidate is already formatted (e.g., `` `retry_strategy` ``), add an `Additional Resources` callout instead of forcing the link onto formatted text or bolted onto an unrelated word.
  - Make the callout label agree in number with what it holds. One link is an `Additional Resource` callout, two or more are `Additional Resources`. A method page that links only the API error reference uses the singular. A class page listing several guides uses the plural.

## **Naming the actor**

Two different jobs look similar and get confused, so the rule is which job the mention is doing, not which method is mentioned.

- **The method is acting, on the page being read.** Use the bare name in inline code, as the subject of the sentence. For example: "`find` serializes the condition into the `query` parameter" or "`fetch` sends the flag on that call." Do not link it. The reader is already on the page that describes it, and a link back to the current context is noise.
- **You are sending the reader somewhere else.** Use the article, the link, and the word "method". For example: "See the [find](find.md) method" or "Use the [and_](and_.md) method to combine two conditions."
- Reserve "you" for what the caller does ("call `include_count` and compare `count`") and name the library "the SDK" for what it does on its own ("the SDK stores conditions in a dictionary"). Do not write "you" for behavior the reader does not control.
- Do not write "the `find` method" with backticks but no link. That form reads like a cross-reference that failed to become one. Either it is the actor, so drop the article and the word "method", or it is a cross-reference, so add the link.

## **Behavior**

- Format each distinct fact as its own bullet, not as consecutive prose paragraphs. A reader scanning a wall of one-sentence paragraphs cannot tell where one fact ends and the next begins. Nest a sub-bullet when a fact branches into multiple outcomes (see the equivalent rule for Class-Level Notes in `common-rules.md`).
- **Response shape:** If a method returns the raw API response or a loosely typed object, state that explicitly.
Do not imply a fixed schema unless guaranteed by SDK types or documentation.
- **Request execution model**: Each terminal data-fetching call typically maps to a single HTTP request unless documented otherwise.
- **Pagination scope ("all results"):** The client does not automatically iterate through all pages unless explicitly documented. Document how pagination is configured (for example, `limit` / `skip`). If omitted, clarify that API defaults apply unless defined by the SDK.
- **Method associations:** Call out related API methods that interact with the property where relevant.
- **Limitations** *(required when this method has behaviors that developers commonly assume but that are not supported)*:
  - State explicitly what this method cannot do. Format: "Does not {capability}. Use {alternative} instead."
  - Link to the supported alternative or workaround for each limitation.
  - Example: "Does not recurse into referenced entries' embedded items. Make a separate `fetch()` call per reference."
  - Example: "Does not support nested array filtering (`$elemMatch`). Use client-side filtering with `include_publish_details: true` as a workaround."
  - Omit this subsection entirely if there are no commonly-assumed-but-unsupported behaviors.

## **Implementation & Examples**

- Each example **must have a named scenario title** describing what specific situation it demonstrates. The title is how a developer scanning the page decides which example to read.
  - ✅ "Basic usage: retrieve a single entry by UID"
  - ✅ "Filtering with special characters in a query field"
  - ✅ "Error handling: catching a 422 validation error"
  - ✅ "Deep reference resolution with `include_all_depth`"
  - ❌ "The following examples demonstrate these behaviors." (Generic. The heading already communicates it.)
- **Required scenarios** (include only the ones that are genuinely distinct for this method):
  1. **Basic usage**: the minimal valid call with required parameters only.
  2. **All parameters**: a call demonstrating every optional parameter.
  3. **Error handling**: how to catch, inspect, and react to errors from this method.
  4. **Edge case / constraint**: demonstrates a known limit or gotcha (e.g., special characters in query values, pagination boundary, depth limit, version-specific behavior).
  Do not manufacture scenarios that add no new information. One well-named example is better than four near-identical ones.
  - **All parameters means all.** Every parameter in this method's own Six-Column Parameter Table must appear passed directly to this method in the "All parameters" example, across one or more examples if it cannot fit in one. Do not substitute a differently-named method that happens to update the same underlying state (for example, chaining `.param('locale', 'en-us')` does not demonstrate `find`'s own `params` argument, even though both write to the same query-parameter store) and do not label a chained-only example "All parameters" when the method's own parameter is left undemonstrated.
- For **branch-scoped examples**: if branch scoping applies uniformly to all methods in the class, add a class-level Branch Scoping note (see `api-ref-class-v2.md`) instead of adding a separate "scoped to a branch" example in every method. Only add a branch example at the method level when the branch behavior is unique to that method.
- Code Snippet
  - Provide a complete example that includes imports and basic error handling.
  - Provide inline comments as required.
  - Provide multiple examples if all the parameters could not be demonstrated in a single example. But make sure that we demonstrate all the parameters.
- **The first example must demonstrate whatever the Validation section claims about error handling.** If Validation says an API rejection returns an `error` key instead of raising, the first example has to check that key. A page that instructs the reader to check for `error` and then shows a bare `try` and `except` teaches the opposite of what it says, and the example is what gets copied.
  - Use the full form once, in the first example on the page:

    ```
    try:
        result = <the call>
    except Exception as error:
        # Raised only for network failures (timeout, DNS error, dropped connection)
        print('Request failed:', error)
    else:
        if 'error' in result:
            # The API rejected the request and returned the error body
            print('API error:', result['error'])
        else:
            <use result>
    ```

  - Later examples on the same page use the short form, catching the SDK's exception type and printing it. Repeating the full branch in every example on a page buries the parameter being demonstrated under identical boilerplate.
  - An example whose whole point is a client-side raise (a `KeyError` on a null argument, an `AttributeError` from the wrong instance type) catches that specific exception instead, with a comment on the first line of the handler saying when it fires.

