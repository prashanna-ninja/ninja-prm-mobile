# Ninja PRM Mobile — Handover

A React Native + Expo app for **Ninja PRM**. It reuses the existing Next.js PRM backend
(`ref/prm`) — same database, same Better Auth session, same API. This doc is the single entry
point: **what exists, how to run it, what to watch out for, and what to do next.**

> ## Status — 2026-10-18 (session 8)
>
> **Released on iOS:** magic-link sign-in, Home, Recordings (list, detail, audio, transcripts),
> Contacts.
>
> **Built, never on a device:**
> - **Tasks** (session 7, branch `feat/tasks`) — [FEAT-03](docs/features/FEAT-03-TASKS.md).
> - **Messages** (this session, branch `feat/messages`, stacked on `feat/tasks`) — two-way CrazyTel
>   SMS: inbox with filters and line chips, threads with optimistic send + idempotent retry,
>   new message, save an unknown number as a contact, Text from a contact, unread tab badge.
>   [FEAT-04](docs/features/FEAT-04-MESSAGES.md). 🚨 **Built against a backend that doesn't exist
>   yet** — every Messages screen errors until `docs/prompts/BACKEND-SMS-API.md` ships.
>
> **Navigation changed (the user's call):** tabs are now Home · **Messages** · Recordings ·
> Contacts · Tasks (Messages moved to second on 2026-10-20). Settings left the bar and is a **gear top-right on Home**, replacing the theme
> toggle (theme lives in Settings → Appearance).
>
> Both features are pure JS — no native change — so a Metro reload on the dev build tests them.
> Typecheck clean, Android bundle exports (5.9MB).
>
> ### What to do next
>
> 1. **Run the SMS backend prompt** — `docs/prompts/BACKEND-SMS-API.md`. 🚨 `../ninja_prm` is
>    BEHIND `ref/prm` and has no SMS code; pull it first. Then check every field in
>    `src/types/sms.types.ts` against the real JSON.
> 2. **Device-test Tasks and Messages** — checklists in FEAT-03 §4 and FEAT-04 §5. The keyboard
>    on the Messages composer needs checking on **both** platforms.
> 3. **Merge** `feat/tasks` then `feat/messages` into `main`.
> 4. Android preview build — the post-splash crash fix is still unverified:
>    `eas build --platform android --profile preview`.
> 5. Still blocked on the backend: assign a recording to a contact
>    (`docs/prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md`).
>
> ### Don't
>
> - **Don't run `npm run lint`.** No ESLint is configured, so `expo lint` installs one and
>   rewrites `package-lock.json` (it did in session 7).
>
> ### Known, unfixed (backend)
>
> - `PATCH /api/v1/tasks/[id]` can lose a task's contact links on a bad date — unreachable from
>   the app. `BACKEND-CHANGES` §10.
> - `/me` signs the user out during a DB outage.
> - Several endpoints 500 rather than 400 on invalid enum input.

---

## 0. Start the next session with this

Paste this in verbatim:

```
Read CLAUDE.md and HANDOVER.md. We are picking up Ninja PRM Mobile after the
2026-10-18 session 8, which built Messages (FEAT-04) against a backend that
doesn't exist yet, and moved Settings from the tab bar to a gear on Home.
Tasks (FEAT-03) and Messages are both unmerged and never run on a device.

In priority order:

1. Has the SMS backend (docs/prompts/BACKEND-SMS-API.md) shipped? If yes,
   diff its real JSON against src/types/sms.types.ts and fix any drift.
2. Device-test Tasks and Messages (FEAT-03 section 4, FEAT-04 section 5).
3. Merge feat/tasks, then feat/messages.

Before writing any code, read CLAUDE.md's gotcha list - especially 4b
(never give a Pressable a function style) and 4c (import icons from
@/lib/icons). Don't run `npm run lint`.

Tell me which thread you'd start with and what the first concrete step is.
Don't write code yet.
```

---

## 1. What we're building

v1 started as **Recordings and nothing else**; Contacts (2026-09-28), Tasks (2026-09-29) and
Messages (2026-10-18) were added at the user's request. Five bottom tabs — the ceiling — with
Settings as a gear on Home:

| Tab | Screen | What's on it |
| --- | ------ | ------------ |
| **Home** | `(app)/index` | Recording stats (this week + trend, needs-contact, per-source breakdown, total + hours captured), the 5 most recent recordings, **View all** |
| **Recordings** | `(app)/recordings/index` | The unified list: search, source filter, sort, infinite scroll |
| — | `(app)/recordings/[source]/[id]` | Recording detail — summary, action items, contacts, transcript, source-specific extras, audio player, save / copy / email-share |
| **Contacts** | `(app)/contacts/index` | List with search + relationship filter, and **New** |
| — | `(app)/contacts/[id]` | Overview counters, interactions, call recordings, log-an-interaction |
| **Tasks** | `(app)/tasks/index` | To-do list grouped by due date, tick off, To do / Done / All + priority, **New** |
| — | `(app)/tasks/[id]` | Detail — due, notes, related contacts, source recording, cancel / reopen / delete |
| — | `(app)/tasks/[id]/edit` · `new` | Create / edit form, with a contact picker and a JS date grid |
| **Messages** | `(app)/messages/index` | SMS inbox: search, All / Unread / Contacts / Unknown, line chips, unread badge on the tab |
| — | `(app)/messages/[threadId]` · `new` | Conversation (optimistic send, retry, save contact, call) · start a new one |
| *(gear on Home)* | `(app)/settings` | Account, theme, sign out — a hidden route, not a tab, since 2026-10-18 |

Plus magic-link sign-in that opens **straight into the app** from the email.

Recordings come from four sources — `call`, `plaud`, `granola`, `fieldy` — merged into one feed.
Calls and Plaud have audio; Granola and Fieldy are text only.

Full specs: **[docs/features/FEAT-01-RECORDINGS.md](docs/features/FEAT-01-RECORDINGS.md)**,
**[docs/features/FEAT-02-CONTACTS.md](docs/features/FEAT-02-CONTACTS.md)**,
**[docs/features/FEAT-03-TASKS.md](docs/features/FEAT-03-TASKS.md)** and
**[docs/features/FEAT-04-MESSAGES.md](docs/features/FEAT-04-MESSAGES.md)**.

---

## 2. Identity (fixed — don't drift)

| Thing | Value |
| ----- | ----- |
| App name | `Ninja PRM` |
| Expo slug | `ninja-prm-mobile` |
| Deep-link scheme | `ninjaprm` |
| iOS bundle id | `com.adviceninja.ninjaprm` |
| Android package | `com.adviceninja.ninjaprm` |
| Primary colour | **`#ff8900`** |
| Splash | `#ff8900` background, white mark |
| Font | Bricolage Grotesque (4 weights) |
| Path alias | `@/*` → `./src/*` |

The **scheme appears in four places** and must be identical everywhere: `app.json`,
`lib/auth-client.ts`, the sign-in `callbackURL`, and the backend's trusted origins.

---

## 3. Prerequisites

- **Node 20+**, **Git**. *(Dev machine is on Node 24.14.1 — newer than Expo's tested range, no
  issues so far.)*
- An **Expo account** + `eas-cli` (`npm i -g eas-cli`).
- A **development build** on a physical device. **Expo Go will not work** once auth lands — custom
  `ninjaprm://` scheme + native modules. *(Right now, pre-auth, Expo Go can still render the
  design-system check screen: `npm run start:go`.)*
- The **PRM backend deployed over HTTPS and reachable from the phone** — needed from Phase 3 on.

## 4. Get it running

```bash
npm install
cp .env.example .env     # then set EXPO_PUBLIC_API_BASE_URL
npm start                # = expo start --dev-client
```

Useful:

```bash
npm run typecheck        # tsc --noEmit   (ref/ is excluded)
npm run lint
npx expo-doctor          # 20/20 as of 2026-09-15
npx expo export --platform android --output-dir .verify   # prove the bundle builds
```

JS/TS changes → just reload Metro. **Native** changes (new native package, `app.json` native
config) → rebuild: `eas build --platform android --profile development`.

### Current stack versions

Expo SDK **57.0.22** · RN **0.86.3** · React **19.2.3** · **NativeWind 4.2.7** ·
Tailwind **3.4.17** · TypeScript ~6.0.3.

> NativeWind 4.2.x predates RN 0.86 and was a real compatibility risk, so it was **verified
> empirically** before the project committed to it. If an SDK bump ever breaks styling, the
> two-minute check is: `npx expo export --platform android`, then grep the `.hbc` for a token you
> use (e.g. `ff8900`). Present = the pipeline is fine.

---

## 5. Backend dependency ⚠️

The app is a client of `ref/prm`. **It needs changes before anything works**, all specified in
**[docs/implementation/BACKEND-CHANGES.md](docs/implementation/BACKEND-CHANGES.md)**:

| # | What | Why |
| - | ---- | --- |
| 1 | `@better-auth/expo` + the `expo()` plugin, `ninjaprm://` trusted | Native magic-link sign-in. The trusted origin is an **env value**, not code — `trustedOrigins` already reads `BETTER_AUTH_TRUSTED_ORIGINS`. |
| 2 | `GET /api/v1/recordings` | The list. Wraps the existing `getUnifiedRecordings()` action + 4 extra fields (`durationSec`, `hasAudio`, `hasTranscript`, `isNew`). |
| 3 | `GET /api/v1/recordings/[source]/[id]` | The detail screen. |
| 4 | `GET /api/v1/recordings/[source]/[id]/audio` | Must return a **URL**, not bytes — see the Plaud problem below. |
| 5 | `GET /api/v1/recordings/stats` | The Home screen. **Nothing like it exists** — `/api/v1/dashboard` has zero recording data. |
| 6 | `GET /api/v1/recording-categories` | Optional — only if the category filter ships. |

All additive. The one exception: `nextCookies()` is currently **first** in the plugin array in
`ref/prm/src/auth.ts` and needs to be **last** — that touches web login, so re-test it.

**Verify the whole surface with `curl` before building any UI** — see BACKEND-CHANGES §9.

---

## 6. Architecture at a glance

| Layer | Choice |
| ----- | ------ |
| App | Expo + Expo Router (file-based, typed routes), `src/` model |
| Styling | NativeWind (Tailwind v3) + tokens in `global.css` |
| Icons | `lucide-react-native` (same names as the web) |
| UI | React Native Reusables (`components/ui/*`) + CVA variants |
| Data | **TanStack Query** (the only cache) + one `apiFetch` in `lib/api-client.ts` |
| Forms | React Hook Form + Zod |
| Auth | Better Auth + `@better-auth/expo` + `expo-secure-store` |
| Audio | `expo-audio` |

**Folder rule:** routes only in `src/app`; components in `src/components/` grouped by screen, with
primitives in `ui/`; Zod in `src/schemas/`; types in `src/types/`; data hooks in
`src/api/<domain>.api.ts`. Screens call hooks, never `fetch`.
Details: [docs/02-SETUP-AND-STRUCTURE.md](docs/02-SETUP-AND-STRUCTURE.md).

---

## 7. Open questions — answer these before Phase 0/1

1. **Can we edit and redeploy `ref/prm`?** 🚨 Hard blocker. Without the REST endpoints in §5 the
   recordings feature cannot be built, and there is no client-side workaround.
2. **Which backend URL do we build against** — a deployed staging environment, or a tunnel? The
   phone can't reach `localhost`, and free tunnel URLs rotate (which broke the CRM app's
   standalone build).
