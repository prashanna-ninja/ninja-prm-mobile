# Prompts & Working With Claude

How to get good work out of a session on this repo, plus reusable prompt templates. Keep adding
prompts that work well — they're project artifacts, same as the code.

---

## How we work together

- **Step by step.** One phase, one screen, one feature at a time — the order is in
  [implementation/IMPLEMENTATION-PLAN.md](implementation/IMPLEMENTATION-PLAN.md). Don't let a
  session sprawl across three phases; a half-finished phase is worse than a not-started one.
- **The refs are the source of truth.** `ref/prm` for *what it does and looks like*,
  `ref/ninja-crm-mobile` for *how we build it*. When in doubt, read the ref rather than guess.
- **Every session ends with docs.** Append a dated entry to
  [IMPLEMENTATION-LOG.md](IMPLEMENTATION-LOG.md) and rewrite the status block in
  [../HANDOVER.md](../HANDOVER.md). This is what makes the next session cheap instead of
  archaeological.
- **Say what's unverified.** "Typechecks and lints clean, not yet run on a device" is a useful
  sentence. "Done" when it's never been run is not.

---

## Starting a session

Paste this to get oriented fast:

```
Read CLAUDE.md, HANDOVER.md, and docs/implementation/IMPLEMENTATION-PLAN.md.
Tell me which phase we're on and what the next concrete step is.
Don't write code yet.
```

## Ending a session

```
Wrap up:
1. Append a dated entry to docs/IMPLEMENTATION-LOG.md — what changed, what was decided,
   what's still open, and what is typecheck-verified vs. device-verified.
2. Rewrite the status block in HANDOVER.md.
3. Tick off what's done in docs/implementation/IMPLEMENTATION-PLAN.md.
4. Tell me the single next step for next time.
```

---

## Giving Claude a screen to build

Most helpful first:

1. **A screenshot** of the web page (drop the image into chat) — layout and components get matched.
2. **The route**, e.g. "the `/dashboard/recordings` page" — the file gets read from `ref/prm`.
3. **Pasted page text / field labels** — mapped to backend fields.

Then say what you want: *"rebuild this as the mobile Recordings list, read-only for now."*

---

## Reusable prompt templates

### Build a screen from the spec

```
Build <SCREEN> per docs/features/FEAT-01-RECORDINGS.md §<N>.
Reference (web): ref/prm/<path>.
Reference (patterns): ref/ninja-crm-mobile/<path>.
Data: <hook from docs/06-DATA-LAYER.md>.
Include all four states: loading skeleton, empty, error+retry, data.
Follow the folder rules in docs/02 — route stays thin, components in src/components/<area>/.
Explain the new React Native concepts as you go.
```

### Add a UI primitive

```
Add a <Button/Card/Badge/Sheet> to src/components/ui, matching docs/03-DESIGN-SYSTEM.md
and the web app's variants (ref/prm/src/components/ui/<same>.tsx).
Use CVA for variants like the web does. Remember: no alpha on themed tokens — use
--primary-soft / --destructive-soft.
```

### Wire up an endpoint

```
Add the fetch fn + TanStack Query hook for <endpoint>.
Fetch fn and hook in src/api/<domain>.api.ts; response type in src/types/<domain>.types.ts
with a comment citing the backend file it mirrors; query key added to src/lib/query-keys.ts.
Caching per docs/06-DATA-LAYER.md §4.
```

### Add a backend endpoint (in ref/prm)

```
Add <endpoint> to ref/prm per docs/implementation/BACKEND-CHANGES.md §<N>.
Reuse the existing server action rather than reimplementing the query.
Scope by session.user.id; 404 (not 403) for someone else's row.
Then give me the curl command to verify it.
```

### Debug

```
Error: <paste>. What I did: <steps>. File: <path>.
Check docs/05-AUTH-DEEPLINK.md §4 and CLAUDE.md's gotcha list first — this may be a
known one. Explain the fix in beginner terms.
```

### Review before shipping a phase

```
Review the work for this phase against docs/implementation/IMPLEMENTATION-PLAN.md's
"Cross-cutting definition of done". Tell me specifically what is NOT device-verified.
```

---

## Keyword hints — the fast way into the refs

### `ref/prm` (the PRM web app / our backend)

| Topic | Where |
| ----- | ----- |
| Unified recordings list | `src/app/actions/recordings.ts`, `src/components/recordings/recordings-page-client.tsx` |
| List params | `src/lib/recordings-search-params.ts` |
| Call recordings | `src/app/actions/call-recordings.ts`, `src/components/call-recordings/*` |
| Plaud / Granola / Fieldy | `src/app/actions/{plaud,granola,fieldy}.ts`, `src/components/{plaud,granola,fieldy}/*` |
| Categories | `src/app/actions/recording-categories.ts`, `src/lib/recording-category-colors.ts` |
| Audio endpoints | `src/app/api/v1/{call-recordings,plaud-recordings}/[id]/audio/route.ts` |
| Auth | `src/auth.ts`, `src/lib/api-auth.ts`, `src/lib/auth-server.ts`, `src/app/api/auth/[...all]/route.ts` |
| Magic-link UI + email | `src/components/auth/magic-link-auth-form.tsx`, `src/lib/send-magic-link-email.ts` |
| Data models | `prisma/schema.prisma` (recordings ≈ lines 660–1002) |
| Design tokens | `src/app/globals.css` |
| Fonts | `src/app/layout.tsx` |
| Navigation / IA | `src/components/app-sidebar.tsx` |
| Timezone helpers | `src/lib/timezone.ts` |

### `ref/ninja-crm-mobile` (the sibling Expo app)

| Topic | Where |
| ----- | ----- |
| Folder conventions | `docs/02-SETUP-AND-STRUCTURE.md` |
| **The gotcha list** | `HANDOVER.md` §7 — read it before debugging anything weird |
| Root layout + session guard | `src/app/_layout.tsx` |
| Tabs layout (incl. `href: null`) | `src/app/(app)/_layout.tsx` |
| Dashboard pattern | `src/app/(app)/index.tsx`, `src/components/dashboard/*` |
| API client | `src/lib/api-client.ts` |
| Auth client + deep link | `src/lib/auth-client.ts`, `src/lib/session-cookie.ts`, `src/hooks/use-auth-deep-link.ts` |
| Query setup | `src/lib/query-client.ts`, `src/providers/query-provider.tsx` |
| Theme provider | `src/providers/theme-provider.tsx` |
| Screen shell | `src/components/screen.tsx`, `container.tsx`, `app-header.tsx` |
| List screen example | `src/app/(app)/clients/index.tsx` + `src/components/clients/lead-row.tsx` |
| Detail screen example | `src/app/(app)/clients/[id].tsx` |
| Skeletons | `src/components/clients/lead-skeletons.tsx` |

---

## Things worth saying out loud in a prompt

- *"Check `ref/ninja-crm-mobile/HANDOVER.md` §7 first"* — when something behaves oddly on device.
  Several of the weirdest bugs in this stack are already documented there.
- *"Don't reimplement the server action, wrap it"* — when adding a backend route.
- *"Read-only"* — v1 has no write actions; it's easy for scope to creep into an archive button.
- *"Both themes"* — dark mode gets forgotten unless it's asked for.
- *"What did you not verify?"* — the most useful question at the end of a session.
