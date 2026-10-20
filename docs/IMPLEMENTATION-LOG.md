# Implementation Log

A chronological diary of every meaningful change and decision. **Newest entry at the top.**

Each entry: what changed, why, what was decided, what's still open, and — importantly — **what is
only typecheck-verified rather than device-verified**. This file is what makes the next session
cheap; write it while the reasoning is still fresh.

---

## 2026-10-20 — Messages moves to the second tab

At the user's request the bar is now **Home · Messages · Recordings · Contacts · Tasks**. Tabs
render in `Tabs.Screen` declaration order in `src/app/(app)/_layout.tsx`, so this was moving one
block; no route, link or param changed. CLAUDE.md rule 1, HANDOVER, 01-OVERVIEW and FEAT-04 updated.
Typecheck clean; not device-verified.

---

## 2026-10-18 — Session 8: Messages, and Settings moves to a gear

The web PRM grew a Messages module (two-way SMS through CrazyTel, `ref/prm` `1572969`…`73eb814`).
It is entirely server actions, so the first step was the backend prompt
(`docs/prompts/BACKEND-SMS-API.md`, `BACKEND-CHANGES` §11). The user then asked for the UI to be
built against those assumed endpoints, with **Messages taking Settings' tab slot and Settings
moving to the top-right of Home in place of the theme toggle.** Fourth scope widening.
Spec: `docs/features/FEAT-04-MESSAGES.md`.

### Added

- `(app)/messages/` — inbox, `[threadId]`, `new`; `api/sms.api.ts`, `types/sms.types.ts`,
  `lib/sms.ts`, `qk.sms.*`, `components/messages/` (thread row + avatar, filters, bubble,
  composer, line picker, save-contact sheet).
- Copied from Ninja CRM Mobile: `hooks/use-keyboard-height.ts` (CLAUDE.md referenced it, but it
  had never been brought over) and `lib/sms-segments.ts`.
- `hooks/use-app-active.ts` — gates polling on AppState.
- Contact detail: a **Text** button per phone number.

### Changed

- Tabs: Settings → Messages (with an unread badge). Settings is `href: null` and has a back arrow.
- Home: theme toggle → Settings gear.

### Decisions

| Decision | Why |
| -------- | --- |
| **Build the UI before the backend exists** | The user's call. The contract is pinned in the prompt and copied from the server actions' own return types, so drift should be small — but `sms.types.ts` is marked UNVERIFIED until real JSON is seen. |
| **Inverted FlatList for the thread** | Opens at the newest text without a scroll-to-end, and virtualises — a thread can hold 1,000 messages. Ninja CRM Mobile's ScrollView renders them all. |
| **Optimistic send, failed bubbles kept, retry reuses `clientRequestId`** | A dropped connection after CrazyTel accepted the text is the case idempotency exists for. A fresh id on retry would double-send. |
| **Inbox not polled; thread polled 15s; badge polled 60s; all off in the background** | Same cadence as the web for the open thread. An infinite query refetches every page, so the inbox refreshes on focus/pull instead. |
| **`POST /sms/check` on pull, `POST /sms/sync` only on ⟳** | Check is one self-throttled CrazyTel request; sync is up to fifty. |
| **Sheet inputs at the top, keyboard measured** | No KeyboardAvoidingView under edge-to-edge (gotcha 6). |

### Found along the way

- 🐛 **Contact detail rendered `phone` raw** — it's a JSON-encoded list, so the screen showed
  `["0403 656 153"]` and dialled it. Fixed: one row per number, `tel:` stripped to digits.
