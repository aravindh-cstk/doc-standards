---
uid: "PENDING:Taxonomy"
seo_title: "Taxonomy | Python Delivery SDK | Contentstack"
seo_description: "The Taxonomy class in the Python Delivery SDK lists published taxonomies, fetches a single taxonomy, and filters entries by taxonomy terms."
---

# Taxonomy

[Taxonomy](/docs/headless-cms/about-taxonomy) organizes content in a stack into hierarchical terms that you can tag entries with. Use this class to
- list the taxonomies published in a stack
- read one taxonomy by its UID
- filter entries by the terms they carry

| Name | Type | Description |
| --- | --- | --- |
| taxonomy_uid | str | UID of the taxonomy. |

Omit `taxonomy_uid` to get a `TaxonomyQuery`: call `find()` alone to list taxonomies, or chain a filter before `find()` to filter entries. Pass it to get a `Taxonomy` for reading one taxonomy by UID.

## Instance State

`stack.taxonomy()` is the only way to get an instance, and the argument you pass decides which methods are available.

- Call `stack.taxonomy()` without a UID to work across taxonomies. This returns a `TaxonomyQuery`, which lists taxonomies (`find`, `limit`) and filters entries by term (`in_`, `below`).
- Call `stack.taxonomy('<TAXONOMY_UID>')` to work with one taxonomy. This returns a `Taxonomy`, which reads that taxonomy (`fetch`, `locale`) and reaches its terms (`term`).

See the Method Index below for the full set in each group.

The two sets do not overlap, apart from `param`. Calling `fetch` on the no-UID object, or `limit` on the single-taxonomy object, raises `AttributeError`.

> **Warning:** `stack.taxonomy('')` is not the same as `stack.taxonomy('<TAXONOMY_UID>')`. The SDK tests the UID for truthiness, so an empty string falls through to the no-UID branch and you get a `TaxonomyQuery` back rather than an error. A variable that is unexpectedly empty therefore produces a taxonomy listing instead of the fetch you intended.

## Class-Level Notes

**One method, two endpoints.**
- `find` behaves differently depending on what you chain before it.
    - With no filter chained it lists taxonomies through `GET /taxonomies`.
    - With any filter chained it returns entries through `GET /taxonomies/entries`.
- The second path is the entry-filter behavior that predates taxonomy publishing, and it is unchanged. See the [find](methods/find.md) method for the full description.

**Pagination.**
- `skip`, `limit`, and `include_count` apply to the taxonomy-list path only. Chaining a filter routes `find` to the entry-filter endpoint, which never reads them, so `find` silently drops them.
- Omitting `limit` does not return every taxonomy. The API applies its own page size. Call `include_count` and compare `count` against the number of taxonomies returned to find out whether more remain.
- The SDK does not page automatically. Combine `skip` and `limit` to retrieve the full list one page at a time.

**How filters combine.**
- The eight filter methods store their conditions in a dictionary, so a second condition on the same key replaces the first rather than adding to it.
    - `in_`, `exists`, and the four hierarchy filters key on the field path, so two calls naming the same field collide.
    - `or_` and `and_` each own one shared key, so a second call to either replaces its whole condition set.
- Use the [and_](methods/and_.md) or the [or_](methods/or_.md) method to express two conditions on one field.

**Authentication.**
- Every method that makes a request reads the API key, delivery token, and environment from the `Stack` instance.
- No method takes credentials directly.

**Rate limiting and retry.**
- This SDK retries on `408` and `429` automatically, up to **five attempts**. The default strategy uses `backoff_factor=0`, so those retries fire back to back with no delay between them. A rate limit needs time to reset, and this default gives it none.
- Pass your own `retry_strategy` to `Stack` with a non-zero backoff factor if you expect to hit `429`.

> **Additional Resources:** [Implement Retry Mechanism with Python Delivery SDK](/developers/sdks/content-delivery-sdk/python/python-delivery-retry-mechanism) covers the full set of `retry_strategy` parameters and backoff configuration examples.

## Method Index

The groups below follow the Instance State split: which methods you can reach depends on whether you passed a UID to `stack.taxonomy()`.

**List taxonomies.** Available on `stack.taxonomy()` when you chain no filter.

| Method Name | Returns | Description |
| --- | --- | --- |
| [find](methods/find.md) | The published taxonomies, or the entries matching the chained filter. | Lists taxonomies, or returns entries when you chain a filter. |
| [skip](methods/skip.md) | The same query, for chaining. | Skips a number of taxonomies for pagination. |
| [limit](methods/limit.md) | The same query, for chaining. | Caps the number of taxonomies the query returns. |
| [include_count](methods/include_count.md) | The same query, for chaining. | Adds the total taxonomy count to the response. |

**Filter entries by term.** Available on `stack.taxonomy()`. Chain one of these, then call [find](methods/find.md) to get entries instead of taxonomies.

| Method Name | Returns | Description |
| --- | --- | --- |
| [in_](methods/in_.md) | The same query, for chaining. | Matches entries tagged with any of the given terms. |
| [or_](methods/or_.md) | The same query, for chaining. | Matches entries satisfying any of the given conditions. |
| [and_](methods/and_.md) | The same query, for chaining. | Matches entries satisfying all of the given conditions. |
| [exists](methods/exists.md) | The same query, for chaining. | Matches entries where a taxonomy field is present. |
| [equal_and_below](methods/equal_and_below.md) | The same query, for chaining. | Matches a term and its descendants. |
| [below](methods/below.md) | The same query, for chaining. | Matches the descendants of a term, excluding the term. |
| [equal_and_above](methods/equal_and_above.md) | The same query, for chaining. | Matches a term and its ancestors. |
| [above](methods/above.md) | The same query, for chaining. | Matches the ancestors of a term, excluding the term. |

**Read one taxonomy.** Available on `stack.taxonomy('<TAXONOMY_UID>')`.

| Method Name | Returns | Description |
| --- | --- | --- |
| [fetch](methods/fetch.md) | The requested taxonomy. | Reads one taxonomy by its UID. |
| [locale](methods/locale.md) | The same taxonomy, for chaining. | Sets the locale for the fetch. |
| [include_fallback](methods/include_fallback.md) | The same taxonomy, for chaining. | Returns an earlier locale in the hierarchy when the taxonomy lacks a localization. |
| [include_branch](methods/include_branch.md) | The same taxonomy, for chaining. | Adds the `_branch` field to the response. |
| [term](methods/term.md) | A single term, or a query across the taxonomy's terms. | Moves down to the terms of this taxonomy. |

**Available on both.** Present on whichever object `stack.taxonomy()` returns.

| Method Name | Returns | Description |
| --- | --- | --- |
| [param](methods/param.md) | The same object, for chaining. | Adds an arbitrary query parameter. |

## Class-Level Snippet

This snippet covers all three call shapes. It lists the published taxonomies, reads one in a specific locale, then filters entries by a term.

```
import contentstack

stack = contentstack.Stack('<API_KEY>', '<DELIVERY_TOKEN>', '<ENVIRONMENT>')

try:
    # List the published taxonomies, newest page first.
    listing = stack.taxonomy().limit(10).include_count().find()
    print('total taxonomies:', listing.get('count'))

    # Read one taxonomy, falling back to the parent locale if needed.
    regions = stack.taxonomy('regions').locale('fr-fr').include_fallback().fetch()
    print('taxonomy name:', regions.get('name'))

    # Filter entries by their tagged terms.
    entries = stack.taxonomy().equal_and_below('taxonomies.regions', 'europe').find()
except Exception as error:
    print('Taxonomy request failed:', error)
```
