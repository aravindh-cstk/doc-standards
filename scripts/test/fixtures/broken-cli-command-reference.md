---
title: "Gadget Plugin"
description: "Manage gadgets."
url: "/headless-cms/cli-gadget-plugin"
---

# Gadget Plugin

Manage gadgets from the command line.

### Prerequisites

- Contentstack account
- CLI installed

## Commands

### Gadget Operations

#### gadget:list

Lists gadgets.

```
csdx gadget:list
```

#### Flags

| Flag | Short Flag | Description |
| --- | --- | --- |
| `--stack-api-key` | `-k` | API key of the stack, required unless you pass an alias, which conflicts with it. |

To install, run `csdx plugins:install @contentstack/cli-gadget` first.

## Troubleshooting

### Command fails

**Root Cause** The plugin is missing.

**Resolution** Install it.

## Limitations

None known.

## Next Steps

- [Install the CLI](/docs/headless-cms/install-the-cli) covers installing the CLI.