- 🚨 **`../ninja_prm` is behind `ref/prm`** and has no SMS code. Pull before running the prompt.
- Typed routes only regenerated with a NON-CI `expo start` this time (`CI=1` didn't write them).

### Verified vs. not

- ✅ `npx tsc --noEmit` clean with regenerated route types.
- ✅ `npx expo export --platform android` — 5.9MB (exported to a temp dir, not the repo).
- ❌ **No backend, so nothing has run end-to-end.** Not device-verified either.

---

## 2026-09-29 — Session 7: Tasks, the fifth tab

Contacts went out on iOS without the assign-a-recording backend change. The user then widened
the scope a third time: "we will be also starting todo and tasks". Todo and Tasks are the same
thing — the PRM has one `Task` model, and recording action items already become tasks on the
server (`lib/recordings/auto-tasks.ts`, all four sources). Spec: `docs/features/FEAT-03-TASKS.md`.

### Added

- **Tasks tab** (`(app)/tasks/`): list, `new`, `[id]`, `[id]/edit`. The list's `_layout`
  sets `initialRouteName: "index"` so a task opened from a contact still has the list under it.
- `api/tasks.api.ts`, `types/task.types.ts`, `lib/tasks.ts` (due-day maths, HTML ⇄ text),
  `qk.tasks.*`, and `components/tasks/` (row, tick, badges, filters, form, due-date field,
  contact picker sheet). Nine icons added to `lib/icons.ts`.
- **Contact detail:** the Open tasks block is always shown, rows open the task (Back returns to
  the contact via `fromContact`), and **＋ Task** creates one pre-linked.
- `docs/prompts/BACKEND-TASK-PATCH-FIX.md` and `BACKEND-CHANGES` §10.

### Decisions

| Decision | Why |
| -------- | --- |
| **Write local noon; read by rounding to the nearest local midnight** | The server keeps only the calendar day, read in the user's *profile* timezone. We have no tz database and Hermes' Intl is unreliable on Android. Noon survives any ±12h phone/profile mismatch on the way in; nearest-midnight recovers the day on the way out. |
| **A plain-JS month grid, not `@react-native-community/datetimepicker`** | That's a native module — a new native build and per-platform behaviour — for a date-only field. Keeping Tasks pure JS means it tests on the existing dev build with a Metro reload. |
| **The To do view groups by due date; Done/All sort by last updated** | The API sorts `dueAt asc` with NULLs last, so the groups (Overdue → No due date) arrive in order and headings fall out row by row across pages. |
| **Optimistic tick, and only the tick** | A checkbox that waits a round-trip reads as broken. It's instant and trivially reversible — the bar in docs/06 for going optimistic. |
| **Edit sends only changed fields** | Two reasons: an untouched description keeps the web's rich-text HTML intact, and `contactIds` (which triggers the server's delete-then-recreate) only goes out when the set really changed. |
| **Priority pill only for High / Low** | Normal is nearly every task; a grey pill on every row is noise. |

### Found along the way

- 🐛 **Contact detail showed "Due 12:00 am" for a task due today.** It formatted `dueAt` with
  `formatDateCompact`, which prints a *time* for today — and a due date is a midnight instant.
  Now uses `formatDueDay`.
- 🚨 The task PATCH data-loss bug (known) — confirmed at the line level in both `ref/prm` and
  `../ninja_prm` (the file is identical). Unreachable from the app; written up, not fixed.
- `sourceType` includes `fieldy` despite the schema comment saying `call | plaud | granola`.
- ⚠️ **`npm run lint` is a trap.** No ESLint is configured, so `expo lint` *installs and
  configures one*: it touched `package.json`, rewrote `package-lock.json` and created
  `eslint.config.js`. Reverting was blocked by a permission prompt — **still in the working
  tree**, see HANDOVER.

### Verified vs. not

- ✅ `npx tsc --noEmit` clean, with typed routes regenerated (they were stale until an
  `expo start`).
- ✅ `npx expo export --platform android` — bundle builds, 5.8MB.
- ❌ **Nothing device-verified.** Not the tick, not the date round-trip to the web, not the
  cross-tab Back behaviour, not dark mode. Checklist: FEAT-03 §4.

---

## 2026-09-29 — Session 6: the icon master moved into this repo

The wordmark was redrawn by hand (bigger PRM, different face) and dropped in as
`src/assets/images/icon.png`. Only that one file changed, so the other two
assets were a generation behind.

### Changed

- **`scripts/generate-icons.mjs` now reads `src/assets/images/icon.png`**, not
  `ref/prm/public/logo.png`. The icon is both an input and an output: the mark
  is lifted off its ground and re-laid onto a 1024² canvas. Re-point it at the
  web logo only if the two artworks are brought back into sync.
- **`splash-icon.png` and `adaptive-icon.png` regenerated** from the new mark.

### Decisions

| Decision | Why |
| -------- | --- |
| **Recover alpha from the blue channel** rather than chroma-key or threshold | The master is flat white over one flat orange, so every pixel is `a` parts white — and blue has the widest spread between the two (22 → 255), which recovers `a` exactly. Verified first: **0 of 1,166,400 pixels** fall outside that model. A threshold would have left an orange fringe, visible as dirt once the mark is composited onto the splash's orange. |
| **Normalised the icon's ground to `#ff8900`** | The hand-drawn master came in at `#FF9416`. Left alone, an iPhone would show a `#FF9416` home-screen icon that jumps to a `#ff8900` splash on launch. CLAUDE.md §2 makes `#ff8900` the brand colour, so the icon follows it. The artwork itself is untouched. |
| **`MASKED_PCT` stays at 0.52** | The wordmark is the same width in the new art as the old (76.1% vs 76%), so the same percentage renders the letters at the size they have always been. The new art is *shorter*, which only buys circle-mask headroom: diagonal 606/683 vs 631/683 before. |

### Notes

- `ICON_PCT` is now effectively a no-op re-crop — the master already sits at
  76.1%. It's kept so the three assets stay defined in one place.
- The sharpen pass is now conditional (`markW < mark.width * 0.9`). It existed
  for the >20× downscale from the 16612px web logo; sharpening the icon's ~5%
  resize would only add ringing.
