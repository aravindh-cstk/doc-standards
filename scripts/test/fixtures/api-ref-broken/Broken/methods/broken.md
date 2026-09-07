---
uid: "PENDING:Broken/broken"
seo_title: ""
seo_description: ""
stray_key: "triggers AR-01"
---

## An H2 on a method page breaks AR-02

### mismatched

The heading above does not match the filename, so AR-02 fires twice.

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| required_arg | str | Yes | — | An em dash in the Default cell, so AR-05 fires. |
| blank_arg | str | Yes |  | A blank Default cell, so AR-05 fires again. |

**Returns:** dict

#### Behavior

Behavior appears before Validation, so AR-03 fires on the ordering.

#### Validation

There is no Additional Resource callout closing this section, so AR-06 fires.

#### Example

```
import contentstack
```
