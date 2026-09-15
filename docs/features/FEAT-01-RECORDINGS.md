# FEAT-01 — Recordings

**Status:** 📄 Specified, not built
**Owner doc for:** the whole of v1
**Web reference:** `ref/prm/src/app/(user)/dashboard/recordings/page.tsx` ·
`ref/prm/src/components/recordings/recordings-page-client.tsx` ·
`ref/prm/src/components/{call-recordings,plaud,granola,fieldy}/*-detail.tsx`
**Dashboard pattern reference:** `ref/ninja-crm-mobile/src/app/(app)/index.tsx` +
`src/components/dashboard/*`

---

## 1. What it is

The PRM mirrors conversations from four sources into one feed, each with an AI summary, action
items and (sometimes) a transcript and audio. On the web this is **All Recordings**
(`/dashboard/recordings`). On the phone it is the **whole app**.

| Source | Icon | Audio | Transcript | Contacts | Extras |
| ------ | ---- | ----- | ---------- | -------- | ------ |
| `call` | `Phone` | ✅ S3 | usually | 0 or 1 | caller/receiver numbers, sentiment, spam flag, scanned notes |
| `plaud` | `AudioLines` | ✅ via Plaud | usually | many | key topics |
| `granola` | `NotebookPen` | ❌ | usually | many | attendees, calendar event, web URL |
| `fieldy` | `Mic` | ❌ | usually | many | keywords, speakers, quotes, Fieldy tasks, share links |

---

## 2. Scope

### In (v1)

- **Home** screen: recording stats + recent recordings + "View all".
- **Recordings** screen: the unified list — search, source filter, sort, infinite scroll,
  pull-to-refresh.
- **Recording detail** for all four sources: header, summary, action items, contacts, transcript,
  source-specific extras.
- **Audio playback** for `call` and `plaud`.
- **Copy** / **share** the transcript via the OS share sheet.
- Sign-in, sign-out, theme toggle (the minimum shell around the feature).

### Out (v1) — say no clearly

- Creating, uploading or deleting recordings.
- Archiving / marking spam / assigning contacts / changing category. *(Read-only v1. If any of
  these should ship, decide before Phase 6 — the endpoints are drafted in
  [BACKEND-CHANGES](../implementation/BACKEND-CHANGES.md) §7.)*
- Generating tasks from action items (`generateAllRecordingTasks` on web).
- Emailing a transcript to someone (`share-transcript-dialog` on web) — v1 shares via the OS
  sheet instead, which is the phone-native equivalent and needs no backend.
- Category management, spam-number management, call-recording notes (viewing or uploading).
- The archived and spam list views.
- Everything else in the PRM: contacts, tasks, calendar, opportunities, organizations,
  interactions, integrations, tags.

---

## 3. Navigation

**Two bottom tabs: Home and Recordings.**

```
(auth)/sign-in                      magic-link screen

(app)/index                     ← TAB 1  "Home"        stats + recent recordings
(app)/recordings/index          ← TAB 2  "Recordings"  the full list
(app)/recordings/[source]/[id]           Recording detail   (pushed, tab bar hidden)
(app)/settings                           account, theme, sign out   (NOT a tab)
```

- **Settings is not a tab.** It's a gear icon in the Home header's right slot
  (`<AppHeader right={…}/>`), pushed as a normal screen. Two tabs for two things you actually
  switch between; settings is a destination you visit occasionally.
  In `(app)/_layout.tsx` the settings route gets `href: null` so it's routable but not in the bar.
- **Recordings is a stack** (`recordings/_layout.tsx`): `index` → `[source]/[id]`. Detail hides
  the tab bar (`useFocusEffect` → `getParent().setOptions`) — it's a reading surface.
- **"View all" on Home** switches to the Recordings tab, it doesn't push a second copy of the
  list: `router.push("/recordings")`.
- **Back from detail always returns to the list** — header back arrow *and* Android hardware back
  `router.replace("/recordings")`, so opening a recording from Home doesn't leave a detail screen
  parked inside the Recordings tab. (Exact bug the CRM app hit; see its HANDOVER §1.)