- **Not device-verified.** Icons are native — this needs an `eas build`.

### Docs debt paid off

The compacted session shipped Contacts without the paperwork CLAUDE.md §8 requires, and nobody
had audited `docs/` since the app was a scaffold. Every doc was checked against the code.

**New:**

- **`docs/features/FEAT-02-CONTACTS.md`** — Contacts had no feature doc at all, so the only
  record of it was the diff. Includes the six wire-format traps (JSON-encoded `likes`/`dislikes`,
  list-vs-detail shape divergence, 500-on-invalid-enum, the hard delete).
- **`docs/prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md`** — the prompt for the one endpoint
  that's actually blocking.

**Corrected — the ones that could have caused a bug:**

- 🚨 **`docs/03` told you to write `font-semibold`.** That's the exact class that emits
  `fontWeight: 600` with no `fontFamily` and **crashes Android** in `TextLayoutManager`. The doc
  had never been updated after the fix; it now documents `font-sans-semibold` and explains why
  the prefix exists.
- **`docs/03` pointed at `lucide-react-native` directly** — the ~3MB barrel. Now points at
  `@/lib/icons`, and `docs/02` corrects the subpath from `dist/esm/icons/…` (not in `exports`,
  warns on every import) to `lucide-react-native/icons/…`.
- **`docs/06`'s query-key factory didn't match the real one.** It listed a `recordingCategories`
  key that doesn't exist, a one-arg `contacts.list(search)` that's actually `(params)`, and
  omitted four contacts keys. Anyone copying it would have written keys that never invalidate.

**Corrected — stale but harmless:**

- **`docs/02`'s file tree listed 12 UI primitives; three exist.** React Native Reusables was
  never installed and the UI is hand-rolled — that was a real decision that had never been
  written down anywhere. Also added the whole missing `components/contacts/` folder, `lib/icons.ts`,
  `lib/file-share.ts`, three of the four `api/` modules, and `session-provider.tsx`; removed
  `container.tsx` and `auth.api.ts`, which don't exist.
- **`docs/01`** still said "two bottom tabs" and "not in v1: contacts".
- **`docs/04`** documented contacts as a read-only afterthought and interactions not at all;
  now lists all nine contacts/interactions routes the app calls, plus share, plus the missing
  `contacts/:id/fieldy-conversations`.
- **`IMPLEMENTATION-PLAN.md`** had only Phase 1 ticked out of eleven. Rather than mass-ticking
  fifty checkboxes nobody maintained, it now opens with a status block naming what shipped and
  — more usefully — the ten things that genuinely **didn't**.
- **`CLAUDE.md` rule 1** still described the two-tab Recordings-only scope.
- `BACKEND-CHANGES.md` §7 reframed from "Optional: write endpoints" to a live blocker, with the
  shape mismatch between the four server actions spelled out: `assignCallRecordingContact` takes
  one id and **throws**; the other three take an array and **return** `{success, error?}`. That
  asymmetry is the whole difficulty of wrapping them.
- `docs/README.md` re-indexed; `HANDOVER.md` rewritten (it was still dated 2026-09-15).

**Decisions recorded, not changed:** RNR was never installed — the docs now say so instead of
implying a primitive library exists. `qk.me()` and `recording-categories` are dead code and a
ghost endpoint respectively; both are now labelled rather than quietly carried.

`npx tsc --noEmit` clean. No source files changed in this session apart from the icon assets.

---

## 2026-09-24 → 28 — Session 5: contacts, share UI, iOS/Android fixes

Shipped across `5f221e9`, `4ee67a7`, `7966c1e`, `b5f972c`. Summarised here
because the detail lives in the commits.

- **Contacts tab** — list with search and relationship filter, create, detail
  with overview counters, per-contact call recordings, and interaction logging
  (`api/contacts.api.ts`, `api/interactions.api.ts`, `components/contacts/*`).
- **Share transcript by email** — brought the web's feature to the phone
  (`api/share.api.ts`, `components/recordings/share-transcript-sheet.tsx`),
  alongside the existing save/copy.
- **Per-source recording details** — source-specific extras on `[source]/[id]`.
- **Fixed: white band above the orange hero on notched iPhones** — the login
  hero's gradient didn't extend under the status bar. `auth-hero.tsx` now takes
  `topInset` and adds it to the gradient's own `paddingTop`; padding the parent
  leaves the gradient short.
- **Fixed: Android preview crashed after the splash** — the `@expo/ui`
  autolinking exclusion added for an iOS Swift compile error was global, so
  Android lost a module it needed. Scoped to `ios` in `package.json`.
  ⚠️ **Still unverified** — needs an Android preview build to confirm.

### Open

