# 01 — Overview

## What we're building

A phone app for **Ninja PRM**. It talks to the **same backend** as the existing PRM web app
(`ref/prm`), so data, login and permissions are shared. We are **not** rebuilding the PRM — we're
taking the one thing that is genuinely better on a phone and building it properly.

**v1 scope:**

1. **Auth** — magic-link sign-in, tapped in the email, opening straight into the app.
2. **Home** — a recordings dashboard: how many, how they're trending, what needs attention, and
   the most recent few with a "View all".
3. **Recordings** — the unified list (`/dashboard/recordings` on web), the detail view for each
   of the four sources, and audio playback where audio exists.

Two bottom tabs: **Home** and **Recordings**. Settings is a gear in the Home header, not a tab.

That's it. Not in v1: contacts, tasks, calendar, opportunities, organizations, interactions,
integrations, tags, settings beyond sign-out. Those are listed in
[features/FEAT-01-RECORDINGS.md](features/FEAT-01-RECORDINGS.md) §10 as candidates for later.

**Why recordings first:** it is the only part of the PRM that is genuinely *consumed* rather than
*edited* — you listen to a call and read a summary. That is phone-shaped work. Everything else in
the PRM is data entry, which is laptop-shaped.

---

## The PRM web app, in plain English

`ref/prm` is a **personal** relationship manager (Next.js 16, Prisma/Postgres, Better Auth).
The mental model:

- **One user owns their own data.** There is no org-wide sharing in the user-facing app — every
  query is scoped `userId` / `ownerId` (see `ref/prm/src/app/actions/recordings.ts`). Roles exist
  (`USER`, `ADMIN`, `PLATFORM_ADMIN`) but only gate the admin/platform areas. **There is no RBAC
  layer for us to port** — unlike Ninja CRM, which needed one.
- **Contacts** are the central object. Everything else links to a contact.
- **Recordings** are conversations captured from four different sources and mirrored into the PRM,
  each with an AI summary, action items, and usually a transcript:

  | Source | Model | Where it comes from | Has audio? |
  | ------ | ----- | ------------------- | ---------- |
  | `call` | `CallRecording` | Phone calls pushed in by a webhook, audio stored in our S3 | ✅ (S3) |
  | `plaud` | `PlaudRecording` | Synced from the user's Plaud device account | ✅ (proxied from Plaud) |
  | `granola` | `GranolaMeeting` | Synced from the user's Granola account | ❌ text only |
  | `fieldy` | `FieldyConversation` | Synced from the user's Fieldy.ai account | ❌ text only |

- **The unified list** (`/dashboard/recordings`) merges all four into one feed, newest first, with
  search, a source filter, and a sort. That feed is the app's home screen.
- **Recording categories** are user-defined labels (name + colour) that auto-tag recordings via the
  contact they're linked to.
- **Action items** extracted from a recording can be turned into tasks. We read them; v1 does not
  create tasks.

### Jargon cheat-sheet

| You'll see… | It means… |
| ----------- | --------- |
| Recording / unified recording | Any of the four sources, normalised into one shape (`UnifiedRecordingItem`) |
| Source | Which of `call` / `plaud` / `granola` / `fieldy` a recording came from |
| Contact | A person. A recording links to zero or more contacts (calls link to exactly zero or one) |
| Category | A user-defined colour label (`RecordingCategory`) |
| Action items | Bullet list the AI extracted from the transcript (`Json?` on every recording model) |
| Archived | Soft-hidden. The unified list only shows `archived: false` |
| Spam | Calls only. Blocked-number matches, hidden from the list |

---

## The web app's screens (information architecture)

From `ref/prm/src/components/app-sidebar.tsx`, the user area is:

```
Dashboard
Contacts   Opportunities   Organizations   Tags   Interactions
All Recordings  ← this one     Call Recordings   Plaud Recordings
Granola Meetings               Fieldy
Tasks      Calendar
Settings   Integrations
```