One route handles all four sources (`[source]/[id]`), branching on `source` for the extras. Four
near-identical route files would be four places to fix every bug.

Dynamic navigation uses the object form, required by typed routes:

```ts
router.push({ pathname: "/recordings/[source]/[id]", params: { source: item.source, id: item.id } });
```

### Tab bar

| Tab | Icon (lucide) | Route |
| --- | ------------- | ----- |
| Home | `House` | `(app)/index` |
| Recordings | `Library` | `(app)/recordings/index` |

Active tint = `primary` (`#ff8900`), inactive = `muted-foreground`. Labels shown.

---

## 4. Screen: Home

The "what's going on" screen. It answers three questions in one glance: *how much have I got*,
*what needs my attention*, *what just came in*.

```
┌──────────────────────────────────────────┐
│ Home                                [⚙]  │  AppHeader, gear → /settings
│ Good afternoon, Alex                     │  subtitle: greeting + first name from /api/v1/me
│                                          │
│ ┌── This week ──────┐┌── Needs contact ─┐│  two-up stat cards
│ │  12               ││  7               ││  big display numbers
│ │  ▲ 33% vs last wk ││  unassigned      ││  trend in green/red; 0 → muted "All assigned"
│ └───────────────────┘└──────────────────┘│
│                                          │
│ ┌── Library ───────────────────────────┐ │  one card, four rows — the source breakdown
│ │ ▢ Calls              90            › │ │  tap a row → Recordings tab, filtered to it
│ │ ▢ Plaud              21            › │ │
│ │ ▢ Granola            18            › │ │
│ │ ▢ Fieldy              8            › │ │
│ │ ──────────────────────────────────── │ │
│ │   137 recordings · 51h 12m captured  │ │  footer line
│ └──────────────────────────────────────┘ │
│                                          │
│ RECENT                        View all › │  → Recordings tab
│ ┌──────────────────────────────────────┐ │
│ │ ▢  Call with Jane Doe                │ │  the same <RecordingRow> as the list —
│ │    ⟨Call⟩ · 12 Sep, 1:21 pm · 6m 52s │ │  one component, compact variant
│ └──────────────────────────────────────┘ │
│ … 5 rows total                           │
└──────────────────────────────────────────┘
```

### Stats, and why these ones

| Stat | Source | Why it's here |
| ---- | ------ | ------------- |
| **This week** + WoW trend | `stats.thisWeek` / `stats.lastWeek` | "Am I capturing more or less than usual." Same card the CRM app leads with, so the two apps feel related. |
| **Needs contact** | `stats.unassigned` | The only *actionable* number — a recording with no contact linked is the web's "New" state. Tapping it opens the Recordings tab; when we add write actions this becomes a proper work queue. |
| **Source breakdown** | `stats.bySource` | Four numbers that are genuinely informative (is Granola even syncing?) and double as filter shortcuts. |
| **Total + captured duration** | `stats.total`, `stats.totalDurationSec` | The footer line. "51h 12m captured" is the one number people quote about a tool like this. |

Deliberately **not** on this screen: charts. A sparkline over four weeks was considered and cut —
it needs a time-series endpoint, and on a 390px screen it says less than the trend arrow does.

### Behaviour

| Interaction | Result |
| ----------- | ------ |
| Pull down | Refetches stats **and** the recent list together |
| Tap a stat card | "This week" → Recordings tab. "Needs contact" → Recordings tab *(a `needsContact` filter is a later addition; v1 just navigates)* |
| Tap a source row | Recordings tab with that source chip pre-selected |
| Tap **View all** | Recordings tab, unfiltered |
| Tap a recent row | Recording detail |
| Tap ⚙ | Settings |

Cross-tab filter hand-off uses a route param the list reads once on mount:
`router.push({ pathname: "/recordings", params: { source: "plaud" } })`.

### States