- **No endpoint assigns a recording to a contact.** Confirmed by listing all 54
  non-GET handlers in the PRM API: every recordings route is GET-only except
  `share` (POST), and `PATCH /contacts/[id]` has no recording field. The web
  does it through a server action, which native can't call. This traces back to
  the "v1 is read-only" decision in BACKEND-CHANGES §7. Needs
  `PUT /api/v1/recordings/:source/:id/contacts` — prompt not yet written.
- Tasks UI: backend contracts documented, no screens yet.

---

## 2026-09-23 — Session 4: data layer, dashboard, list, detail, audio, share

Phases 4–8 landed. The app now signs in, shows a dashboard, lists and filters
recordings, opens a detail screen, plays audio, and saves/shares files.

### Built

- **Data layer** — `lib/api-client.ts` (`apiFetch`), `lib/query-client.ts`,
  `lib/query-keys.ts` (key factory + `normalizeListParams`), `api/recordings.api.ts`,
  `types/recording.types.ts`, `lib/format.ts`, `hooks/use-debounced-value.ts`.
- **Shell** — three tabs: Home · Recordings · Settings.
- **Home** — two-line greeting, This-week (+WoW trend) and Needs-a-contact stat
  cards, source breakdown card that deep-links into a filtered list, 5 recent,
  theme toggle in the header.
- **Recordings** — debounced search, source chips with live counts,
  newest/oldest, infinite scroll, pull-to-refresh, all four states.
- **Detail** — `[source]/[id]`, one route for all four sources.
- **Audio player** — `expo-audio`: play/pause, ±15s, scrubber, 1×–2× speed with
  pitch correction, background playback.
- **Save / share** — `lib/file-share.ts` + `components/recordings/recording-actions.tsx`.

### Decisions

| Decision | Why |
| -------- | --- |
| **Three tabs, Settings among them** | Superseded the two-tab plan in FEAT-01 §3 at the user's request; the Home header now carries the theme toggle instead of a settings gear. |
| **Session moved OFF `authClient.useSession()`** | Better Auth's `useStore` backs `useSyncExternalStore` with a `getSnapshot` reading a ref its own `subscribe` mutates. React 19 flagged it as tearing on every launch. `providers/session-provider.tsx` drives the session from `useState` + the public `getSession()`/`signOut()`. Also switched the import to `better-auth/client` so the React hooks module isn't bundled at all. **Do not put the hook back.** |
| **Sign-out clears the query cache** | Otherwise the next user on the device sees the previous user's recordings — call transcripts — until each query happens to refetch. |
| **Share via a .txt FILE, not `Share.share({message})`** | Transcripts run to tens of thousands of characters and SMS/mail clients silently truncate long bodies. |
| **Audio URL fetched on demand** (`enabled: false` + `refetch()`) | The signed URL expires; fetching it eagerly on every detail view burns links and risks handing the player a stale one. |

### Bugs found and fixed (all on-device)

1. **Login button invisible but tappable** — `style={({pressed}) => …}` on
   `Pressable`. NativeWind 4 wraps RN components and does **not** forward the
   function form; the style was dropped entirely. Now CLAUDE.md gotcha §4b.
2. **Native text-measure crash** (`IllegalStateException: Required value was
   null` in `TextLayoutManager`) — my Tailwind font families were named
   `medium`/`semibold`, which **collide with Tailwind's built-in fontWeight
   scale**. `font-semibold` resolved to `fontWeight: 600` with no `fontFamily`,
   and Android's Fabric text measurer threw. Renamed to `sans-medium` /
   `sans-semibold`.
3. **Tab bar bubble spilling below the bar** — Android's default tab button uses
   an unbounded ripple, and the safe-area inset was being added on top of the
   bar's own padding under always-on edge-to-edge.
4. **Gradle failure: `resource drawable/splashscreen_logo not found`** — the
   splash plugin had `imageWidth`/`resizeMode` but no `image`.
5. **Blank iOS app icon** — root `icon` is not enough on SDK 57; `ios.icon` must
   be set explicitly. Confirmed by comparing against `ninja_totp_mobile` (SDK 55,
   sets it, works). My first theory — that the alpha channel was at fault — was
   **wrong**: both working sibling apps ship 4-channel PNGs.
6. **Blurry icon** — measured `ninja_crm_mobile`'s icon at 75.5% mark width vs
   our 66%. Matched it at 76% and added a sharpen pass after the >20× downscale.

### Notes

- `scripts/generate-icons.mjs` regenerates icon/splash/adaptive from the master
  logo and **asserts** the two rules that keep biting: the mark's diagonal must
  fit Android's circular mask, and the iOS icon must be opaque.
- lucide's barrel isn't tree-shaken (~3MB for 5 icons) — `lib/icons.ts` imports
  each icon from `lucide-react-native/icons/<name>`.
- Expo packages aligned to SDK 57 patches via `expo install --fix`.

### TestFlight prep (2026-09-23)

