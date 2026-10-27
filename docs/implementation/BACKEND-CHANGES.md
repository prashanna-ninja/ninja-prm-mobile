# Backend Changes Required (PRM web app)

Everything the **`ref/prm` Next.js repo** needs before the mobile app can do anything. This is
**Phase 0** of [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md).

> ⚠️ **Blocking question, needs an answer before Phase 0:** can we edit and redeploy the PRM web
> app? If it's frozen, the recordings feature **cannot be built** — there is no REST endpoint that
> lists recordings, and server actions can't be called from a native app. There is no client-side
> workaround.

Every change below is **additive**. The one exception is the plugin-order fix in §1, which touches
the shared auth config and must be re-tested on web.

---

## 1. Auth: make native clients first-class

**Why:** `ref/prm/src/auth.ts` has no `@better-auth/expo` plugin, so the server never emits the
`ninjaprm://?cookie=…` redirect a native magic-link sign-in depends on. Detail in
[../05-AUTH-DEEPLINK.md](../05-AUTH-DEEPLINK.md).

```bash
pnpm add @better-auth/expo
```

```diff
  // src/auth.ts
+ import { expo } from "@better-auth/expo";

    plugins: [
-     nextCookies(),
+     expo(),          // native clients + deep-link callbacks
      admin({ … }),
      magicLink({ … }),
+     nextCookies(),   // must be LAST
    ],
```

```bash
# server env
BETTER_AUTH_TRUSTED_ORIGINS=ninjaprm://
```

`trustedOrigins` already splits that env var, so **no code change is needed to trust the scheme** —
only the `expo()` plugin is code.

- [ ] `pnpm add @better-auth/expo`
- [ ] Add `expo()`, move `nextCookies()` last
- [ ] Set `BETTER_AUTH_TRUSTED_ORIGINS=ninjaprm://` on every environment we test against
- [ ] Confirm `RESEND_API_KEY` + a verified sender are live
- [ ] **Re-test web sign-in** (the plugin reorder touches it)

---

## 2. `GET /api/v1/recordings` — the unified list

**Why:** the entire feature. `getUnifiedRecordings()` is a server action; native can't call it.

`src/app/api/v1/recordings/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { getUnifiedRecordings } from "@/app/actions/recordings";
import { parseUnifiedRecordingsSearchParams } from "@/lib/recordings-search-params";

export async function GET(request: NextRequest) {
  const authResult = await requireApiAuth();
  if (authResult instanceof NextResponse) return authResult;

  const sp = request.nextUrl.searchParams;
  const parsed = parseUnifiedRecordingsSearchParams(Object.fromEntries(sp));
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") ?? 20)));

  const result = await getUnifiedRecordings({ ...parsed, pageSize });

  return NextResponse.json({
    ...result,
    items: result.items.map(({ href, ...item }) => ({
      ...item,
      occurredAt: item.occurredAt.toISOString(),   // Dates don't survive JSON
    })),
  });
}
```

**Reuse `getUnifiedRecordings` and `parseUnifiedRecordingsSearchParams` — do not reimplement the
merge.** Web and mobile must stay in lockstep; two copies of that logic will drift within a month.

### Four fields to add to the shared shape

Add these to `UnifiedRecordingItem` in `src/app/actions/recordings.ts` (the web list can ignore
them; the phone list needs them to avoid N round-trips):

| Field | How |
| ----- | --- |
| `durationSec: number \| null` | call: `durationSec`; plaud: `Math.round(durationMs/1000)`; granola/fieldy: from `startAt`/`endAt`, else null. Add the columns to each `select`. |
| `hasAudio: boolean` | `source === "call"` → true; `"plaud"` → true; else false |
| `hasTranscript: boolean` | `transcript != null` (fieldy: `content != null`). Select a boolean, **not** the transcript text — these are huge |
| `isNew: boolean` | `contacts.length === 0` (the unified list is already unarchived-only) |

⚠️ **Do not select `transcript` in the list query.** Transcripts are tens of KB each; twenty of
them is a multi-megabyte response over mobile data.

