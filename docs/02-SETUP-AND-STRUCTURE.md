# 02 — Setup & Project Structure

How the app gets scaffolded, and — more importantly — **the folder structure and conventions we
follow from here on.** When in doubt about where a file goes, this doc decides.

> **Beginner note:** in Expo you rarely run `npm install <pkg>` for anything with a native side.
> `npx expo install <pkg>` picks the version matching your Expo SDK. See the caveat in §6.

---

## 1. Prerequisites

- **Node 20+** (`node -v`), **Git**.
- An **Expo account** + `eas-cli` (`npm i -g eas-cli`) — needed for dev builds.
- A **physical device** with a **development build** installed. Plain Expo Go will **not** work
  once the `ninjaprm://` scheme and native modules are in.
- The **PRM backend reachable over HTTPS from the phone** (see §5 and
  [05-AUTH-DEEPLINK.md](05-AUTH-DEEPLINK.md)).

---

## 2. Scaffold ✅ (done 2026-09-15)

Generated with `create-expo-app` (default template = Expo Router + TypeScript) into a temp sibling
folder, then merged in — keeping `docs/`, `ref/`, `CLAUDE.md`, `HANDOVER.md`, and dropping the
template's own `CLAUDE.md`/`AGENTS.md`/demo screens.

### Installed versions (the baseline everything resolves against)

| Package | Version | Note |
| ------- | ------- | ---- |
| Expo SDK | **57.0.25** | Scaffolded at 57.0.22; aligned to patch releases via `expo install --fix` |
| React Native | **0.86.3** | |
| React | **19.2.3** | |
| **NativeWind** | **4.2.7** | v4 **stable** (v5 is RC-only) |
| Tailwind CSS | **3.4.17** | NativeWind 4 targets Tailwind **v3**, not v4 |
| TypeScript | ~6.0.3 | |
| Node (dev machine) | 24.14.1 | Newer than Expo's tested range; no issues so far |

> ⚠️ **NativeWind 4.2.7 on RN 0.86 was a real compatibility risk** — 4.2.x predates this RN line,
> and NativeWind 5 is the one built for the new Metro. It was **verified empirically** before the
> project was committed to it: a test bundle confirmed Tailwind's JIT compiled a custom colour and
> NativeWind embedded the output. If NativeWind ever breaks on an SDK bump, that test
> (`npx expo export` + grep the bundle for a token) is how to check it in two minutes.

### The template already differs from the old reference app

- The SDK 57 template **already uses the `src/` model**, so no restructuring was needed.
- `global.css` lives at **`src/global.css`** (template convention), not the repo root as in
  `ref/ninja-crm-mobile`. `metro.config.js` points at it.
- The template ships **no `babel.config.js` / `metro.config.js`** — both were created for NativeWind.
- **`newArchEnabled` and `android.edgeToEdgeEnabled` are no longer valid app.json keys**: in SDK 57
  both are always on. `expo-doctor` rejects them. (Edge-to-edge being permanent means gotcha §7.6
  about `KeyboardAvoidingView` definitely applies to us.)

### What ended up installed

All of the originally planned set **except React Native Reusables** — RNR / `@rn-primitives/*`
were never added, and the UI is hand-rolled. Beyond the plan: `expo-file-system`,
`expo-sharing`, `expo-asset`, `expo-image`, `expo-linear-gradient`, `expo-network` (drives
`onlineManager`), `@react-native-community/slider` (the audio scrubber), `date-fns`, and
**`sharp`** as a devDependency for `scripts/generate-icons.mjs`.

**`expo-haptics` is NOT installed**, despite `docs/03` specifying haptics on destructive taps.

> **`.npmrc` sets `legacy-peer-deps=true`.** `@better-auth/expo` declares a stale
> `expo-network@^8.0.7` peer range, and without the flag every install fails. Check that peer
> range before removing it.

> After touching `babel.config.js` / `metro.config.js` or installing native deps, restart Metro
> with a clean cache: **`npx expo start -c`**.

---

## 3. Folder structure (the convention — follow this)

Everything lives under `src/`. Routes live in `src/app`; everything else is organised by **what it
is**.