| State | UI |
| ----- | -- |
| Loading | Skeletons matching each block's geometry — two stat cards, four library rows, three recent rows |
| Partial failure | The blocks are **independent queries**. If stats fail, recent recordings still render (and vice versa), each with its own inline retry. Never blank the whole screen for one failed call. |
| Empty (no recordings at all) | One centred card: `Library` icon, "No recordings yet", "Calls, Plaud, Granola and Fieldy recordings will appear here once they sync." Hide the stat cards entirely — a wall of zeroes is a worse first impression than one honest empty state. |
| Error (both failed) | Message + Retry |

---

## 5. Screen: Recordings list

```
┌──────────────────────────────────────────┐
│ Recordings                               │  AppHeader (display 30px)
│ 137 recordings                           │  subtitle: totalCount from the API
│                                          │
│ ┌─ 🔍 Search all recordings ────── ✕ ─┐  │  debounced 300ms
│ └──────────────────────────────────────┘  │
│ ( All 137 )( Calls 90 )( Plaud 21 )…  →  │  horizontal scroll chips, counts from
│                                          │  countsBySource. Active chip = orange fill.
│                              [↕ Sort]    │  opens a bottom sheet
├──────────────────────────────────────────┤
│▎┌──────────────────────────────────────┐ │  ▎= red left rule when isNew
│ │ ▢  Call with Jane Doe                │ │  ▢ = 40×40 primary-soft tile + source icon
│ │    ⟨Call⟩ ⟨● Clients⟩ ⟨New⟩          │ │  outline badges
│ │    Discussed the SMSF rollover and…  │ │  summary, 2 lines
│ │    12 Sep 2026, 1:21 pm · 6m 52s  ⓐⓣ│ │  meta + audio/transcript affordance
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │ ▢  Weekly sync            (JD)(AM)+2 │ │  contact avatars, right-aligned, max 3
│ …                                        │
└──────────────────────────────────────────┘
```

### Behaviour

