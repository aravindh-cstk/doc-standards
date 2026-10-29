---
title: "Widget Plugin"
description: "Manage widgets from the Contentstack CLI."
url: "/headless-cms/cli-widget-plugin"
---

# Widget Plugin

## Overview

Manage widgets in a stack from the command line. Both commands write to the stack, so run them against a non-production stack first.

## Prerequisites

- [Contentstack account](https://www.contentstack.com/login)
- Contentstack CLI [installed](/docs/headless-cms/install-the-cli)
- CLI [authenticated](/docs/headless-cms/cli-authentication)
- [Region configured](/docs/headless-cms/configure-regions-in-the-cli)

## Installation

The widget plugin is not bundled with the CLI. Install it first:

```bash
csdx plugins:install @contentstack/cli-widget
```

## Commands

### widget:list

Lists every widget in the stack.

**Syntax**

```bash
csdx widget:list --stack-api-key <STACK_API_KEY>
```

**Flags**

| Flag | Type | Required | Default | Description | Notes |
| --- | --- | --- | --- | --- | --- |
| `--stack-api-key` | string | Yes | `-` | API key of the stack to read. | Requires `Content Type: Read`. |
| `--alias` | string | No | `-` | Management token alias. | Mutually exclusive with `--stack-api-key`. |
| `--batch-limit` | integer | No | `100` | Widgets fetched per request. | Lower this on rate-limited stacks. |

### widget:delete

Deletes one widget. This removes stack data and cannot be undone.

**Syntax**

```bash
csdx widget:delete --uid <WIDGET_UID>
```

**Flags**

| Flag | Type | Required | Default | Description | Notes |
| --- | --- | --- | --- | --- | --- |
| `--uid` | string | Yes | `-` | UID of the widget to delete. | No confirmation prompt. |
| `--yes` | boolean | No | `false` | Skips the confirmation prompt. | Destructive when scripted. |

## Examples

List every widget in a stack, then delete one by UID:

```bash
csdx widget:list --stack-api-key <STACK_API_KEY>
```

```bash
csdx widget:delete --uid <WIDGET_UID> --yes
```

## Limitations

The plugin does not delete widgets referenced by a published entry. Unpublish the entry first.

## Next Steps

- [Install the CLI](/docs/headless-cms/install-the-cli) covers installing and updating the CLI itself.