```
src/
├── app/                        # EXPO ROUTER = ROUTES ONLY. Thin files.
│   ├── _layout.tsx             #   Root: providers, fonts, deep-link capture, session guard
│   ├── (auth)/                 #   Logged-OUT stack
│   │   ├── _layout.tsx
│   │   └── sign-in.tsx         #     magic-link screen
│   └── (app)/                  #   Logged-IN stack
│       ├── _layout.tsx         #     bottom tabs: Home / Recordings / Contacts / Settings
│       ├── index.tsx           #     TAB 1 - Home (stats + recent; recent list inlined here)
│       ├── settings.tsx        #     TAB 4 - account + theme + version + sign out
│       ├── recordings/         #     TAB 2 - a nested stack
│       │   ├── _layout.tsx
│       │   ├── index.tsx       #       the full list
│       │   └── [source]/
│       │       └── [id].tsx    #       Recording detail (one route, four sources)
│       └── contacts/           #     TAB 3 - a nested stack
│           ├── _layout.tsx
│           ├── index.tsx       #       list: search + relationship filter
│           ├── new.tsx         #       create form
│           └── [id].tsx        #       Contact detail
│
├── components/                 # ALL components. Grouped by screen/area. NEVER inside app/.
│   ├── ui/                     #   search-bar, skeleton, states  <- only three; see note below
│   ├── screen.tsx              #   Safe-area page shell
│   ├── app-header.tsx          #   Shared screen header (title, subtitle, left/right slots)
│   ├── login/                  #   login-form, auth-hero, auth-button
│   ├── dashboard/              #   stat-card, library-card
│   ├── recordings/             #   recording-row, source-chips, audio-player,
│   │                           #   recording-details, recording-actions, share-transcript-sheet
│   └── contacts/               #   contact-row, contact-avatar, contact-form, contact-overview,
│                               #   relationship-badge, relationship-filter, chip-input,
│                               #   log-interaction-sheet
│
├── schemas/                    # Zod schemas - one file per domain
│   └── auth.schema.ts
├── types/                      # TS types - one file per domain; infer from schema where possible
│   ├── auth.types.ts
│   ├── recording.types.ts
│   └── contact.types.ts
│
├── lib/                        # Utilities & infrastructure
│   ├── utils.ts                #   cn()
│   ├── api-client.ts           #   apiFetch: base URL + JSON + Cookie + ApiError
│   ├── auth-client.ts          #   Better Auth Expo client
│   ├── session-cookie.ts       #   the one place we write the session cookie
│   ├── query-client.ts         #   TanStack Query config
│   ├── query-keys.ts           #   the query-key factory (see 06)
│   ├── icons.ts                #   THE icon barrel - import lucide from here, never direct (S7)
│   ├── fonts.ts                #   useFonts map
│   ├── format.ts               #   date/duration/initials formatting
│   ├── file-share.ts           #   save / share a transcript or audio file
│   └── recordings.ts           #   source meta (label, icon), title fallbacks, helpers
├── api/                        # Per-domain data access + TanStack Query hooks
│   ├── recordings.api.ts       #   useInfiniteRecordings, useRecording, useRecordingAudio, ...
│   ├── contacts.api.ts         #   useInfiniteContacts, useContact, create/update/archive/delete
│   ├── interactions.api.ts     #   useContactInteractions, useLogInteraction, useContactRecordings
│   └── share.api.ts            #   useShareTranscript
├── hooks/                      # Shared hooks
│   ├── use-auth-deep-link.ts
│   ├── use-debounced-value.ts
│   └── use-color-scheme.ts
├── providers/                  # query-provider, theme-provider, session-provider
├── constants/                  # env.ts -> API_BASE_URL
├── global.css                  # the design tokens (see 03)
└── assets/images/              # icon, adaptive-icon, splash-icon, favicon, logo

(root: scripts/generate-icons.mjs, tailwind.config.js, babel.config.js, metro.config.js,
 app.json, eas.json, components.json, tsconfig.json, .npmrc, .env, .env.example)
```