- [ ] Route created
- [ ] Four fields added to `UnifiedRecordingItem` + each `select`
- [ ] `href` stripped, dates ISO-serialised
- [ ] `pageSize` clamped (default 20, max 50)
- [ ] Verified: auth required, `search`, `source`, `sortBy`, `sortOrder`, `page` all work

---

## 3. `GET /api/v1/recordings/[source]/[id]` — detail

`src/app/api/v1/recordings/[source]/[id]/route.ts`. One handler, a switch on `source`, reusing
the existing per-source reads (`getCallRecording` and the equivalents in `actions/plaud.ts`,
`actions/granola.ts`, `actions/fieldy.ts`). Response shape:
[../04-BACKEND-REFERENCE.md](../04-BACKEND-REFERENCE.md) §3.

Non-negotiables:

- **Validate `source`** against `["call","plaud","granola","fieldy"]`; anything else → 400.
- **Scope every query by `userId`** and return **404** when the row isn't the caller's — never 403,
  which confirms the row exists.
- **Sanitise `actionItems` server-side** into a real `string[]`. It's `Json?` and callers keep
  having to defend against it; do it once, here.
- Put source-specific fields under `details`, so the client has one stable envelope.

- [ ] Route created, all four sources
- [ ] Invalid source → 400; someone else's id → 404
- [ ] `actionItems` always a `string[]`
- [ ] `contacts` normalised (calls: 0–1 from `contactId`; others: from the join table)

---

## 4. `GET /api/v1/recordings/[source]/[id]/audio`

Always `{ url, mimeType, expiresInSec }`. **The native player cannot send our session cookie**
([04](../04-BACKEND-REFERENCE.md) §4), so the URL must be independently playable for a window.

| Source | Work |
| ------ | ---- |
| `call` | None — wrap the existing `/api/v1/call-recordings/[id]/audio` (already a presigned S3 URL). Add `expiresInSec` from the presign TTL. |
| `plaud` | **Real work.** Today's route streams bytes behind the cookie. Return a URL to a short-lived signed proxy instead: `/api/v1/recordings/plaud/:id/audio/stream?exp=<ts>&sig=<hmac>`, verified without a session. The HMAC pattern already exists in `src/lib/webhook-secret.ts`. |
| `granola`, `fieldy` | `404 { "error": "This recording has no audio" }` |

**Alternative if the signed proxy is too much for now:** leave Plaud as-is and have the app
download the bytes through `apiFetch` into `expo-file-system`, then play the local file. Slower
(full download before playback) and the app owns cache eviction, but zero backend work. Either
way the **client contract stays `{ url, mimeType }`**, so this can change later without touching
the app.

- [ ] Route created
- [ ] `call` returns a presigned URL + TTL
- [ ] Plaud decision made and recorded in the log
- [ ] `granola`/`fieldy` return a clean 404 with that message
- [ ] Signed URL (if built) can't be replayed after `exp` and can't be forged

---

## 5. `GET /api/v1/recordings/stats` — the Home screen

**Why:** the app's Home tab is a stats + recent-activity dashboard. `/api/v1/dashboard` and
`actions/dashboard.ts` contain **no recording data whatsoever** (checked), so this is all new.

Shape: [../04-BACKEND-REFERENCE.md](../04-BACKEND-REFERENCE.md) §3.

`src/app/api/v1/recordings/stats/route.ts` — eight `count()`s plus one duration aggregate in a
single `Promise.all`:

```ts
const [callTotal, plaudTotal, granolaTotal, fieldyTotal,
       thisWeek, lastWeek, unassigned, durationAgg] = await Promise.all([ … ]);
```

Non-negotiables:

- **Use the same predicate as the unified list** (`archived: false`, plus `spam: false` for
  calls). If the stats and the list disagree, users notice immediately and stop trusting both.
- **Week boundaries in the user's timezone.** `User.timezone` and `src/lib/timezone.ts` already
  exist. Using UTC makes "this week" wrong for every Australian user before ~10am.
