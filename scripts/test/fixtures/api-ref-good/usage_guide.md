---
uid: "PENDING:usage_guide"
seo_title: "Python Delivery SDK API Reference | Contentstack"
seo_description: "API reference for the contentstack Python Delivery SDK, covering the Taxonomy class, the builder pattern, and worked query examples."
---

# Python Delivery SDK API Reference

This reference covers the public API of the `contentstack` package and groups it by class. Use it to look up method signatures, parameters, return types, and worked examples.

> **Before you begin:** This reference assumes you have installed and initialized the SDK. If you have not, complete the [Python Delivery SDK Get Started](/developers/sdks/content-delivery-sdk/python/get-started) guide first. This SDK requires Python 3.8 or later. This reference documents version 2.4.0, and the [changelog](/developers/sdks/content-delivery-sdk/python/changelog) lists behavior changes between releases.

## Minimum Working Example

This snippet reads a stack, lists its published taxonomies, and prints the total count.

```
import contentstack

stack = contentstack.Stack('<API_KEY>', '<DELIVERY_TOKEN>', '<ENVIRONMENT>')

try:
    result = stack.taxonomy().limit(10).include_count().find()
except Exception as error:
    # Raised only for network failures (timeout, DNS error, dropped connection)
    print('Request failed:', error)
else:
    if 'error' in result:
        # The API rejected the request and returned the error body
        print('API error:', result['error'])
    else:
        print('total taxonomies:', result.get('count'))
```

## SDK Structure

The SDK follows a builder pattern. Each call returns a new object that narrows the scope or adds a modifier to a pending request. A terminal call executes the request and returns data. The terminal calls are `fetch` for one result and `find` for a collection.

Every operation starts from a `Stack` instance. From there you chain to the class that represents the resource you want.

Because a chainable method stores a value and returns the instance, an invalid argument surfaces on the terminal call rather than where you passed it. Each method page names the call that raises.

## Class Overview

| Class | Role | Accessed via |
| --- | --- | --- |
| [Taxonomy](Taxonomy/class_reference.md) | Lists published taxonomies and filters entries by term. | `stack.taxonomy()` |

## Task Index

| Task | Start here | Class |
| --- | --- | --- |
| List the taxonomies published in a stack | [Taxonomy](Taxonomy/class_reference.md) | Taxonomy |
| Cap the number of taxonomies a query returns | [limit](Taxonomy/methods/limit.md) | Taxonomy |
| Filter entries by the terms they carry | [Taxonomy](Taxonomy/class_reference.md) | Taxonomy |

## Key Usage Patterns

The examples below assume the `stack` instance from the Minimum Working Example.

### Page through a taxonomy listing

```
page = stack.taxonomy().skip(20).limit(10).include_count().find()
```

### Read one taxonomy in a specific locale

```
regions = stack.taxonomy('regions').locale('fr-fr').include_fallback().fetch()
```

### Filter entries by a term and its descendants

```
entries = stack.taxonomy().equal_and_below('taxonomies.regions', 'europe').find()
```

## SDK-Wide Notes

| Concern | Behavior | Default when unset |
| --- | --- | --- |
| Authentication | Reads the API key, delivery token, and environment from the `Stack` instance. No method takes credentials directly. | Not applicable, the constructor takes all three. |
| Rate limiting and retry | Retries on `408` and `429` automatically, the initial request plus up to **five retries**, with `backoff_factor=0` so the retries fire back to back. Pass your own `retry_strategy` if you expect to hit `429`. | The initial request plus **five retries**, no delay between them. |
| Locales and fallback | Send `locale` on the call, and chain `include_fallback` to accept an earlier locale in the hierarchy. | The stack's master locale, with no fallback. |

> **Warning:** This SDK requires a delivery token. A management token or a preview token returns error code `109`, "We can't find that Stack", which does not report that the token type is wrong. Generate a delivery token under Settings, Tokens in your stack.

## SDK Limitations

| Capability | Supported | Notes / Alternative |
| --- | --- | --- |
| Query across multiple content types in one request | No | Run a separate query per content type. |
| Recursive resolution of embedded items inside references | No | Fetch the embedded items of each reference in a further call. |
| Automatic paging through every result | No | Combine `skip` and `limit` to retrieve one page at a time. |
