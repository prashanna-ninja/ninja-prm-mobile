# Implementation Plan

The build order. **We work one phase at a time**, and each phase ends the same way: it runs on a
device, it gets a dated entry in [../IMPLEMENTATION-LOG.md](../IMPLEMENTATION-LOG.md), and
[../../HANDOVER.md](../../HANDOVER.md) gets refreshed.

Legend: ⬜ not started · 🔄 in progress · ✅ done · ⏸ blocked

---

## Phase 0 — Backend groundwork ⬜ *(blocked on: can we edit `ref/prm`?)*

Everything in [BACKEND-CHANGES.md](BACKEND-CHANGES.md). Nothing in the app can be tested against
real data until this lands.

- [ ] `@better-auth/expo` + `expo()` plugin + `ninjaprm://` trusted origin
- [ ] `GET /api/v1/recordings`
- [ ] `GET /api/v1/recordings/[source]/[id]`
- [ ] `GET /api/v1/recordings/[source]/[id]/audio`
- [ ] `GET /api/v1/recordings/stats` *(the Home screen — nothing like it exists today)*
- [ ] `GET /api/v1/recording-categories` *(or explicitly defer)*
- [ ] Deployed to an HTTPS URL reachable from a phone
- [ ] All of it verified with `curl` ([BACKEND-CHANGES](BACKEND-CHANGES.md) §8)

**Exit:** `curl` returns real recordings; web sign-in still works.

> Phases 1–3 don't depend on Phase 0 and can run in parallel with it.

---

## Phase 1 — Scaffold & design system ✅ *(2026-09-15)*

- [x] `create-expo-app` (SDK 57), merged into this repo; template already uses `src/`, alias `@/*`
- [x] `app.json`: name, slug, scheme `ninjaprm`, bundle/package ids, splash `#ff8900`
- [x] Exclude `ref/` from tsconfig + `.easignore` (tailwind content glob already scoped to `src/`)
- [x] **NativeWind 4.2.7 (v4 stable) + Tailwind 3.4.17**, verified working on RN 0.86 via a test bundle
- [x] `src/global.css` with the full token set from [03](../03-DESIGN-SYSTEM.md) + `tailwind.config.js` mapping
- [x] Bricolage Grotesque (4 weights) via `useFonts`, wired to `tailwind.config.js`
- [x] `.env.example` + `constants/env.ts` + `.gitignore` updated
- [x] `providers/theme-provider.tsx` (manual light/dark, defaults light, persisted) + `use-color-scheme`
- [x] `lib/utils.ts` (`cn`), root `_layout.tsx` with font gate
- [x] `npx tsc --noEmit` clean · `npx expo-doctor` **20/20**
- [ ] ⚠️ **Not device-verified** — no emulator/device available this session. Bundle-verified only.

**Exit:** ✅ `src/app/index.tsx` is a temporary design-system check screen rendering the orange
primary, all four Bricolage weights, the surface tokens and a working light/dark toggle.
**Delete it in Phase 5** when the real Home screen lands.

---

## Phase 2 — UI primitives ⬜

- [ ] RNR: `button`, `card`, `input`, `text`, `badge`, `avatar`
- [ ] Ours: `skeleton`, `search-bar`, `sheet` (bottom sheet), `chip`
- [ ] Shared layout: `screen.tsx`, `container.tsx`, `app-header.tsx`
- [ ] `lib/utils.ts` (`cn`), `lib/format.ts` (date, duration, initials)
- [ ] `lucide-react-native` + `react-native-svg` working

**Exit:** a throwaway gallery screen shows every primitive in both themes.

---

## Phase 3 — Auth ⬜ *(needs Phase 0 §1 to sign in for real)*

- [ ] `lib/auth-client.ts`, `lib/session-cookie.ts`, `hooks/use-auth-deep-link.ts`
- [ ] `(auth)/sign-in.tsx` + `components/login/login-form.tsx` (RHF + Zod, 60s resend cooldown,
      "check your inbox" state, 15-minute TTL copy)
- [ ] Root `_layout.tsx`: providers, fonts, deep-link capture, `Stack.Protected` guard
- [ ] Branded booting screen (not a bare spinner)
- [ ] Dev build (`eas build --profile development`) — Expo Go can't do the deep link

**Exit:** email → tap link → app opens signed in. Session survives a restart. Sign-out returns to
sign-in.

---

## Phase 4 — Data layer ⬜

- [ ] `lib/api-client.ts` (`apiFetch` + `ApiError`; `Cookie` header, `credentials: "omit"`)
- [ ] `lib/query-client.ts`, `providers/query-provider.tsx`
- [ ] `lib/query-keys.ts`
- [ ] `types/recording.types.ts` (citing `ref/prm/src/app/actions/recordings.ts`)
- [ ] `api/recordings.api.ts`: `useRecordings`, `useRecording`, `useRecordingAudio`,
      `useRecordingStats`
- [ ] `api/auth.api.ts`: `useMe`
- [ ] `hooks/use-debounced-value.ts`

