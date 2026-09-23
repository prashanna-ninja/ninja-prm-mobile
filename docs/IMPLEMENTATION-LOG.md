# Implementation Log

A chronological diary of every meaningful change and decision. **Newest entry at the top.**

Each entry: what changed, why, what was decided, what's still open, and — importantly — **what is
only typecheck-verified rather than device-verified**. This file is what makes the next session
cheap; write it while the reasoning is still fresh.

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

**Nothing is implemented.** No `package.json`, no `src/`, no app — the repo is `ref/` + `docs/` +
`CLAUDE.md` + `HANDOVER.md`.

Next session starts at **Phase 0** (backend) or **Phase 1** (scaffold), depending on the answer to
question 1. Phases 1–3 don't depend on Phase 0 and can run in parallel with it, so if the backend
answer is slow to arrive, scaffolding is not blocked. See
[implementation/IMPLEMENTATION-PLAN.md](implementation/IMPLEMENTATION-PLAN.md).