> ⚠️ **`components/ui/` has three files, not twelve.** The plan was a React Native Reusables
> primitive set; **RNR / `@rn-primitives/*` were never installed**, and the UI is hand-rolled.
> `ui/` holds `search-bar.tsx`, `skeleton.tsx`, `states.tsx`. Avatars, badges and sheets live
> with their feature instead. There is **no `container.tsx`** — `screen.tsx` is the only shell,
> and the 16px gutter is applied as `px-4` at each screen. See `docs/03` §6.


### The rules (where does my file go?)

1. **Routes are thin.** A file in `src/app/` reads params, calls one or two hooks, and composes
   components. Real UI and logic move out.
2. **All components live in `src/components/`, grouped by screen/area.** Never put a component
   inside `src/app/` — that folder is routes only.
3. **Design-system primitives → `src/components/ui/`.** Truly shared layout (`Screen`,
   `Container`, `AppHeader`) sits at the `src/components/` root.
4. **Validation → `src/schemas/<domain>.schema.ts`** (Zod). Single source of truth for a form or
   payload shape.
5. **Types → `src/types/<domain>.types.ts`.** Infer from the schema when one exists
   (`type X = z.infer<typeof xSchema>`) so the two can't drift. Types that mirror a backend
   response are hand-written and **must cite the backend file they came from** in a comment.
6. **Data fetching → `src/api/<domain>.api.ts`**, wrapped in TanStack Query hooks. Screens call
   hooks, never `fetch`. See [06-DATA-LAYER.md](06-DATA-LAYER.md).
7. **Naming:** files `kebab-case`; components `PascalCase`; `*.schema.ts`, `*.types.ts`, `*.api.ts`.

> **Why this split?** `src/app/` stays purely about routing. Grouping components by screen keeps
> related UI together. Separate `schemas/` + `types/` gives validation and typing each an obvious
> home. It's the same structure as `ref/ninja-crm-mobile`, so anyone who has worked on that app is
> immediately at home in this one.

---

## 4. Patterns we follow

| Pattern | What it means here |
| ------- | ------------------ |
| **Thin routes, grouped components** | `app/` = routing only. Screen UI in `components/<screen>/`; primitives in `components/ui/`. |
| **Schema-first types** | Zod schema in `schemas/`; TS type inferred from it in `types/`. |
| **Container / presentation** | Screens get data via hooks and pass plain props to dumb components. |
| **Server state vs UI state** | Server data → TanStack Query. Local widget state → `useState`. Never copy server data into `useState`. |
| **Single API client** | One `apiFetch` in `lib/api-client.ts`. Base URL, auth header, error mapping live there once. |
| **Query-key factory** | Keys come from `lib/query-keys.ts`, never inlined ad hoc. |
| **Every list has four states** | loading (skeleton) · empty · error (with retry) · data. No exceptions. |
| **Pull-to-refresh everywhere** | Every scrollable data screen wires `refetch` to `RefreshControl`. |

---

## 5. Environment / config

The app needs to know where the backend lives:

```
# .env  (git-ignored; commit .env.example instead)
EXPO_PUBLIC_API_BASE_URL=https://<the-prm-backend-url>
```

- Must equal the server's `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL`, be **HTTPS**, and be
  reachable **from the phone**.
- `http://localhost:3000` will not work from a physical device. Use a deployed URL, or a tunnel
  (⚠️ free ngrok URLs rotate — update `.env` and restart with `-c`).
- `EXPO_PUBLIC_*` vars are **inlined into the bundle at build time**. They are not secret. Never
  put an API key here.
- A standalone build can't read your local `.env` — bake it into `eas.json` per profile.

---

## 6. Dependency-install caveat (learned on Ninja CRM Mobile)

In the sibling repo, `npx expo install` mis-resolved the project root — because a full second
Expo/Next project sits under `ref/` — and installed into the nested repo instead of the app.
**This repo has the same shape (`ref/prm`, `ref/ninja-crm-mobile`).**

✅ **Checked on 2026-09-15: it resolved correctly here** (`ref/prm/node_modules` and
`ref/ninja-crm-mobile/node_modules` are both absent, and `expo install` even added the
`expo-secure-store` config plugin to the right `app.json`). The likely reason is that the `ref/`
copies have no `node_modules` of their own. **Keep checking anyway** after each `expo install` —
if a `node_modules` ever appears under `ref/`, that's the bug resurfacing.