- `lastWeek` is the preceding 7-day window (for the trend arrow), not "the whole of last month".
- `unassigned` = unarchived **and** zero linked contacts — the same rule the web calls "New"
  (`components/recordings/new-recording-indicator.tsx`).
- `totalDurationSec`: calls sum `durationSec`; Plaud sums `durationMs / 1000`; Granola and Fieldy
  derive from `endAt - startAt` where both exist. Nulls count as 0, never as `NaN`.

- [ ] Route created
- [ ] Predicate matches `getUnifiedRecordings`
- [ ] Week windows computed in the user's timezone
- [ ] `totalDurationSec` is null-safe
- [ ] Verified: numbers add up against the same filters in the web UI

---

## 6. `GET /api/v1/recording-categories`

Thin wrapper over `getRecordingCategoriesWithStats()` → `[{ id, name, color, counts }]`.
Only needed if we ship the category filter; cheap enough to do alongside §2.

- [ ] Route created (or explicitly deferred)

---

## 7. Write endpoints

> **Status 2026-09-29: still none of these exist, and that is now a live blocker.**
>
> Verified by listing every non-GET handler under `src/app/api/v1` — all 54. Every `recordings`
> route is GET-only except `share` (POST), and `PATCH /contacts/[id]` has no recording field.
> So **the phone cannot assign a recording to a contact**, even though it now has both a
> Recordings list and a Contacts tab. The web does it through a server action, which native
> can't call.
>
> The `PUT .../contacts` row below is the one that matters. Paste-ready prompt:
> [../prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md](../prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md).

The original "v1 is read-only" decision is what deferred these. That held while v1 was
Recordings-only; it stopped holding when Contacts shipped on 2026-09-28.

| Method | Path | Wraps |
| ------ | ---- | ----- |
| `POST` | `/api/v1/recordings/:source/:id/archive` · `/unarchive` | `archiveCallRecording` and the per-source equivalents |
| `PUT` | `/api/v1/recordings/:source/:id/contacts` | `assignCallRecordingContact` / `setPlaudRecordingContacts` / `setGranolaMeetingContacts` / `setFieldyConversationContacts` |
| `PUT` | `/api/v1/recordings/:source/:id/category` | `setRecordingCategory` |

⚠️ **The four actions do not share a shape**, which is the real work in wrapping them:
`assignCallRecordingContact` takes ONE `contactId: string | null` and **throws** on failure (and
also resolves `categoryId`); the other three take `contactIds: string[]` and **return**
`{ success, error? }`. Pick one request body for all four and adapt inside the route, so the
client doesn't have to branch per source.

Note those actions call `revalidatePath(...)` for the web. That's harmless from an API route, but
it means a mobile write correctly busts the web cache too. Good — keep it.

---

## 8. Known performance caveat (log it, don't fix it blindly)

`getUnifiedRecordings` fetches up to `MAX_FETCH = 500` rows **per source**, merges them in memory,
sorts, and slices the requested page. Consequences:

- Deep pagination gets slower and **silently truncates past ~500 per source**.
- `sortBy: "title"` sorts only the fetched window, so it is not a true global title sort.

Fine for v1 (a phone user scrolls a few pages). If infinite scroll becomes a core habit, this
wants a proper cursor over a `UNION ALL` view. **Flag it; don't rewrite it as part of Phase 0.**

---

## 9. Testing before the app exists

You can validate the whole backend surface with `curl` and a browser session cookie:

```bash
# grab the cookie from a signed-in browser session, then:
curl -s "$BASE/api/v1/recordings?pageSize=5&source=call" -H "Cookie: $COOKIE" | jq
curl -s "$BASE/api/v1/recordings/stats"                   -H "Cookie: $COOKIE" | jq
curl -s "$BASE/api/v1/recordings/call/$ID"                -H "Cookie: $COOKIE" | jq
curl -s "$BASE/api/v1/recordings/call/$ID/audio"          -H "Cookie: $COOKIE" | jq
curl -s "$BASE/api/v1/recordings/granola/$ID/audio"       -H "Cookie: $COOKIE" -o /dev/null -w '%{http_code}\n'   # expect 404
curl -s "$BASE/api/v1/recordings/call/$ID"                                     -w '\n%{http_code}\n'             # expect 401
```