We rebuild **All Recordings** and the four per-source **detail** pages. The per-source *list*
pages (`/dashboard/call-recordings` etc.) are **not** rebuilt — the unified list with a source
filter covers them on a phone, which is exactly why the web app has it.

---

## How the mobile app maps to the web app

The web app is Next.js with React Server Components and **server actions** — not a REST API. A
phone app can't call a server action, so we don't copy code. We copy the **contract** and the
**look**:

| In the web app | Becomes in mobile (Expo) |
| -------------- | ------------------------ |
| Server component + `getUnifiedRecordings()` server action | `GET /api/v1/recordings` → `apiFetch` → TanStack Query hook |
| shadcn/ui (Radix + Tailwind v4) | React Native Reusables (`@rn-primitives/*`) + NativeWind (Tailwind v3) |
| `globals.css` oklch/HSL tokens | The same tokens in `global.css`, **primary swapped to `#ff8900`** ([03](03-DESIGN-SYSTEM.md)) |
| `Bricolage_Grotesque` via `next/font` | `@expo-google-fonts/bricolage-grotesque` via `useFonts` |
| `lucide-react` | `lucide-react-native` — same icon names |
| Better Auth magic link (browser cookie) | Better Auth magic link + `@better-auth/expo` + SecureStore ([05](05-AUTH-DEEPLINK.md)) |
| `<audio controls>` | `expo-audio` + a custom player ([FEAT-01](features/FEAT-01-RECORDINGS.md) §7) |
| URL search params drive the list | Local screen state drives the query key ([06](06-DATA-LAYER.md)) |

### ⚠️ The one big difference from Ninja CRM Mobile

Ninja CRM Mobile had it easy: its backend already exposed everything as `/api/*` routes, because
the web app's own client components called them. **The PRM does not.** Recordings are read
exclusively through server actions; the only recordings-related REST routes that exist today are
two audio endpoints and a few per-contact lists.

**So the PRM web repo has to grow a small REST surface before this app can do anything.** That
work is specified in [implementation/BACKEND-CHANGES.md](implementation/BACKEND-CHANGES.md) and is
**Phase 0** of the build. It is additive — no existing web behaviour changes.

---

## Reference map — where to look in `ref/prm`

| Topic | File |
| ----- | ---- |
| Unified list logic + shape | `src/app/actions/recordings.ts` |
| Unified list UI | `src/components/recordings/recordings-page-client.tsx` |
| List search-param parsing | `src/lib/recordings-search-params.ts` |
| Call detail UI / data | `src/components/call-recordings/call-recording-detail.tsx`, `src/app/actions/call-recordings.ts` |
| Plaud / Granola / Fieldy detail UI | `src/components/{plaud,granola,fieldy}/*-detail.tsx` |
| Audio endpoints | `src/app/api/v1/{call-recordings,plaud-recordings}/[id]/audio/route.ts` |
| Categories | `src/app/actions/recording-categories.ts`, `src/lib/recording-category-colors.ts` |
| Data models | `prisma/schema.prisma` (lines ~660–1002) |
| Auth config | `src/auth.ts`, `src/lib/api-auth.ts`, `src/app/api/auth/[...all]/route.ts` |
| Design tokens | `src/app/globals.css` |
| Fonts | `src/app/layout.tsx` |

## Reference map — where to look in `ref/ninja-crm-mobile`

| Topic | File |
| ----- | ---- |
| Folder conventions | `docs/02-SETUP-AND-STRUCTURE.md` |
| Root layout + session guard | `src/app/_layout.tsx` |
| API client (cookie handling) | `src/lib/api-client.ts` |
| Auth client | `src/lib/auth-client.ts` |
| Deep-link capture | `src/hooks/use-auth-deep-link.ts`, `src/lib/session-cookie.ts` |
| Query client config | `src/lib/query-client.ts` |
| Fonts + tokens | `src/lib/fonts.ts`, `global.css`, `tailwind.config.js` |
| Screen shell / header | `src/components/screen.tsx`, `container.tsx`, `app-header.tsx` |
| Hard-won gotchas | `HANDOVER.md` §7 |
