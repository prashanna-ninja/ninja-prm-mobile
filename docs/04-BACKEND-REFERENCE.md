# 04 — Backend Reference

Everything the app needs from `ref/prm`: the data models, the endpoints that **exist today**, and
the endpoints we **have to add**. The add-list is specified as an implementation task in
[implementation/BACKEND-CHANGES.md](implementation/BACKEND-CHANGES.md); this doc is the contract
the mobile types are written against.

**Base URL:** `EXPO_PUBLIC_API_BASE_URL` (must equal the server's `NEXT_PUBLIC_APP_URL`).
**Auth:** Better Auth session cookie, sent manually by `apiFetch` (see [05](05-AUTH-DEEPLINK.md)).
**Scoping:** every query is scoped to the signed-in user (`userId` / `ownerId`). There is no
org-sharing and **no RBAC to port**.

---

## 1. Data models (from `ref/prm/prisma/schema.prisma`)

### The four recording models

| | `CallRecording` | `PlaudRecording` | `GranolaMeeting` | `FieldyConversation` |
| --- | --- | --- | --- | --- |
| Title field | `title?` | `name?` | `title?` | `title?` |
| Timestamp | `occurredAt` | `startAt` | `startAt` | `startAt` |
| End time | — | — | `endAt?` | `endAt?` |
| Summary | `summary?` | `summary?` | `summaryText?` (+ `summaryMarkdown?`) | `summary?` |
| Transcript | `transcript?` | `transcript?` | `transcript?` | `content?` |
| Action items | `actionItems Json?` | `actionItems Json?` | `actionItems Json?` | `actionItems Json?` |
| Contacts | `contactId?` → **one** contact | `contacts[]` **many** | `contacts[]` **many** | `contacts[]` **many** |
| Category | `categoryId?` | `categoryId?` | `categoryId?` | `categoryId?` |
| Archived | `archived`, `archivedAt?` | same | same | same |
| Spam | `spam`, `spamAt?` | — | — | — |
| Duration | `durationSec?` | `durationMs?` | derive from `startAt`/`endAt` | derive |
| Audio | `s3Key`, `url`, `mimeType`, `filename`, `fileSizeBytes?` | `audioS3Key?` + Plaud proxy | **none** | **none** |
| Source-specific | `callNumber?`, `receiverNumber?`, `sentiment?`, `notes[]` | `keyTopics Json?`, `scene?`, `serialNumber?` | `attendees Json?`, `ownerName?`, `webUrl?`, `calendarEventTitle?` | `keywords`, `speakers`, `quotes`, `fieldyTasks`, `sharables`, `transcriptSegments`, `city`/`country` |

**Gotchas baked into the data:**

- `actionItems` is `Json?` and is only *sometimes* a `string[]`. The web defensively filters
  (`parseActionItems` in `call-recording-detail.tsx`) — **do the same**; never assume the shape.
- `CallRecording.contactId` is a single nullable FK; the other three are join tables. The unified
  shape flattens both into `contacts: Contact[]` (0 or 1 for calls).
- `spam` exists on calls only. The unified list filters `spam: false` for calls and ignores the
  concept elsewhere.

### Supporting models

```
RecordingCategory { id, userId, name, color (hex, default "#6366f1"), createdAt, updatedAt }
  → relations: contacts[], callRecordings[], plaudRecordings[], granolaMeetings[], fieldyConversations[]

Contact { id, name, email?, phone?, image?, relationshipType, companyId?, ownerId, archived, … }

CallRecordingNote { id, callRecordingId, filename, mimeType, s3Key, url, fileSizeBytes?, label?, createdAt }
```

Default category palette: `ref/prm/src/lib/recording-category-colors.ts`.

### The unified shape (the one the app actually consumes)

From `ref/prm/src/app/actions/recordings.ts`:

```ts
type UnifiedRecordingSource = "call" | "plaud" | "granola" | "fieldy";

type UnifiedRecordingItem = {
  id: string;
  source: UnifiedRecordingSource;
  title: string;               // already falls back: "Call recording" / "Plaud recording" / …
  occurredAt: Date;            // occurredAt | startAt, normalised
  summary: string | null;
  href: string;                // web route — mobile ignores this, we build our own
  contacts: { id: string; name: string; image: string | null }[];
  category: { id: string; name: string; color: string } | null;
};
```

**Title fallbacks the server already applies** (keep them server-side so mobile and web agree):
calls with no title become `Call <callNumber> → <receiverNumber>`, else `Call recording`;
others become `Plaud recording` / `Granola meeting` / `Fieldy conversation`.

---

## 2. Endpoints that exist today

| Method | Path | Returns | Notes |
| ------ | ---- | ------- | ----- |
| `*` | `/api/auth/**` | Better Auth | Already CORS/origin-patched for mobile (`app/api/auth/[...all]/route.ts`) |
| `GET` | `/api/v1/me` | `{ user: { id, name, email, image, role, timezone, showQuickCaptureFAB, digestEmailsEnabled } }` | 401 when signed out |
| `PATCH` | `/api/v1/me` | updated user | `{ name?, timezone?, … }` |
| `GET` | `/api/v1/call-recordings/:id/audio` | **`{ url, mimeType }`** | Presigned S3 URL, falls back to the stored `url`. ✅ Exactly what mobile needs. |
| `GET` | `/api/v1/plaud-recordings/:id/audio` | **raw audio bytes** | Proxied live from Plaud. `409` if Plaud isn't connected. ⚠️ Not a URL — see §4. |
| `GET` | `/api/v1/contacts?search&page&pageSize&sortBy&sortOrder&archived&tagIds` | contact list + tags + counts | For the contact picker, if we add assignment |
| `GET` | `/api/v1/contacts/:id` | contact detail | |
| `GET` | `/api/v1/contacts/:id/call-recordings` | that contact's calls | Not used in v1 |
| `GET` | `/api/v1/contacts/:id/plaud-recordings` | that contact's Plaud recordings | Not used in v1 |
| `GET` | `/api/v1/contacts/:id/granola-meetings` | that contact's meetings | Not used in v1 |
| `GET` | `/api/v1/dashboard` | contacts/tasks/interactions stats | ⚠️ Contains **no recording data** — checked. The Home screen needs a new stats endpoint (§3). |
| `GET` | `/api/v1/tasks`, `/api/v1/interactions`, … | — | Out of v1 scope |

**There is no REST endpoint that lists recordings.** The web list is a server component calling
the `getUnifiedRecordings()` server action directly. Server actions cannot be called from a
native app.

---

## 3. Endpoints we must add

Full specs and implementation notes in
[implementation/BACKEND-CHANGES.md](implementation/BACKEND-CHANGES.md). Contract summary:

### `GET /api/v1/recordings`

Mirrors `getUnifiedRecordings()` one-for-one so web and mobile can never drift.

Query: `page` (default 1) · `pageSize` (default 20) · `sortBy` `date|title` (default `date`) ·
`sortOrder` `asc|desc` (default `desc`) · `search` · `source` `all|call|plaud|granola|fieldy`
(default `all`).

```jsonc
{
  "items": [
    {
      "id": "clx…",
      "source": "call",
      "title": "Call +61400000000 → +61411111111",
      "occurredAt": "2026-09-12T03:21:00.000Z",   // ISO string, not a Date
      "summary": "Discussed the SMSF rollover…",
      "durationSec": 412,                          // ← added for mobile (nullable)
      "hasAudio": true,                            // ← added for mobile
      "hasTranscript": true,                       // ← added for mobile
      "isNew": true,                               // ← added: unarchived AND no contacts
      "contacts": [{ "id": "c1", "name": "Jane Doe", "image": null }],
      "category": { "id": "cat1", "name": "Clients", "color": "#6366f1" }
    }
  ],
  "totalCount": 137,
  "countsBySource": { "call": 90, "plaud": 21, "granola": 18, "fieldy": 8 },
  "page": 1,
  "pageSize": 20,
  "sortBy": "date",
  "sortOrder": "desc",
  "search": null,
  "source": "all"
}
```

> The four `← added` fields are the only additions to the web's shape. They exist because a phone
> list should say "12:04 · 6m 52s · has transcript" without four extra round-trips. Adding them to
> the server action's `select` is cheap; computing them client-side is not possible.
>
> `href` is **omitted** — it's a web route. Mobile builds `/recordings/[source]/[id]`.

### `GET /api/v1/recordings/:source/:id`

One detail endpoint, four shapes, discriminated on `source`. Common fields first, then a
`details` object carrying the source-specific extras:

```jsonc
{
  "id": "clx…",
  "source": "call",
  "title": "Call with Jane",
  "occurredAt": "2026-09-12T03:21:00.000Z",
  "endAt": null,
  "durationSec": 412,
  "summary": "…",
  "transcript": "…",                 // null when not transcribed
  "actionItems": ["Send the SOA", "Book a review"],   // always string[]; server sanitises
  "archived": false,
  "category": { "id": "cat1", "name": "Clients", "color": "#6366f1" },
  "contacts": [{ "id": "c1", "name": "Jane Doe", "image": null, "email": "…", "phone": "…" }],
  "hasAudio": true,
  "details": {
    // source === "call"
    "callNumber": "+61400000000",
    "receiverNumber": "+61411111111",
    "sentiment": "positive",
    "spam": false,
    "noteCount": 2
    // source === "plaud":    { "keyTopics": string[] }
    // source === "granola":  { "attendees": [{name,email}], "ownerName", "webUrl", "calendarEventTitle" }
    // source === "fieldy":   { "keywords": string[], "speakers": string[],
    //                          "quotes": [{text,context}], "fieldyTasks": [...], "sharables": [...] }
  }
}
```

404 when the row doesn't exist **or** belongs to another user (never leak existence).

### `GET /api/v1/recordings/:source/:id/audio`

Always returns **JSON with a playable URL**, for every source:

```jsonc
{ "url": "https://…signed…", "mimeType": "audio/mpeg", "expiresInSec": 3600 }
```

- `call` → presigned S3 URL (the existing route already does this).
- `plaud` → see §4; needs a signed proxy URL, not a cookie-protected stream.
- `granola` / `fieldy` → `404 { "error": "This recording has no audio" }`.

### `GET /api/v1/recordings/stats`

Powers the Home screen. Nothing like it exists today — `/api/v1/dashboard` and
`actions/dashboard.ts` contain **no** recording data at all.

```jsonc
{
  "total": 137,
  "bySource":   { "call": 90, "plaud": 21, "granola": 18, "fieldy": 8 },
  "thisWeek": 12,             // occurredAt >= start of this week, in the USER'S timezone
  "lastWeek": 9,              // the preceding 7-day window, for the trend arrow
  "unassigned": 7,            // unarchived AND zero linked contacts — the "New" count
  "totalDurationSec": 184320  // nullable-safe sum; null durations count as 0
}
```

- **Week boundaries use the user's timezone**, not UTC. `User.timezone` and the helpers in
  `ref/prm/src/lib/timezone.ts` already exist — use them, or "this week" is wrong for every
  Australian user before 10am.
- Excludes archived everywhere, and spam for calls — same predicate as the unified list, so the
  numbers agree with what the list actually shows.
- Eight `count()` calls plus one `aggregate` in a single `Promise.all`. Cheap; no new indexes.

### `GET /api/v1/recording-categories`

`[{ id, name, color, counts: { call, plaud, granola, fieldy, total } }]` — for the (optional)
category filter. Mirrors `getRecordingCategoriesWithStats()`.

### Nice-to-have, only if we add write actions in v1

| `POST` | `/api/v1/recordings/:source/:id/archive` and `/unarchive` |
| `PUT`  | `/api/v1/recordings/:source/:id/contacts` — body `{ contactIds: string[] }` |
| `PUT`  | `/api/v1/recordings/:source/:id/category` — body `{ categoryId: string \| null }` |

v1 as scoped is **read-only**. Decide before Phase 6 whether archive/assign ship in v1.

---

## 4. ⚠️ The audio problem (read before building the player)

`expo-audio` hands a URL to the **native** player (AVPlayer / ExoPlayer). That player does **not**
share our JS fetch stack, so it will **not** send the Better Auth cookie. Any audio URL we give it
must therefore be publicly playable for a short window.

| Source | Today | What the app does |
| ------ | ----- | ----------------- |
| `call` | `GET /api/v1/call-recordings/:id/audio` → `{ url }`, a **presigned S3 URL** | ✅ Fetch the JSON, hand `url` to `expo-audio`. Works as-is. |
| `plaud` | `GET /api/v1/plaud-recordings/:id/audio` **streams bytes behind the session cookie** | ❌ Native player gets 401. **Two options — pick one in Phase 0:** |
| `granola`, `fieldy` | no audio at all | Hide the player. Not an error state. |

**Option A (backend, preferred):** the new `/api/v1/recordings/plaud/:id/audio` returns a URL to a
short-lived **signed** proxy route (`?token=<hmac>&exp=<ts>`) that streams from Plaud without
needing the cookie. Same shape as calls, so the client has one code path. Cost: one small signed
route + HMAC helper (`ref/prm/src/lib/webhook-secret.ts` already has the pattern).

**Option B (client-only fallback):** `apiFetch` the bytes with the cookie, write them to
`expo-file-system` cache, play the local file. No backend change, but the whole file downloads
before playback starts, and we own cache eviction.

**Recommendation:** Option A. Build the client against the `{ url, mimeType }` contract either
way, so switching is a backend-only change.

---

## 5. Error contract

`apiFetch` maps every non-2xx into `ApiError { status, message }`, reading `{ error }` from the
body when present. The app's rules:

| Status | Meaning | App behaviour |
| ------ | ------- | ------------- |
| `401` | Session invalid/expired | Sign out → the guard routes back to sign-in |
| `403` | Not allowed | Show the message. **Never** sign out |
| `404` | Missing or not yours | "Recording not found" empty state, back to the list |
| `409` | Integration not connected (e.g. Plaud) | Inline notice: "Plaud isn't connected — connect it on the web app" |
| `429` | Rate-limited (magic-link send is capped at 3/60s) | "Too many requests, wait a moment" |
| `5xx` | Server | Generic error + Retry button |

---

## 6. Env the backend needs

| Var | Why |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` | Must be the real HTTPS URL and must equal `EXPO_PUBLIC_API_BASE_URL` |
| `BETTER_AUTH_SECRET` | Session signing |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Must include `ninjaprm://` (comma-separated list, already read by `src/auth.ts`) |
| `RESEND_API_KEY` + verified sender | Or no magic-link email sends |
| `AWS_*` / S3 config | Presigned call-recording audio |
| `RECORDING_AUDIO_SIGNING_SECRET` | **New**, only if we take Option A in §4 |