3. **Confirm the scheme and ids** — `ninjaprm://`, `com.adviceninja.ninjaprm`.
4. **Plaud audio:** short-lived signed proxy URL (backend work, better UX), or
   download-then-play via `expo-file-system` (no backend work, slower)? Recommendation: signed URL.
5. **Is v1 read-only?** Or do archive / assign-contact / change-category ship? Decision needed
   before Phase 7.
6. **Logo artwork** — needed for the app icon, Android adaptive icon and splash.

---

## 8. Gotchas — inherited, already paid for once

From `ref/ninja-crm-mobile/HANDOVER.md` §7. These cost real debugging time on the sibling app and
apply here identically. **Don't rediscover them.**

1. **Send the session cookie manually.** The Better Auth Expo client only attaches the cookie to
   its own `authClient.*` calls — a plain `fetch` gets nothing and every authed endpoint 401s.
   `apiFetch` must send `Cookie: authClient.getCookie()`.
2. **`apiFetch` must set `credentials: "omit"`.** On iOS, NSURLSession appends its own copy of the
   cookie on top of ours → a duplicated header the server can't parse → 500s that look like
   "logged out". Android is unaffected either way. Removing this re-breaks iOS entirely.
3. **Magic links are not auto-captured.** The Expo plugin only auto-captures OAuth. The server
   redirects to `ninjaprm://?cookie=…` and the app must parse and store it itself
   (better-auth #6936).
4. **Alpha doesn't work on themed colours** in NativeWind (`bg-primary/10`). Use the solid
   `--primary-soft` / `--destructive-soft` tokens, or alpha a literal colour (`bg-black/40`).
5. **Dynamic routes need the object form:**
   `router.push({ pathname: "/recordings/[source]/[id]", params: { source, id } })`.
6. **`KeyboardAvoidingView` doesn't work under Android edge-to-edge.** Measure the keyboard
   instead; the safe-area inset differs per platform.
7. **Hide the tab bar** on screens with a bottom-anchored input or a full-bleed reading surface.
8. **`npx expo install` mis-resolves in repos with a nested project under `ref/`** — it installed
   into the wrong `package.json` on the CRM app. Same repo shape here: verify every install landed
   in the root `package.json`.
9. **Nested modals are finicky on RN.** One sheet at a time.
10. **Expo Go can't test the deep link.** Use a dev build.

Plus two specific to this app:

11. **The native audio player doesn't send our cookie.** Any audio URL handed to `expo-audio` must
    be independently playable for a short window (presigned S3, or a signed proxy URL).
12. **`actionItems` is `Json?`** on all four models and is not guaranteed to be `string[]`. Parse
    defensively, or sanitise server-side (preferred).

---

## 9. Docs

| Doc | What |
| --- | ---- |
| [CLAUDE.md](CLAUDE.md) | The project rules, one page. Read every session. |
| [docs/README.md](docs/README.md) | Docs index + doc conventions |
| [docs/01-OVERVIEW.md](docs/01-OVERVIEW.md) | What we're building + a map of the PRM web app |
| [docs/02-SETUP-AND-STRUCTURE.md](docs/02-SETUP-AND-STRUCTURE.md) | Scaffold steps, folder structure, conventions |
| [docs/03-DESIGN-SYSTEM.md](docs/03-DESIGN-SYSTEM.md) | Colours, fonts, spacing, splash, components |
| [docs/04-BACKEND-REFERENCE.md](docs/04-BACKEND-REFERENCE.md) | Models, endpoints that exist, endpoints we need |
| [docs/05-AUTH-DEEPLINK.md](docs/05-AUTH-DEEPLINK.md) | Magic link → deep link → signed in |
| [docs/06-DATA-LAYER.md](docs/06-DATA-LAYER.md) | TanStack Query: keys, caching, invalidation |
| [docs/features/FEAT-01-RECORDINGS.md](docs/features/FEAT-01-RECORDINGS.md) | **The v1 spec** — screens, states, done criteria |
| [docs/features/FEAT-02-CONTACTS.md](docs/features/FEAT-02-CONTACTS.md) | Contacts |
| [docs/features/FEAT-03-TASKS.md](docs/features/FEAT-03-TASKS.md) | Tasks — the to-do list, and its wire-format traps |
| [docs/features/FEAT-04-MESSAGES.md](docs/features/FEAT-04-MESSAGES.md) | Messages — CrazyTel SMS, built ahead of its backend |
| [docs/implementation/IMPLEMENTATION-PLAN.md](docs/implementation/IMPLEMENTATION-PLAN.md) | Phased build order + definition of done |
| [docs/implementation/BACKEND-CHANGES.md](docs/implementation/BACKEND-CHANGES.md) | What `ref/prm` needs |
| [docs/IMPLEMENTATION-LOG.md](docs/IMPLEMENTATION-LOG.md) | Chronological diary of changes & decisions |
| [docs/PROMPTS.md](docs/PROMPTS.md) | How to work with Claude here + reusable prompts |

---

## 10. Handy commands (once the app exists)

```bash
npx expo start --dev-client -c                 # run against the dev build, clear cache
npm run lint                                   # eslint
npx tsc --noEmit                               # typecheck  (ref/ is excluded)
eas build -p android --profile development     # rebuild the dev APK (native changes only)
eas build -p android --profile preview         # standalone internal APK
```
