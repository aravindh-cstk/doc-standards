# Writing Guide: Agent Skills Docs

Scope note: this file is specific to Agent Skills documentation (the skill-doc structure using folders such as `1-introduction/`, `2-get-started/`, `3-how-it-works/`, and `4-skills-reference/`). It supplements `common-rules.md` C3 (Language and Tone) and C8 (Developer Tone). It does not replace them. Apply both files together when writing Agent Skills docs.

This file is for AI context only and is not published. When writing or expanding any doc in this
folder, apply the rules below before finalising output. Flag any phrase that falls into the
categories listed. Do not include it in the final content.

---

## Developer tone in one rule

Write what the system does, not how it feels to use it. Every sentence should answer a
technical question. If removing a sentence loses zero technical information, remove it.

---

## Marketing language: do not use

These phrases belong in product marketing, not developer documentation. Replace them with
the specific capability, behavior, or constraint they vaguely describe.

| Prohibited phrase or pattern | Replace with |
|---|---|
| powerful, robust, comprehensive, seamless, effortless | the specific capability being described, or nothing |
| best-in-class, world-class, industry-leading, cutting-edge, next-generation | the specific behavior or spec |
| production-ready, enterprise-grade, battle-tested, proven | the concrete constraint: "enforced by CI," "requires explicit confirmation" |
| out of the box, zero-config, plug-and-play | the actual default behavior |
| "in under 5 minutes," "in minutes," "instantly," "immediately" (rhetorical) | remove, or state the actual measured time |
| unlock, empower, transform, revolutionize, supercharge, elevate | the direct verb: "enables," "lets you," or describe what the code does |
| "Get started today," "Try it now," "Start building" as CTAs | a procedural instruction, or remove |
| "Whether you're a beginner or expert..." | start with the subject of the sentence |
| "smart enough to," "intelligent routing," "context-aware" (vague) | name the mechanism: "the router reads the trigger table in SKILL.md" |

---

## Technical jargon: do not use

These words sound technical but carry no precise meaning. Replace with the specific
behavior, file, or mechanism.

| Prohibited word / phrase | Replace with |
|---|---|
| guardrails | the specific restriction: "the skill refuses to print tokens," "the agent asks for confirmation before DELETE" |
| agentic | "running as an agent" or describe the behavior directly |
| mental model | "how X works" or "the concepts behind X" |
| single source of truth | "the canonical file is X" or "edited in one place" |
| end-to-end (as filler) | drop it, or name both ends: "from content migration to code rewrite" |
| opinionated | state the actual default choices |
| zero-downtime | describe the mechanism: "aliases switch with no request interruption" |
| re-platform | "migrate," "move," or "switch" |
| golden path | "the recommended approach" or describe the steps |
| surface (as a verb) | "expose," "show," "return," or "log" |
| leverage (meaning "use") | "use," "call," or "apply" |
| onboarding | "setup," "first install," or describe the specific step |
| paradigm | name the specific concept |

---

## Unexplained acronyms

Expand acronyms on first use in `1-introduction/` and `2-get-started/` files.
In `3-how-it-works/` and `4-skills-reference/`, assume the reader knows these terms.

Acronyms to expand on first use in intro/get-started sections:
CDA (Content Delivery API), CMA (Content Management API), HMAC (Hash-based Message Authentication Code),
OAuth, SSR (Server-Side Rendering), SSG (Static Site Generation), CSR (Client-Side Rendering),
BFF (Backend for Frontend), CDN (Content Delivery Network), CI (Continuous Integration),
CD (Continuous Deployment), SSO (Single Sign-On)

---

## Passive voice

Name the actor. "Errors will be handled" becomes "the agent returns an error."
Passive voice is acceptable only when the actor is genuinely unknown or irrelevant.

---

## Before and after examples

| Before (do not write) | After (developer tone) |
|---|---|
| "Agent skills close that gap. They give the assistant Contentstack-specific knowledge and guardrails..." | "Agent skills add Contentstack-specific routing rules and restrictions so the assistant produces correct output." |
| "production-ready, and safe by default" | "correct by default: delivery tokens are client-safe, management tokens are not, and the agent confirms before any destructive operation" |
| "in under 5 minutes" | remove, or replace with the actual install command count |
| "end-to-end through migrating a project" | "through migrating a project: content types, entries, assets, and code, from Contentful to Contentstack" |
| "re-platform to Contentstack" | "migrate to Contentstack" |
| "mental model behind skills, routing, and the safety contract" | "how skills, routing, and the safety contract work" |
| "guardrails so its output is correct" | "restrictions: it uses correct SDK method names, keeps management tokens server-side, and confirms before destructive operations" |
| "The primary entry point for Contentstack Brand Kit" | "Handles Brand Kit questions: setup, Voice Profiles, Knowledge Vault, on-brand generation, and API routing" |

---

## Checklist before finalising any new or edited content

- [ ] No superlatives or vague positive adjectives
- [ ] No benefit promises that cannot be measured
- [ ] No time claims unless literally verified
- [ ] All acronyms expanded on first use (intro/get-started files only)
- [ ] No vague buzzwords from the jargon table
- [ ] Passive voice names the actor
- [ ] Each sentence conveys technical information. Pure framing sentences removed
