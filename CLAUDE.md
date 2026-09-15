# Ninja PRM Mobile — Project Rules

Read this first, every session. It is the short version of the rules; the long version lives in
`docs/`. **`HANDOVER.md` tells you where we are right now.**

---

## What this project is

A React Native + Expo phone app for **Ninja PRM**. It is a **client of the existing Next.js PRM
web app** (`ref/prm`) — same database, same Better Auth session, same API. We do not rebuild the
whole PRM: **v1 ships the Recordings feature only.**

Two reference folders, two different jobs:

| Folder | What we take from it |
| ------ | -------------------- |
| `ref/prm` | **Product truth.** Data shapes, behaviour, screen content, design tokens, fonts, auth. This is the backend we call. |
| `ref/ninja-crm-mobile` | **Engineering truth.** Folder structure, coding conventions, doc format, auth-on-Expo patterns, and a list of gotchas already paid for once. |

When the two disagree about *how to build it*, `ninja-crm-mobile` wins. When they disagree about
*what it should do or look like*, `ref/prm` wins.

---

## The rules

1. **Scope is Recordings.** Two bottom tabs — **Home** (recording stats + recent recordings +
   "View all") and **Recordings** (the unified list) — plus the recording detail screen and audio
   playback. Settings is a gear in the Home header, not a tab. Nothing else gets built without
   being asked. See `docs/features/FEAT-01-RECORDINGS.md`.
2. **Primary colour is `#ff8900`.** Everything else in the palette comes from the PRM web app
   (`ref/prm/src/app/globals.css`). The web app's blue primary is the *only* token we deliberately
   replace. See `docs/03-DESIGN-SYSTEM.md`.
3. **Font is Bricolage Grotesque**, because that is the web app's `--font-sans`. Do not introduce
   a second typeface without a reason recorded in the log.
4. **Splash screen is `#ff8900` with white artwork/text.** Android adaptive-icon background too.
5. **Screens never call `fetch`.** Data goes: `lib/api-client.ts` → `api/<domain>.api.ts`
   (TanStack Query hook) → screen. Caching rules live in `docs/06-DATA-LAYER.md`.
6. **`src/app/` holds routes only.** All components live in `src/components/`, grouped by screen,
   with primitives in `src/components/ui/`. Zod in `src/schemas/`, types in `src/types/`.
   Full layout in `docs/02-SETUP-AND-STRUCTURE.md`.
7. **Auth is magic-link + deep link** (`ninjaprm://`), captured manually by the app. The pattern is
   already solved in `ref/ninja-crm-mobile`; copy it, don't reinvent it. See `docs/05-AUTH-DEEPLINK.md`.
8. **Document as you go.** Every session: append to `docs/IMPLEMENTATION-LOG.md` and refresh
   `HANDOVER.md`. A new feature gets its own `docs/features/FEAT-NN-*.md`. Docs are deliverables,
   not commentary.
9. **File naming:** files `kebab-case`, components `PascalCase`, schemas `*.schema.ts`, types
   `*.types.ts`, data hooks `*.api.ts`.
10. **Ask before widening scope.** Backend changes to `ref/prm` are cross-repo work — they get
    listed in `docs/implementation/BACKEND-CHANGES.md` and confirmed, not done on a whim.

---

## Identity (fixed — do not drift)

| Thing | Value |
| ----- | ----- |
| App name | `Ninja PRM` |
| Expo slug | `ninja-prm-mobile` |
| Deep-link scheme | `ninjaprm` |
| iOS bundle id | `com.adviceninja.ninjaprm` |
| Android package | `com.adviceninja.ninjaprm` |
| Primary brand colour | `#ff8900` |
| Splash background | `#ff8900`, white mark |
| Path alias | `@/*` → `./src/*` |

The **scheme must be identical** in `app.json`, `lib/auth-client.ts`, the sign-in `callbackURL`,
and the backend's `trustedOrigins`. Changing one and not the others silently breaks sign-in.

---

## Stack (decided)

| Layer | Choice |
| ----- | ------ |
| App | Expo (SDK pinned at scaffold time) + Expo Router, typed routes, `src/` model |
| Styling | NativeWind (Tailwind v3) + design tokens in `global.css` |
| UI | React Native Reusables primitives in `components/ui/` + CVA variants |
| Icons | `lucide-react-native` (same icon set as the web app) |
| Server state | **TanStack Query** — the only cache. Never mirror server data into `useState`. |
| Forms | React Hook Form + Zod |
| Auth | Better Auth + `@better-auth/expo` + `expo-secure-store` |
| Audio | `expo-audio` |

---

## Gotchas inherited from Ninja CRM Mobile (do not re-learn these)

These cost real debugging time on the sibling app. They apply here identically.

1. **Send the session cookie manually.** The Better Auth Expo client only attaches the cookie to
   its own `authClient.*` calls — a plain `fetch` gets nothing. `apiFetch` must send
   `Cookie: authClient.getCookie()`.
2. **`apiFetch` must set `credentials: "omit"`.** On iOS, NSURLSession adds its own copy of the
   cookie *on top of* our header, producing a duplicated header the backend can't parse (500s that
   look like "logged out"). Android is unaffected either way.
3. **Magic links are not auto-captured.** The Expo plugin only auto-captures OAuth. For a magic
   link, the server redirects to `ninjaprm://?cookie=…` and the app must parse and store it itself.
4. **Alpha on themed colours is unreliable** in NativeWind (`bg-primary/10` etc., because tokens
   are `hsl(var(--x))` with no alpha placeholder). Use the solid tint tokens defined in
   `docs/03-DESIGN-SYSTEM.md`, or alpha on a literal colour (`bg-black/40`).
5. **Dynamic routes use the object form:** `router.push({ pathname: "/recordings/[source]/[id]",
   params: { source, id } })` — typed routes require it.
6. **`KeyboardAvoidingView` does not work under Android edge-to-edge.** Measure the keyboard
   instead (`use-keyboard-height`), and remember the safe-area inset differs per platform.
7. **Expo Go will not work** once the custom scheme and native modules are in. Use a dev build.