| Interaction | Result |
| ----------- | ------ |
| Arrive with a `source` param from Home | That chip starts selected |
| Type in search | 300ms debounce → new query key → server-side search across title, summary, transcript and (for calls) phone numbers |
| Clear (✕) | Resets search, refetches page 1 |
| Tap a source chip | Filters; `page` resets to 1; counts stay visible so the user can see what they're excluding |
| Tap **Sort** | Bottom sheet: **Date / Title**, **Newest first / Oldest first** (exactly the web's options) |
| Tap a card | Push detail |
| Pull down | `refetch()` |
| Scroll to end | `fetchNextPage()` — footer spinner, or "That's everything" at the end |
| Long-press a card | *(v1: nothing. Reserved for archive/assign if they ship.)* |

### States

| State | UI |
| ----- | -- |
| Loading (first) | 6 skeleton cards, same geometry as the real card |
| Loading (filter change) | Keep previous data (`keepPreviousData`), dim slightly — no skeleton flash |
| Empty, no filters | `Library` icon, **"No recordings yet"**, "Calls, Plaud, Granola and Fieldy recordings will all appear here." |
| Empty, filtered | **"No recordings match your filters"** + a **Clear filters** button |
| Error | Message from `ApiError` + **Retry** |
| Offline | Banner above the list; cached pages still render |

### Details that matter

- **"New"** = unarchived **and** zero linked contacts (the web's rule). Red left rule + red
  outline badge. It is the one legitimate use of red for a non-error.
- **Duration** shows as `6m 52s` / `1h 04m`, omitted when null. Formatter in `lib/format.ts`.
- **Audio / transcript affordance:** small muted `Volume2` and `FileText` icons in the meta row so
  a user can see at a glance what a recording actually contains. (Mobile addition — on a phone
  "can I listen to this on the train?" is the main question.)
- Date format `d MMM yyyy, h:mm a` via `date-fns`.
- `FlatList` with `keyExtractor={(i) => \`${i.source}-${i.id}\`}` — ids are only unique per table.
- **`<RecordingRow>` is shared with Home.** One component, a `compact` prop for the Home variant
  (no summary, no avatars). Two copies would drift within a week.

---

## 6. Screen: Recording detail

```
┌──────────────────────────────────────────┐
│ ‹  Call recording                   [⋯]  │  back → list; ⋯ → share/copy
├──────────────────────────────────────────┤
│ ▢  Call with Jane Doe                    │  source tile + title (display, 2-line max)
│    12 September 2026, 1:21 pm            │
│    ⟨Call⟩ ⟨positive⟩ ⟨● Clients⟩         │  source · sentiment · category
│                                          │
│ ┌── ▶  ──●───────────── 2:14 / 6:52 ──┐  │  audio player (call/plaud only)
│ └──────────────────────────────────────┘  │
│                                          │
│ PEOPLE                                   │
│ (JD) Jane Doe · jane@acme.com        ›   │  tap = nothing in v1 (no contact screen)
│                                          │
│ SUMMARY                                  │
│ Discussed the SMSF rollover…             │
│                                          │
│ ACTION ITEMS                             │
│ •  Send the SOA by Friday                │
│ •  Book the annual review                │
│                                          │
│ DETAILS                                  │  source-specific block — see below
│ Call number      +61 400 000 000         │
│ Receiver         +61 411 111 111         │
│                                          │
│ TRANSCRIPT                          [⧉]  │  ⧉ = copy
│ Jane: …                                  │  selectable, collapsed to ~12 lines
│                          Show all ▾      │  with Show all / Show less
└──────────────────────────────────────────┘
```

### Sections, in order

1. **Header** — source tile, title, absolute date/time, badges (source · sentiment · archived ·
   spam · category). Titles come pre-fallen-back from the server.
2. **Audio** — `call` and `plaud` only. Omit the section entirely otherwise; an empty player is
   worse than no player.
3. **People** — avatar + name + email. Calls have 0–1, others 0–many. Empty → "No contacts linked".
4. **Summary** — plain text. Empty → "No summary yet".
   *(Granola also stores `summaryMarkdown`; v1 renders the plain `summaryText`. Markdown rendering
   is a later nicety, not a v1 requirement.)*
5. **Action items** — bulleted list with an orange dot. Empty → "None identified" (the web's
   wording). **Always parse defensively** — `actionItems` is `Json?` and is not guaranteed to be
   `string[]`.
6. **Details** — the source-specific block:

   | Source | Rows |
   | ------ | ---- |
   | `call` | Call number (+ "Your line / SIM"), Receiver number (+ "The other party"), file name, note count |
   | `plaud` | Key topics (chips) |
   | `granola` | Attendees (name + email list), organiser, calendar event title, "Open in Granola" link |
   | `fieldy` | Keywords (chips), speakers, notable quotes, Fieldy tasks, share links |

7. **Transcript** — long-form text, `selectable`, collapsed to ~12 lines with **Show all**. Copy
   button in the section header. Absent → hide the section.

### States

| State | UI |
| ----- | -- |
| Loading | Seed from the list cache (title, date, summary, contacts render instantly), skeleton the rest |
| 404 | "Recording not found" + Back to recordings |
| 409 (Plaud disconnected) | Audio section shows "Plaud isn't connected — connect it in the web app"; the rest of the page still renders |
| Error | Message + Retry |

### The `⋯` menu (v1)

- **Copy transcript** (`expo-clipboard`) — disabled when there's no transcript.
- **Share** — OS share sheet with `<title>\n<date>\n\n<summary>\n\n<transcript>`.
- *(Archive / Assign contact / Change category appear here if they make v1.)*

---

## 7. Audio player

A small custom component (`components/recordings/audio-player.tsx`) on `expo-audio`. Not the
system player — we want it to look like the rest of the app.

**Controls:** play/pause · scrubber with elapsed + total · ±15s skip · speed cycle (1× / 1.5× / 2×).
Speed matters: these are 40-minute meetings.

**Flow:** `useRecordingAudio(source, id)` → `{ url, mimeType, expiresInSec }` → hand `url` to
`expo-audio`. Cache the URL *below* its expiry (see [06](../06-DATA-LAYER.md) §4).

**⚠️ The native player does not send our session cookie.** The URL must be publicly playable for
a short window. That's fine for `call` (presigned S3) and is the reason the Plaud endpoint needs
changing. See [04-BACKEND-REFERENCE](../04-BACKEND-REFERENCE.md) §4.

**Background audio** — a user will lock their phone while listening. Needs
`ios.infoPlist.UIBackgroundModes: ["audio"]` and the Android foreground-service config, plus
`expo-audio`'s `staysActiveInBackground`. Small config change, big usability difference.
**Decide in Phase 7** — it adds an App Store review question, so it's a deliberate choice.

**Errors:** a failed load shows "Audio unavailable" with Retry inside the player, and never takes
the page down.

---

## 8. Data

| Need | Endpoint | Hook | Key |
| ---- | -------- | ---- | --- |
| Home stats | `GET /api/v1/recordings/stats` | `useRecordingStats()` | `qk.recordings.stats()` |
| Home recent | `GET /api/v1/recordings?pageSize=5` | `useRecordings({ pageSize: 5 })` | `qk.recordings.list(params)` |
| List | `GET /api/v1/recordings` | `useRecordings(params)` | `qk.recordings.list(params)` |
| Detail | `GET /api/v1/recordings/:source/:id` | `useRecording(source, id)` | `qk.recordings.detail(...)` |
| Audio | `GET /api/v1/recordings/:source/:id/audio` | `useRecordingAudio(source, id)` | `qk.recordings.audio(...)` |
| Greeting name | `GET /api/v1/me` | `useMe()` | `qk.me()` |
| Categories (optional filter) | `GET /api/v1/recording-categories` | `useRecordingCategories()` | `qk.recordingCategories()` |

⚠️ **None of these recording endpoints exist yet.** See
[BACKEND-CHANGES](../implementation/BACKEND-CHANGES.md).

Types live in `src/types/recording.types.ts` and must carry a comment citing
`ref/prm/src/app/actions/recordings.ts` as their source of truth.

---

## 9. Done criteria

Ship when all of these are true **on a real device, both platforms**:

- [ ] Sign in by tapping the link in the email; app opens signed in; session survives a restart.
- [ ] Home shows correct stats, a correct trend, and the 5 most recent recordings.
- [ ] Home's source rows and **View all** land on the Recordings tab with the right filter.
- [ ] Home degrades gracefully when one of its two queries fails.
- [ ] List loads, searches, filters by source, sorts, paginates, pulls to refresh.
- [ ] All four states render correctly on the list (loading / empty / filtered-empty / error).
- [ ] Every source opens a correct detail screen, including sources with no audio.
- [ ] Call audio plays, scrubs, and survives backgrounding the app (or degrades cleanly if we
      decide against background audio).
- [ ] Plaud audio plays (once the backend decision in §4 of doc 04 is implemented).
- [ ] Copy + share transcript work.
- [ ] Dark mode is correct on every screen.
- [ ] No crash on a recording with null title, null summary, null transcript, weird
      `actionItems` JSON, or zero contacts.
- [ ] Sign out returns to the sign-in screen and clears the cache.

## 10. Later (explicitly not now)

Roughly in value order, for whoever picks this up next:

1. Write actions: archive, assign contact, change category — which turns Home's "Needs contact"
   card into a real work queue.
2. A `needsContact=true` filter on the list, so that card can deep-link into exactly those.
3. Per-contact recordings (the endpoints already exist) → a lightweight contact screen.
4. Generate tasks from action items.
5. Push notification when a new recording lands, deep-linking straight to it.
6. Offline transcripts (needs encryption — see [06](../06-DATA-LAYER.md) §6).
7. Markdown rendering for Granola summaries.
8. A recordings-per-week sparkline on Home (needs a time-series endpoint).
9. Recording a call/voice memo *from* the phone and pushing it in via the existing
   `POST /api/webhooks/call-recordings/upload-url` flow. This is the biggest possible win and
   the biggest piece of work — a separate feature doc when it comes up.
