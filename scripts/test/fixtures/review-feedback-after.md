---
url: /developers/mcp-profile-hub-monitor-tool-calls
seo_title: Monitor tool calls
---

# Monitor tool calls

## Overview

Review the tool calls a profile runs, and confirm that they reach Contentstack. The **Executions** view records each tool call with its status, client, and error message.

## Connect ChatGPT

ChatGPT connects to remote MCP servers as custom connectors. Add a custom connector in the client's settings, give it a name, and paste the connector URL. Then sign in to Contentstack and approve the scopes.

## Permissions

You need a product role that permits creating and deleting profiles. A profile can hold up to 200 tools, and an organization can hold up to 500 profiles.

## Limitations

The Executions view has the following limitations:

- **Filters search only loaded executions:** The view loads 50 executions at a time, so the following limits apply:
  - The search box and the status and profile filters apply only to loaded executions.
  - **Load more** is unavailable while a filter is active.

For the fix, see [Troubleshooting](#troubleshooting).

## Troubleshooting

> **Additional Resource:** For more information on the error messages a profile can return and the fix for each one, refer to the [Contentstack MCP Troubleshooting Guides](/contentstack-mcp-troubleshooting/faqs) documentation.
