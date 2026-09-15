# Implementation Log

A chronological diary of every meaningful change and decision. **Newest entry at the top.**

Each entry: what changed, why, what was decided, what's still open, and — importantly — **what is
only typecheck-verified rather than device-verified**. This file is what makes the next session
cheap; write it while the reasoning is still fresh.

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