**Exit:** a temporary screen prints `totalCount` and the first five titles from the live API.

---

## Phase 5 — Shell + Home ⬜

Spec: [FEAT-01](../features/FEAT-01-RECORDINGS.md) §3–4.

- [ ] `(app)/_layout.tsx` — bottom tabs **Home** (`House`) · **Recordings** (`Library`);
      `settings` routable with `href: null`
- [ ] `(app)/recordings/_layout.tsx` — the nested stack
- [ ] `(app)/index.tsx` — thin route
- [ ] `components/dashboard/stat-card.tsx` — big number, label, optional trend
- [ ] Two-up stat row: **This week** (+ WoW trend) · **Needs contact**
- [ ] `library-breakdown-card.tsx` — four source rows + total/duration footer, each row navigates
      to the Recordings tab pre-filtered
- [ ] `recent-recordings.tsx` — 5 rows + **View all**
- [ ] Independent queries, per-block errors, one pull-to-refresh
- [ ] Empty state for "no recordings at all" (hide the stat cards, don't show a wall of zeroes)
- [ ] Settings reachable from the header gear

**Exit:** Home is the landing screen, numbers match the web, every tap goes somewhere real.

---

## Phase 6 — Recordings list ⬜

Spec: [FEAT-01](../features/FEAT-01-RECORDINGS.md) §5.

- [ ] `(app)/recordings/index.tsx` — thin route
- [ ] `components/recordings/recording-row.tsx` (tile, badges, summary clamp, meta, avatars,
      "New" rule) — with the `compact` variant Home reuses
- [ ] `source-badge`, `source-icon`, `category-badge`
- [ ] Search (debounced) + source chips with counts
- [ ] Accept the `source` route param handed over from Home
- [ ] Sort sheet (Date/Title × Newest/Oldest)
- [ ] Infinite scroll + pull-to-refresh
- [ ] Skeleton, empty, filtered-empty, error states

**Exit:** the list matches the web's content and behaviour, on device, both themes.

---

## Phase 7 — Recording detail ⬜

Spec: [FEAT-01](../features/FEAT-01-RECORDINGS.md) §6.

- [ ] `(app)/recordings/[source]/[id].tsx` — one route, four sources
- [ ] Header, People, Summary, Action items, Details (per source), Transcript
- [ ] Seed from the list cache so navigation feels instant
- [ ] Collapse/expand + copy transcript; OS share sheet
- [ ] 404 / 409 / error states
- [ ] Tab bar hidden on this screen

**Decision point:** do archive / assign-contact / change-category ship in v1? If yes, add
[BACKEND-CHANGES](BACKEND-CHANGES.md) §7 here.

**Exit:** all four sources render correctly, including ones with no audio and no transcript.

---

## Phase 8 — Audio ⬜

Spec: [FEAT-01](../features/FEAT-01-RECORDINGS.md) §7.

- [ ] `components/recordings/audio-player.tsx` on `expo-audio`
- [ ] Play/pause, scrubber, ±15s, speed (1× / 1.5× / 2×)
- [ ] URL cached below its expiry
- [ ] Plaud path working (per the Phase-0 decision)
- [ ] Error + "no audio" states
- [ ] **Decide** background audio (`UIBackgroundModes`) — it affects store review

**Exit:** a 40-minute call plays, scrubs and resumes on a real device on cellular data.

---

## Phase 9 — Settings & polish ⬜

- [ ] `(app)/settings.tsx` — account card, theme toggle, sign out, version
- [ ] Real icon + splash from the supplied logo
- [ ] Haptics on state-changing taps
- [ ] Accessibility pass ([03](../03-DESIGN-SYSTEM.md) §10)
- [ ] Offline banner (`expo-network` → `onlineManager`)
- [ ] Empty/error copy review
- [ ] `npx tsc --noEmit` and `npm run lint` clean

**Exit:** nothing in the app looks unfinished.

---

## Phase 10 — Release prep ⬜

- [ ] `eas.json`: `development` · `preview` (internal APK, baked `EXPO_PUBLIC_API_BASE_URL`) ·
      `production`
- [ ] Point `preview.env` at a **stable** backend, not a tunnel (this bit Ninja CRM Mobile)
- [ ] Full pass on a physical **iOS** device — not just Android
- [ ] Privacy: recordings contain call transcripts. Data-collection disclosures, and a decision
      on whether anything is cached to disk
- [ ] Store listing, review notes, and (if needed) a time-boxed reviewer-login path

---

## Cross-cutting definition of done

Every phase, before it's marked ✅:

1. Runs on a **physical device** — Android *and* iOS if the phase touches native behaviour.
2. `npx tsc --noEmit` and `npm run lint` are clean.
3. Loading, empty and error states exist for anything that fetches.
4. Light **and** dark checked.
5. A dated entry in [IMPLEMENTATION-LOG.md](../IMPLEMENTATION-LOG.md) saying what changed, what
   was decided, and **what is only typecheck-verified rather than device-verified**.
6. [HANDOVER.md](../../HANDOVER.md) status block rewritten.