`ref/` is excluded from builds and tooling in three places, all already set up:

| File | Mechanism |
| ---- | --------- |
| `.easignore` | `ref/` — never uploaded to EAS build servers |
| `tsconfig.json` | `"exclude": ["node_modules", "ref", "docs", ".expo", "dist"]` |
| `tailwind.config.js` | `content: ["./src/**/*.{js,jsx,ts,tsx}"]` — never widen this to `./**` |

## 7. Bundle-size notes

Measured with `npx expo export --platform android` (2026-09-15):

- **Fonts must be imported from weight subpaths.** `@expo-google-fonts/bricolage-grotesque`'s root
  re-exports all 7 weights, so importing from it bundles every `.ttf` (~623KB) when we use 4
  (~356KB). `src/lib/fonts.ts` imports from `.../400Regular` etc. — **don't "tidy" those into a
  single root import.**
- **🚨 Import lucide icons from `@/lib/icons`, never from `lucide-react-native`.** The package
  barrel is not tree-shaken by Metro: importing from it bundles **all ~1600 icons** and added
  **~3MB** to the Android bundle for five icons (6.7MB → 4.8MB once fixed). `src/lib/icons.ts`
  re-exports each icon from its own module. Use the **`lucide-react-native/icons/<kebab-name>`**
  subpath — it's declared in the package's `exports` map. Reaching into `dist/esm/…` directly
  also works but is *not* in `exports`, so Metro logs a "falling back to file-based resolution"
  warning for every icon.
- **Icon names drift between lucide versions.** This version has `building` and `trash`, not
  `building-2` / `trash-2`. A wrong name is a red-screen crash at runtime, not a build error, so
  check the file exists under `node_modules/lucide-react-native/icons/` before committing.
- **Resize images before they enter `src/assets/`.** The PRM web logo is 16612×10624 — about
  **700MB decoded**, which crashes the app. The in-app logo is stored at 600×384 / 22KB.
- **The three launcher assets are generated, not hand-made.** `node scripts/generate-icons.mjs`
  derives `splash-icon.png` and `adaptive-icon.png` from the master `src/assets/images/icon.png`
  and asserts the rules that keep biting (Android's circular mask, iOS needing an opaque icon).
  Needs the `sharp` devDependency. Full rationale in `docs/03` §9.
- **A 944KB `MaterialSymbols` font ships whether we like it or not.** It comes from
  `expo-symbols`, which is a transitive dependency of **`expo-router` itself** in SDK 57. Not
  removable without patching expo-router; not worth it. Just know it's there before hunting for
  bundle bloat.
- **Run export checks into the scratchpad, not the repo:**
  `npx expo export --platform android --output-dir "$env:TEMP\prm-export"`.
- Four unused template packages were removed: `@expo/ui`, `expo-glass-effect`, `expo-device`,
  `expo-symbols` (the last one came back transitively, as above).

---

## 8. Order of work

Tracked properly in [implementation/IMPLEMENTATION-PLAN.md](implementation/IMPLEMENTATION-PLAN.md).
Short version:

0. ✅ **Backend**: REST surface + Expo auth plugin in `ref/prm` ([BACKEND-CHANGES](implementation/BACKEND-CHANGES.md))
1. ✅ Scaffold Expo (`src/` model) + NativeWind + tokens + fonts
2. ⚠️ UI primitives — `Screen` + `AppHeader` shipped; **RNR was never installed** and there is
   no `Container`. Only three files in `components/ui/`.
3. ✅ Auth: sign-in screen, deep-link capture, session guard
4. ✅ Data layer: `apiFetch`, query client, query keys
5. ✅ Tabs shell + Home (stats + recent recordings)
6. ✅ Recordings list
7. ✅ Recording detail
8. ✅ Audio player
9. ✅ Settings + theme, splash/icon, dev build
10. ✅ **Contacts** — added 2026-09-28, outside the original plan ([FEAT-02](features/FEAT-02-CONTACTS.md))
11. ⬜ **Tasks** — backend contracts documented, no screens
