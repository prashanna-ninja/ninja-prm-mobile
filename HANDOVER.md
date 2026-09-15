# Ninja PRM Mobile — Handover

A React Native + Expo app for **Ninja PRM**. It reuses the existing Next.js PRM backend
(`ref/prm`) — same database, same Better Auth session, same API. This doc is the single entry
point: **what exists, how to run it, what to watch out for, and what to do next.**

> ## Status — 2026-09-15
>
> **Phase 1 done: the app is scaffolded and the design system works.**
>
> Expo SDK 57 + **NativeWind 4.2.7 (v4 stable)** + Tailwind 3.4.17, brand tokens (`#ff8900`),
> Bricolage Grotesque in 4 weights, and a persisted light/dark theme provider.
> `npx tsc --noEmit` clean, `npx expo-doctor` **20/20**.
>
> ⚠️ **Bundle-verified, not device-verified.** No emulator/device was available — everything was
> proven via `npx expo export` and inspecting the bundle. **First job next session: run it on a
> real device** (`npm start`, scan with a dev build).
>
> `src/app/index.tsx` is currently a **temporary design-system check screen**. Delete it in Phase 5.
>
> **Next step:** **Phase 0 (backend)** — now unblocked, the user has confirmed `ref/prm` is
> editable. It's the critical path: Phases 5–7 have no data without it. Phase 2 (UI primitives)
> can run alongside.
>
> ⚠️ Still true: the PRM web app has **no REST API for recordings** — the web list calls a server
> action directly, and native can't do that. See §5.

---

## 1. What we're building

**v1 is the Recordings feature, and nothing else.** Two bottom tabs:

| Tab | Screen | What's on it |
| --- | ------ | ------------ |
| **Home** | `(app)/index` | Recording stats (this week + trend, needs-contact, per-source breakdown, total + hours captured), the 5 most recent recordings, **View all** |
| **Recordings** | `(app)/recordings/index` | The unified list: search, source filter, sort, infinite scroll |
| — | `(app)/recordings/[source]/[id]` | Recording detail — summary, action items, contacts, transcript, source-specific extras, audio player |
| — | `(app)/settings` | Account, theme, sign out. Reached by the gear in Home's header; **not** a tab |

Plus magic-link sign-in that opens **straight into the app** from the email.

Recordings come from four sources — `call`, `plaud`, `granola`, `fieldy` — merged into one feed.
Calls and Plaud have audio; Granola and Fieldy are text only.

Full spec: **[docs/features/FEAT-01-RECORDINGS.md](docs/features/FEAT-01-RECORDINGS.md)**.

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