Do this **before** starting Phase 1. Debugging a new API through a new app on a physical device
is the slowest possible way to find a typo.

---

## 10. 🚨 `PATCH /api/v1/tasks/[id]` can lose a task's contact links

> **Status 2026-09-29: unfixed. Not reachable from the app** — but reachable from any other
> client, so it still wants fixing. Paste-ready prompt:
> [../prompts/BACKEND-TASK-PATCH-FIX.md](../prompts/BACKEND-TASK-PATCH-FIX.md).

In `src/app/api/v1/tasks/[id]/route.ts`, when the body has `contactIds`:

1. `prisma.taskContact.deleteMany({ where: { taskId } })` runs **first** (line ~138);
2. `dueAt` is only parsed afterwards, inside the `updateData` builder, which **throws**
   "Invalid due date provided" on a bad value (line ~163);
3. nothing is wrapped in a transaction, and the catch returns a 500.

So `PATCH { contactIds: [...], dueAt: "not-a-date" }` deletes every link and then fails —
the task keeps its old title/date but has **no contacts**, and the client is told the save
failed. The same happens if `task.update` itself throws for any other reason.

**Fix:** validate the whole body up front (including `dueAt` → 400, not 500), then run the
`deleteMany` and `task.update` inside one `prisma.$transaction`.

**Why the app is safe today:** it only ever sends a `dueAt` it built itself
(`dueAtForDay` in `src/lib/tasks.ts`), and only sends `contactIds` when the set actually
changed (`toUpdateTaskInput`). The status tick sends `{ status }` alone.

---

## 11. Messages (CrazyTel SMS) — no REST surface

> **Status 2026-10-18: not started; prompt written, awaiting confirmation.**
> [../prompts/BACKEND-SMS-API.md](../prompts/BACKEND-SMS-API.md).

The web's Messages page (`/dashboard/messages`) is entirely server actions
(`actions/sms.ts`, `actions/contact-comms.ts`); there is no `/api/v1/sms*` route. Ten thin
wrappers are needed (setup, threads list with filter/paging, thread messages, mark read, send,
start thread, link to contact, check, sync, and a contact's texts). CrazyTel setup
(`actions/crazytel.ts`) stays web-only and needs nothing.

⚠️ `../ninja_prm` is behind `ref/prm` and doesn't contain the SMS module yet — pull before running.

**Update 2026-10-18:** all 10 routes written in `../ninja_prm` on `feat/sms-api` (uncommitted,
typechecks). Reviewed against the contract — matches, with three differences the app now follows:
a failed send stores nothing (502); `thread` can be `null`; `unreadTotal` counts threads.

**Open — performance:** `GET /sms/threads/:id/messages` calls `getSmsThreads()` (the whole inbox)
on every request just to return one row as `thread`. The app polls that route, so the app now
rations it (focused only, 15s live / 60s quiet — FEAT-04 §2), which cuts the load but not the
per-request cost. **Proper fix:** build that one thread's row with a query scoped to its own
conversations instead of `getSmsThreads().find()`.

---

## 12. Push notifications — not started

> **Status 2026-10-27: prompt written, nothing built.**
> [../prompts/BACKEND-PUSH.md](../prompts/BACKEND-PUSH.md) — the prompt, plus the account / env
> setup (QStash and the APNs key reused from Ninja CRM; Firebase Android app, FCM key and EAS
> credentials new for PRM).

A port of Ninja CRM's push pipeline (outbox table → QStash → worker route → Expo → receipts).
The one structural change: the PRM has no Notification table, so `push_delivery` carries its own
title/body/data. Two producers: an incoming text (hooked into `recordSmsMessage`, the choke point
both the webhook and the sync use, only for texts under 10 minutes old so a history import can't
spray the phone) and an 8am tasks summary from the existing hourly cron.