- **Removed two permissions we don't use.** `expo-audio` defaults to adding
  `NSMicrophoneUsageDescription` + Android `RECORD_AUDIO`, and
  `expo-secure-store` adds `NSFaceIDUsageDescription`. We only PLAY audio and
  we use SecureStore with plain get/set, so both are now disabled in the plugin
  options. Unjustifiable permissions are a standard App Review question.
  **Kept** `enableBackgroundPlayback` → `UIBackgroundModes:["audio"]`, which is
  what makes playback survive a locked screen.
- `eas.json` `production`: `distribution: store`, `autoIncrement`, Android
  `app-bundle`. `submit.production.ios.ascAppId` still needs the real App Store
  Connect ID.
- **`expo-network` installed** — `@better-auth/expo` lazily `import()`s it in
  its online manager. Missing, it threw "Cannot find module" in dev (caught, so
  harmless, but noisy). Its peer range (`^8.0.7`) predates Expo renumbering to
  match the SDK major, so a `.npmrc` with `legacy-peer-deps=true` is required
  or a clean `npm install` fails with ERESOLVE. Verified
  `addNetworkStateListener` is present and unchanged in 57.x.
- Wired TanStack Query's `onlineManager` to it (docs/06 §6) — queries now pause
  offline instead of failing.

### Email transcript — shipped (2026-09-24)

