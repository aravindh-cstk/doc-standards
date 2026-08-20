---
uid: "PENDING:Taxonomy/limit"
seo_title: ""
seo_description: ""
---

### limit

The `limit` method caps the number of taxonomies the response contains.

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| limit | int | Yes | Not applicable | Maximum number of taxonomies to return. |

**Returns:** TaxonomyQuery. The same query, for chaining.

#### Validation

- There is no client-side validation. The SDK stores and sends a negative or non-integer value as given.

- Errors that do occur come from the `find()` call that follows, not from `limit()`.

    - `find()` raises an exception only for network failures (timeout, DNS error, dropped connection).
    - An API-level rejection (for example, an invalid limit value) returns as a normal result with an `error` key. It does not raise an exception.
    - Check the result for an `error` key even inside a `try` block.

> **Additional Resource:** Refer to [Delivery API Errors](https://www.contentstack.com/docs/developers/apis/content-delivery-api#errors) for the full error code list.

#### Behavior

- Client-side only. Sets the `limit` query parameter and makes no request. `find` sends the value on that call.

- Omitting `limit` does not return every taxonomy. The API applies its own page size instead. See Pagination on the [Taxonomy](../class_reference.md) class page for how to detect a truncated list and page through the rest.

- Chaining a filter such as `in_` silently drops the limit.

#### Example

**Basic usage: return at most ten taxonomies**

```
import contentstack

stack = contentstack.Stack('<API_KEY>', '<DELIVERY_TOKEN>', '<ENVIRONMENT>')

try:
    result = stack.taxonomy().limit(10).find()
except Exception as error:
    # Raised only for network failures (timeout, DNS error, dropped connection)
    print('Request failed:', error)
else:
    if 'error' in result:
        # The Delivery API rejected the request and returned the error body
        print('Delivery API error:', result['error'])
    else:
        print('returned', len(result.get('taxonomies', [])), 'taxonomies')
```

**Edge case: chaining a filter ignores the limit**

```
import contentstack

stack = contentstack.Stack('<API_KEY>', '<DELIVERY_TOKEN>', '<ENVIRONMENT>')

try:
    # This lists at most 5 taxonomies.
    capped = stack.taxonomy().limit(5).find()

    # This returns entries, and the limit below has no effect.
    # Use Query.limit on a content type query to cap entry results instead.
    entries = stack.taxonomy().limit(5).in_('taxonomies.colors', ['red']).find()
except Exception as error:
    print('Request failed:', error)
```

---
