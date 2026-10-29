---
url: /developers/mcp-profile-hub-monitor-and-troubleshoot
seo_title: Monitor and troubleshoot
---

# Monitor and troubleshoot

## Overview

A profile is a named bundle of Contentstack tools you connect an AI client to. This page covers what a profile holds, the ready-made profiles Contentstack ships, and the catalogs a profile draws from.

A system profile works with no setup required. Contentstack needs nothing else to run it.

## Connect ChatGPT

ChatGPT connects to remote MCP servers as custom connectors. For the exact menu names, refer to the [OpenAI connector documentation](https://help.openai.com/en/articles/connectors).

1. In ChatGPT, open **Settings > Connectors**.
2. Choose **Add custom connector** on your ChatGPT Plus plan, give it a name, and paste the connector URL.
3. Sign in at claude.ai if you use Claude instead.

## Permissions

You need the organization role that permits creating and deleting profiles.

## Limitations

- **The filters apply to the loaded page, not the full history.** The view loads 50 executions at a time, the search box and the status and profile filters narrow only what it has already loaded, and **Load more** disappears while any filter is active.

For the fix, see [The agent calls the wrong tool](#the-agent-calls-the-wrong-tool-or-passes-invalid-arguments).

## Troubleshooting

### uses a secure HTTP trigger, which is not supported yet

**Root Cause**: Contentstack cannot detect Secure HTTP Trigger on an automation the way it can on an agent, so a secured automation still appears in the tool browser and can be added to a profile.

**Resolution**: Turn off Secure HTTP Trigger on the automation.

### Insufficient scope

**Root Cause**: Contentstack returned 403. The token lacks a required OAuth scope.

**Resolution**: Reconnect and approve the requested scopes.

#### The agent calls the wrong tool, or passes invalid arguments

**Root Cause**: The model selects a tool that does not match the request.

**Resolution**: State the operation and its required values in your prompt.
