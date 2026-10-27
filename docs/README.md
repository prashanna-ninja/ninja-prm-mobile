# Docs Index

👉 **Start with [../HANDOVER.md](../HANDOVER.md)** — current status, how to run, what's next.
👉 **[../CLAUDE.md](../CLAUDE.md)** — the project rules in one page.

Then read these in order; each builds on the last.

| # | Doc | What it answers |
| - | --- | --------------- |
| 01 | [01-OVERVIEW.md](01-OVERVIEW.md) | What are we building, and how does the PRM web app map onto a phone? |
| 02 | [02-SETUP-AND-STRUCTURE.md](02-SETUP-AND-STRUCTURE.md) | How is the app scaffolded, and where does each file go? |
| 03 | [03-DESIGN-SYSTEM.md](03-DESIGN-SYSTEM.md) | Colours, fonts, spacing, splash, component conventions. |
| 04 | [04-BACKEND-REFERENCE.md](04-BACKEND-REFERENCE.md) | Data models, the endpoints that exist, and the ones we must add. |
| 05 | [05-AUTH-DEEPLINK.md](05-AUTH-DEEPLINK.md) | Magic-link sign-in from email straight into the app. |
| 06 | [06-DATA-LAYER.md](06-DATA-LAYER.md) | TanStack Query conventions: query keys, caching, invalidation. |

## Features

One doc per feature. A feature doc is the spec: scope, screens, data, states, done-criteria.

- [features/FEAT-01-RECORDINGS.md](features/FEAT-01-RECORDINGS.md) — **Recordings** (the original v1 scope)
- [features/FEAT-02-CONTACTS.md](features/FEAT-02-CONTACTS.md) — **Contacts** (added 2026-09-28, outside the original scope)
- [features/FEAT-03-TASKS.md](features/FEAT-03-TASKS.md) — **Tasks**, the to-do list (added 2026-09-29, outside the original scope)
- [features/FEAT-05-PUSH.md](features/FEAT-05-PUSH.md) — **Push notifications**, ported from Ninja CRM (added 2026-10-27; app built ahead of its backend)
- [features/FEAT-04-MESSAGES.md](features/FEAT-04-MESSAGES.md) — **Messages**, CrazyTel SMS (added 2026-10-18; UI built ahead of its backend)

## Implementation

- [implementation/IMPLEMENTATION-PLAN.md](implementation/IMPLEMENTATION-PLAN.md) — the phased build order we work through one step at a time
- [implementation/BACKEND-CHANGES.md](implementation/BACKEND-CHANGES.md) — everything the PRM **web** repo needs before the app can work

## Prompts

Paste-ready prompts for work that happens in *another* repo or session.

- [prompts/BACKEND-PHASE-0.md](prompts/BACKEND-PHASE-0.md) — **run in the `ninja_prm` backend repo**: native magic-link auth + the recordings REST API
- [prompts/BACKEND-SHARE-TRANSCRIPT.md](prompts/BACKEND-SHARE-TRANSCRIPT.md) — **run in the `ninja_prm` backend repo**: `POST /api/v1/recordings/:source/:id/share`, so the app can email a transcript
- [prompts/BACKEND-CONTACTS-TASKS.md](prompts/BACKEND-CONTACTS-TASKS.md) — **run in the `ninja_prm` backend repo**: fix the 500-instead-of-401 auth bug and pin down the Contacts/Tasks response shapes
- [prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md](prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md) — **run in the `ninja_prm` backend repo**: `PUT /api/v1/recordings/:source/:id/contacts`, the missing endpoint that blocks assigning a recording to a contact

## Living docs

- [IMPLEMENTATION-LOG.md](IMPLEMENTATION-LOG.md) — chronological diary of every change and decision
- [PROMPTS.md](PROMPTS.md) — how to work with Claude on this repo + reusable prompts

---

## Doc conventions

- **Artifact-based.** A doc is a durable artifact, not a chat transcript. If something is decided,
  it belongs in the relevant numbered doc. If something *happened*, it belongs in the log.
- **Every session ends by updating** `IMPLEMENTATION-LOG.md` (append a dated entry) and
  `../HANDOVER.md` (rewrite the status block). That's what makes the next session cheap.
- **Feature docs are numbered** `FEAT-NN-<name>.md` and cross-linked from this index.
- **Dates are absolute** (`2026-09-14`), never "last week".
- **Unverified claims are marked.** If something was typechecked but never run on a device, say so.
