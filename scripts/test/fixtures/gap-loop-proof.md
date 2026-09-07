---
uid: ""
url: /developers/gap-loop-proof
seo_title: Gap loop proof fixture
seo_description: Carries the pre-fix text of the three violations the gap loop was built from, alongside the constructs that must stay unflagged.
---

# Gap loop proof fixture

## Overview

This fixture reproduces three violations a human caught by eye that the linter
did not report, plus the near-miss constructs that must stay clean.

## Violation one, casual phrase

Both products connect AI agents to Contentstack and cover the same kinds of work.

## Violation four, vague noun

This step covers two things: naming the profile, and choosing its tools.

## Violation two, indirect question

They differ in how you install them and in the number of tools your agent ends up with.

## Violation three, a numbered set

A setup involves three pieces:

1. **Profiles:** a set of tools you pick in the app.
2. **The hosted runtime:** it loads the profile and runs operations.
3. **MCP clients:** any app that connects to a connector URL.

## Violation six, a casual escalation verb

Only Contentstack can re-enable a disabled profile, so reach out to support.

## Exemption six, a literal reach and an unrelated compound

The client cannot reach the discovery endpoint, and each outcome has its own root cause.

## Violation five, an intentional verb

A profile carries an `enabled` flag. Disabling it takes effect immediately for every connected client: a disabled profile advertises zero tools to any connected client, and calls against it fail rather than running.

## Exemption five, protocol vocabulary

The runtime exposes the profile's tools, and the client discovers them during the MCP handshake.

## Exemption one, a heading may open with How

### How a tool call works

The runtime validates the token, resolves the stack, then executes.

## Exemption two, a table cell may open with How many

| Parameter | Description |
| --- | --- |
| depth | How many levels above the term to traverse. |

## Exemption three, an imperative procedure

To reach older executions:

1. Clear the filters.
2. Click **Load more**.
3. Filter again.

## Exemption four and violation eight, a ranked list under an unnamed lead-in

The numbers stay, because the list really is ranked, so C3-14 must leave it
alone. The lead-in is the C3-26 violation: the clause touching the colon names
no element, no direction, and no count, so the reader reaches the list without
knowing what it holds.

Several places can set the same value. The highest one wins:

1. **Tool arguments on a single call.**
2. **The connector URL query string.**
3. **The profile's stored configuration.**

## Exemption ten, a lead-in that names what follows

The two URLs below set the same stack on different branches:

```
https://example.com/api/mcp?profile_id=cms&branch=main
https://example.com/api/mcp?profile_id=cms&branch=release-2
```

## Violation seven, a forward-pointing demonstrative

For example, this URL sets a stack and a branch:

```
https://example.com/api/mcp?profile_id=cms&branch=release-2
```

## Exemption seven, a backward demonstrative

This grants no extra access, because the call still runs on your own token.

## Exemption eight, a complete set introduced with the following

The following transports are the only ones Contentstack supports:

1. Streamable HTTP.
2. Server-sent events.

## Exemption nine, an anchor slug carrying the flagged words

Read [the parameter reference](/developers/mcp-url-parameters#this-url-and-this-table) before you edit a connector URL.

## Next Steps

- [Create a profile](/developers/mcp-create-a-profile): pick tools and publish a profile.