Backend merged (PR #5) and **verified live**: `POST /api/v1/recordings/:source/:id/share`
returns 401 unauthenticated and 400 for a bad source, both JSON.

Mobile side:

- `api/share.api.ts` — `useShareTranscript()` plus `parseRecipients()`, which
  splits exactly the way the server does so our count matches its limit.
- `components/recordings/share-transcript-sheet.tsx` — a Modal matching the
  web dialog: recording confirmation card, message, recipients, **Email me**,
  Cancel / Send.
- The **Share** button is back, relabelled **Email**, opening that sheet.
  The row is now **Save audio · Email · Copy**.

Notes:

- **Server error messages are shown verbatim.** They're written for humans and
  are exact ("You can send to up to 10 recipients at once."), so paraphrasing
  them in the client would only invent a second source of truth.
- The 10-recipient and 4,000-char caps are **mirrored client-side** for instant
  feedback, but the server remains the authority.
- **"Email me"** prefills from the session, and hides once your address is
  already in the list.
- The OS-share-as-`.txt` path was dropped from the UI — `shareTextAsFile` stays
  in `lib/file-share.ts` as a utility. Email covers the real need, and two
  buttons both called "share" doing different things is worse than one.

### Parked (superseded 2026-09-24 — see above)

**Share button commented out (user's call).** The detail screen ships with
**Save audio** + **Copy transcript** only.

The OS share sheet (transcript as a `.txt`) works and is still in the code,
commented, in `components/recordings/recording-actions.tsx`. It was parked
because it is **not the same feature as the web's "share"**: the PRM web app
collects recipient addresses plus a note and has the SERVER email a branded
transcript (`shareRecordingTranscript` in
`ref/prm/src/app/actions/share-transcript.ts`). That is a **server action with
no REST route**, so matching it needs one new backend endpoint:

    POST /api/v1/recordings/:source/:id/share   { recipients, note? }

a thin wrapper over the existing action — `parseRecipientEmails`,
`validateRecipientEmails`, the 4,000-char note cap and
`sendTranscriptShareEmail` all already exist. `/api/v1/me` covers the sender
defaults, so no second endpoint. Undecided which version we want; nothing is
blocked either way.

### Next

Per-source `details` blocks on the detail screen (call numbers, Plaud key
topics, Granola attendees, Fieldy quotes) — the data already arrives in
`details` and is simply not rendered yet.

---

## 2026-09-15 — Session 3: Sign-in screen (UI only)

Built the magic-link sign-in screen while the backend work runs in parallel. **First time the app
ran on a real device**, which immediately paid for itself — see the bugs below.

### What was built

- `src/app/(auth)/sign-in.tsx` + `(auth)/_layout.tsx`; moved the Phase-1 design-check screen to
  `(app)/index.tsx` and added `(app)/_layout.tsx`.
- Root `_layout.tsx` now has the real `Stack.Protected` guard structure, with `IS_SIGNED_IN_STUB`
  standing in for the session until Phase 3.
- `components/login/`: `auth-hero`, `login-form` (both steps), `email-field`, `auth-button`,
  `auth-palette`, `fade-in`.
- `schemas/auth.schema.ts` + `types/auth.types.ts` (inferred, not hand-written).
- `lib/icons.ts` — the icon barrel (see below).
- Real logo imported from `ref/prm/public/logo.png`.

**Design:** brand-orange gradient hero with the white wordmark, white sheet overlapping its bottom
edge by 24px, boxed email field whose border animates to orange on focus, orange pill CTA. Two
steps — email → "check your inbox" — with the hero copy changing between them so the transition
feels like one screen rather than two. The sent state makes the **email address the hero**, since
"did I type it right?" is the user's only real worry at that moment.

**Still a stub:** `sendLink()` fakes a 900ms round-trip. Phase 3 swaps in
`authClient.signIn.magicLink(...)` — one function. The UI is already written against the real
failure modes (60s resend cooldown matching the server's 3-per-60s rate limit, 15-minute TTL copy,
network error state).

### 🚨 Three bugs found by running it on a device

| Bug | Cause | Fix |
| --- | ----- | --- |
| **Login button invisible but still tappable** | `style={({pressed}) => ({…})}` on `Pressable`. **NativeWind 4 wraps every RN component for `className` support and does not reliably forward the FUNCTION form of `style`** — it was silently dropped, so the button had no background and no text colour. | Track press state with `onPressIn`/`onPressOut` + `useState`, pass a plain style **object**. Added to the CLAUDE.md gotcha list as §4b; there were two instances. |
| **Huge blank gap mid-sheet** | Two sibling `flex: 1` views (the sheet and the footer) splitting the space between them. | Footer uses `marginTop: "auto"` instead. |
| **Logo enormous / no top breathing room** | Source PNG is **16612×10624** — ~700MB decoded, which would have crashed the app outright. | Resized with `sharp` to 600×384 / **1075KB → 21.5KB**, displayed at 104×67, hero `paddingTop` 28. |

### Other findings

- **lucide-react-native's barrel is not tree-shaken by Metro.** `import { Send } from
  "lucide-react-native"` bundled **all ~1600 icons**: the Android bundle went 3.7MB → **6.7MB** for
  five icons. Fixed with `src/lib/icons.ts`, which re-exports each icon from its own module
  (`dist/esm/icons/<kebab-name>`), plus a `tsconfig` `paths` entry pointing at the matching
  `dist/types/icons/*.d.ts`. Bundle back to **4.8MB**, and verified by grepping the output for
  icons we don't use (`croissant`, `venetian-mask`, `aperture` → all 0).
- **Export checks now write to the scratchpad**, not `.verify/` in the repo.
- Design deviation, deliberate: the auth screen uses an explicit palette
  (`components/login/auth-palette.ts`) rather than the themed tokens. It's always light and always
  brand-forward — a signed-out screen that flips to dark adds nothing. Everything behind the guard
  uses the normal tokens.

### Next

Phase 2 (UI primitives) or Phase 3 (wire auth) once the backend lands. The sign-in screen is
**device-verified for layout**; the send/resend path is still a stub.

---

## 2026-09-15 — Session 2: Phase 1 complete (scaffold + design system)

**The app exists.** Expo scaffolded, NativeWind v4 stable wired up and verified, brand tokens and
fonts in place, theme provider working. `tsc` clean, `expo-doctor` 20/20.

⚠️ **Bundle-verified, NOT device-verified.** No emulator or device was available this session.
Everything below was proven by `npx expo export` + inspecting the output bundle. **First job next
session: run it on a real device.**

### What was done

- Scaffolded with `create-expo-app` into a temp sibling folder, then merged in — keeping our
  `docs/`, `CLAUDE.md`, `HANDOVER.md` and dropping the template's own `CLAUDE.md`/`AGENTS.md`/demo
  screens and assets.
- Configured: `app.json` (identity + `#ff8900` splash), `tsconfig` (alias + **`ref/` excluded**),
  `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `src/global.css`, `.env.example`,
  `.easignore`, `.gitignore`.
- Wrote `src/lib/fonts.ts`, `src/lib/utils.ts`, `src/constants/env.ts`,
  `src/providers/theme-provider.tsx`, `src/hooks/use-color-scheme.ts`, `src/app/_layout.tsx`.
- `src/app/index.tsx` is a **temporary** design-system check screen (type scale, swatches,
  surfaces, theme toggle). **Delete it in Phase 5.**

### Versions (the baseline everything now resolves against)

Expo SDK **57.0.22** · RN **0.86.3** · React **19.2.3** · **NativeWind 4.2.7** ·
Tailwind **3.4.17** · TypeScript ~6.0.3. Dev machine on Node 24.14.1.

### Decisions & findings

| Item | Outcome |
| ---- | ------- |
| **NativeWind v4 stable on RN 0.86** | User asked for v4 stable (4.2.7; v5 is RC-only). This was a **genuine compatibility risk** — 4.2.x predates this RN line and NativeWind 5 is the one built for the new Metro. Rather than guess, I **tested it before committing the project**: built a throwaway bundle and grepped it. Tailwind's JIT had compiled a custom colour and NativeWind had embedded the runtime. **It works.** That two-minute test is the recipe if an SDK bump ever breaks it. |
| **SDK 57 template already uses `src/`** | No restructuring needed, and `global.css` lives at **`src/global.css`**, not the repo root as in `ref/ninja-crm-mobile`. `metro.config.js` points there. |
| **Template ships no babel/metro config** | Both created from scratch for NativeWind. |
| **`newArchEnabled` + `android.edgeToEdgeEnabled` are dead keys** | `expo-doctor` rejected them — in SDK 57 both are **always on**. I'd copied them from the SDK 54 reference app. Removed. ⚠️ Edge-to-edge being permanent means **gotcha §7.6 (`KeyboardAvoidingView` doesn't work) definitely applies to us.** |
| **Fonts must use weight subpaths** | The font package's root re-exports all 7 weights → Metro bundled every `.ttf` (623KB) for the 4 we use (356KB). Switched to `.../400Regular` style imports. **Don't "tidy" these back into one root import.** |
| **A 944KB MaterialSymbols font ships regardless** | It comes from `expo-symbols`, a **transitive dep of `expo-router` itself** in SDK 57. Not removable without patching expo-router. Documented so nobody re-hunts it. |
| **Removed 4 unused template packages** | `@expo/ui`, `expo-glass-effect`, `expo-device`, `expo-symbols`. |
| ✅ **The `expo install` gotcha did NOT bite** | `ref/prm/node_modules` and `ref/ninja-crm-mobile/node_modules` are both absent and `expo install` correctly patched our `app.json`. Likely because the `ref/` copies have no `node_modules`. Still worth re-checking after each install. |

### Next

**Phase 2 — UI primitives** (RNR button/card/input/text/badge/avatar, plus `Screen`, `Container`,
`AppHeader`, `skeleton`, `search-bar`), or **Phase 0 — backend** now that editing `ref/prm` is
confirmed possible. Phase 0 is the critical path: no backend endpoints means no real data for
Phases 5–7.

---

## 2026-09-14 — Session 1: project kickoff, reference review, documentation

**Nothing has been built yet.** This session was: read both reference codebases end to end, decide
the shape of the project, and write the docs we'll work from.

### What was done

- Read `ref/prm` (the Ninja PRM Next.js web app): auth config, the recordings feature end to end
  (server actions → list client → four detail components), the Prisma models, the API surface,
  design tokens and fonts.
- Read `ref/ninja-crm-mobile` (the sibling Expo app): folder conventions, auth-on-Expo pattern,
  API client, design system, docs format, and its hard-won gotcha list.
- Wrote the doc set: `CLAUDE.md`, `HANDOVER.md`, `docs/01`–`06`,
  `docs/features/FEAT-01-RECORDINGS.md`, `docs/implementation/IMPLEMENTATION-PLAN.md`,
  `docs/implementation/BACKEND-CHANGES.md`, this log, and `docs/PROMPTS.md`.

### Decisions

| Decision | Rationale |
| -------- | --------- |
| **v1 = Recordings only** | It's the one part of the PRM that's consumed rather than authored, so it's the part that's genuinely better on a phone. |
| **Primary `#ff8900`**, everything else from the web palette | User's brand call. The web's blue primary is the only token we replace; keeping the neutrals identical is what makes it read as the same product. |
| **Bricolage Grotesque, one family, four weights** | It's the web app's `--font-sans` (`ref/prm/src/app/layout.tsx`). RN needs each weight loaded by name — synthetic bold looks wrong on Android. |
| **Splash `#ff8900` + white mark**; Android adaptive-icon background the same | User's call; matches the Ninja CRM Mobile pattern (which uses purple `#370249`). |
| **Added `--primary-soft` / `--primary-strong` / `--destructive-soft` tokens** | NativeWind can't do alpha on `hsl(var(--x))` tokens — a known Ninja CRM Mobile gotcha. Solid tints instead of `bg-primary/10`. |
| **Orange is a fill, not body text** | `#ff8900` is ~2.2:1 on white. Fills, icons and accent rules only; `--primary-strong` for the rare orange text. |
| **Two tabs: Home · Recordings** *(revised mid-session at the user's request)* | Originally specced as Recordings · Settings. The user asked for a dashboard-style home instead: stats about the recordings, recent recordings, and a "View all". Better call — it gives the app a landing screen with a reason to open it, and follows the Ninja CRM Mobile dashboard pattern (two-up stat row → recent list → View all). **Settings moves to a gear icon in the Home header** (`href: null` route), which is where it belongs anyway. |
| **Home needs a new `GET /api/v1/recordings/stats`** | Checked `/api/v1/dashboard` and `actions/dashboard.ts`: **no recording data at all**. Eight counts + one duration aggregate, week windows in the user's timezone, same archived/spam predicate as the list so the numbers can't disagree with what the list shows. |
| **Home's stats and recent list are separate queries** | If stats fail, recent recordings should still render. One hook for both would blank the whole screen on a single failure. |
| **`<RecordingRow>` is shared** between Home (compact) and the list | Two copies of the same row drift within a week. |
| **No chart on Home** | A sparkline needs a time-series endpoint and, at 390px, says less than a trend arrow. Parked in FEAT-01 §10. |
| **One detail route `[source]/[id]`** | Four near-identical route files = four places to fix each bug. |
| **TanStack Query is the only cache**, keys from a factory in `lib/query-keys.ts` | Prevents the ad-hoc-key drift that quietly breaks invalidation. |
| **v1 is read-only** | Archive / assign-contact / change-category are drafted but deferred; decision point is Phase 6. |
| **Share via the OS sheet**, not the web's email-a-transcript dialog | Phone-native, and needs no backend. |
| **No RBAC layer** | Unlike Ninja CRM, the PRM scopes everything by `userId`/`ownerId`; roles only gate the admin areas. Nothing to port. |
| **No disk persistence of the query cache** | Recordings contain call transcripts. Encrypted offline storage is a scoped piece of work, not a one-line persister. |

### Key findings from the reference review

0. 🚨 **The PRM has no recording stats anywhere.** Grepped `/api/v1/dashboard/route.ts` and
   `src/app/actions/dashboard.ts` for all four recording models — zero matches. The Home screen's
   numbers are entirely new backend work (`BACKEND-CHANGES` §5).
1. 🚨 **The PRM has no REST API for recordings.** The web list is a server component calling the
   `getUnifiedRecordings()` server action directly. Native can't call server actions. The only
   recordings-related routes that exist are two audio endpoints and three per-contact lists.
   **The backend must grow a small REST surface first** — this is Phase 0 and it is a hard
   blocker. (This is the biggest difference from Ninja CRM Mobile, whose backend already had
   `/api/*` routes because its own web client used them.)
2. 🚨 **Plaud audio can't be played natively as-is.** `/api/v1/plaud-recordings/[id]/audio`
   streams bytes behind the session cookie, and `expo-audio` hands the URL to the OS player, which
   won't send our cookie. Call recordings are fine (presigned S3). Two options written up in
   `docs/04-BACKEND-REFERENCE.md` §4; recommendation is a short-lived signed proxy URL.
3. ✅ **Auth is closer than expected.** Magic link is already the PRM's primary web sign-in,
   `sendMagicLink` passes any `callbackURL` straight through, `/api/auth/[...all]` is already
   CORS/Origin-patched for mobile, and `trustedOrigins` already reads
   `BETTER_AUTH_TRUSTED_ORIGINS` — so trusting `ninjaprm://` is an env value, not a code change.
   Only the `expo()` plugin is missing.
4. ⚠️ **`nextCookies()` is first in the plugin array** in `ref/prm/src/auth.ts`; Better Auth wants
   it last. Fixing it is correct but touches web login — re-test.
5. ⚠️ **`getUnifiedRecordings` merges in memory** with `MAX_FETCH = 500` per source, so deep
   pagination degrades and silently truncates, and `sortBy: "title"` only sorts the fetched
   window. Acceptable for v1; flagged, not fixed.
6. ⚠️ **`actionItems` is `Json?`** on all four models and is not guaranteed to be `string[]` — the
   web defends against it at every call site. We sanitise it once, server-side.
7. ⚠️ **`expo install` mis-resolves in repos with a nested project under `ref/`** (cost the CRM app
   real time). Same repo shape here — verify every install lands in the root `package.json`.

### Open questions (need answers before Phase 0/1)

1. **Can we edit and redeploy `ref/prm`?** Hard blocker — see above.
2. **Which backend URL do we build against** (deployed staging vs. a tunnel)? The phone can't
   reach `localhost`.
3. **Scheme `ninjaprm://` and ids `com.adviceninja.ninjaprm`** — confirm, or supply preferred ones.
4. **Plaud audio:** signed proxy URL (backend work, better UX) or download-then-play (no backend
   work, slower)?
5. **Read-only v1?** Or do archive / assign-contact / change-category ship? (Decision point is
   Phase 7; answering earlier means the Home "Needs contact" card can deep-link into a real
   work queue instead of just navigating.)
6. **Logo artwork** — needed for the icon, adaptive icon and splash.

### Not done / next

> ⏪ **Historical.** This was true on 2026-09-14 and is kept as written. The log is newest-first,
> so the bottom of this file is the oldest entry — don't read it as current status. For that, see
> [../HANDOVER.md](../HANDOVER.md).

**Nothing is implemented.** No `package.json`, no `src/`, no app — the repo is `ref/` + `docs/` +
`CLAUDE.md` + `HANDOVER.md`.

Next session starts at **Phase 0** (backend) or **Phase 1** (scaffold), depending on the answer to
question 1. Phases 1–3 don't depend on Phase 0 and can run in parallel with it, so if the backend
answer is slow to arrive, scaffolding is not blocked. See
[implementation/IMPLEMENTATION-PLAN.md](implementation/IMPLEMENTATION-PLAN.md).
