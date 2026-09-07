---
uid: ""
url: /developers/paragraph-cohesion-fixture
seo_title: Paragraph cohesion fixture
seo_description: Carries the C2-09 violations and the near-miss constructs that must stay clean.
---

# Paragraph cohesion fixture

## Overview

This fixture carries C2-09 violations alongside the correct constructs they are most often confused with.

## Violation one, a wall of flat paragraphs

Stack-scoped tools accept an optional `stack_api_key` argument, so an agent can run one call against a different stack without changing the connector URL. Contentstack describes the argument to the model in the tool schema.

If you omit it, the call runs against the configured stack.

Contentstack accepts this argument only on tools that target a stack: CMA, CMA Extended, and CDA. Tools that work at the organization level do not accept it. They operate on the organization rather than on a stack.

This grants no extra access. The call still runs on your OAuth token, and Contentstack rejects a stack your account cannot reach.

## Violation two, stranded one-liner

The app records every tool call it receives from a connected client, and it keeps the request and the response for each one. A failed call carries the error the product returned.

Contentstack keeps that history for seven days.

Open the Executions view from the Profiles screen to read it. The view filters by profile, by status, and by date, so you can narrow a long history to the calls that failed.

## Clean, bolded lead-ins

The two parameter types fail differently, so read the one that matches your parameter.

**Project UIDs fail loudly.**

A malformed project UID fails the whole connection, and your client then lists no tools rather than only the tools of the affected product.

**Every other parameter fails without an error.**

Contentstack drops a bad value and uses the profile's saved value instead. It discards any parameter the tables do not list.

**Lytics has no parameter.**

You cannot point a shared Lytics profile at a different account from the URL. Change the profile's configuration in the app instead.

## Clean, connectives carry the logic

A connector URL fixes one stack for every call on that connection. When an agent needs a single call to run somewhere else, stack-scoped tools take an optional `stack_api_key` argument that overrides the stack for that call alone.

Because the argument is optional, an agent names a stack only when it needs a different one. Every other call runs against the configured stack.

Only tools that target a stack accept the argument: CMA, CMA Extended, and CDA. The rest operate on the organization rather than on a stack, so they have no stack to override.

Without that argument, the call still runs on your OAuth token, and Contentstack rejects a stack your account cannot reach.

## Clean, a one-liner resolving a code block

Connecting to a scoped URL binds that connection to one profile. A client cannot request a different profile over that connection, and Contentstack rejects the request:

```
Profile scope mismatch (requested profile_id <REQUESTED>, this connection is
scoped to <SCOPED>).
```

To use another profile, connect to a URL that scopes the connection to that profile.

A scoped connection still lists the profiles in your organization, including names, descriptions, and tool counts. It cannot read their configuration or run their tools.

## Clean, one backward demonstrative

A profile never grants more access than your Contentstack roles already allow, and Contentstack resolves those roles from the session you signed in with.

This holds for every catalog a profile can include. A call that your account cannot make in the app fails the same way through a tool.
