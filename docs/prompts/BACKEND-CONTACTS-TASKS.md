# Backend — Contacts & Tasks for mobile

Run this in a **new Claude Code session opened in the backend repo**:

```
cd C:\Users\DELL\Projects_Advice_Ninja\ninja_prm
```

> ## Read this before you paste
>
> **Most of this API already exists.** Unlike recordings — which were server-actions
> only — contacts and tasks already have full REST CRUD:
>
> | | list | create | read | update | delete |
> | --- | --- | --- | --- | --- | --- |
> | `/api/v1/contacts` | GET | POST | GET `[id]` | PATCH | DELETE |
> | `/api/v1/tasks` | GET | POST | GET `[id]` | PATCH | DELETE |
>
> plus `contacts/[id]/archive`, `/unarchive`, `/tasks`, `/interactions`,
> `/important-dates`, and `contacts/bulk|merge|import|export|duplicates`.
>
> Filters already supported:
> - **contacts** — `search`, `relationshipType`, `archived`, `tagIds`, `page`,
>   `pageSize`, `sortBy`, `sortOrder`
> - **tasks** — `search`, `status`, `priority`, `contactId`, `page`, `pageSize`,
>   `sortBy`, `sortOrder`
>
> **So this prompt is not "build the API."** It's one real bug fix, plus
> writing down the contracts so the mobile client isn't guessing.

---

## THE PROMPT

````
The Ninja PRM mobile app is adding Contacts and Tasks screens. The REST
endpoints already exist and already support the filters we need — do NOT
rebuild them.

There is one real bug, and one documentation job.

Work on a branch `fix/api-auth-status`.

────────────────────────────────────────────────────────────────────
PART A — THE BUG: unauthenticated requests return 500, not 401
────────────────────────────────────────────────────────────────────

Verified against production 2026-09-24:

    GET /api/v1/contacts    → 500   (no body)
    GET /api/v1/tasks       → 500
    GET /api/v1/contacts/x  → 500
    GET /api/v1/tasks/x     → 500
    GET /api/v1/recordings  → 401   ← the newer routes get this right
    GET /api/v1/me          → 401

Cause: `requireApiAuth()` in src/lib/api-auth.ts **throws** on a missing
session. It never returns a NextResponse. But ~60 route files are written as:

    const authResult = await requireApiAuth();
    if (authResult instanceof NextResponse) return authResult;   // dead code

The throw escapes, Next turns it into an unhandled 500, and the `instanceof`
branch never runs.

WHY THIS MATTERS FOR MOBILE: the app signs the user out on **401** and shows a
generic error on 5xx. With a 500, an expired session leaves the user inside a
logged-in UI where every screen fails and nothing prompts them to sign in
again. It is the single worst failure mode we can ship.

Fix it at the source so every route benefits:

- Make the shared helper produce a real 401 — either have `requireApiAuth()`
  return a typed result the routes can check, or (preferred, far less churn)
  keep it throwing a typed error and catch it centrally.
- `src/lib/recordings/api.ts` already has `handleRecordingsApiError`, which
  does exactly this mapping for the recordings routes. Generalise that rather
  than inventing a second pattern — rename/move it if it now serves all of v1.
- Remove the dead `instanceof NextResponse` branches as you go.

⚠️ This touches ~60 files. Prefer the smallest change that makes every v1
route return 401 when unauthenticated. If a blanket fix is genuinely risky,
do CONTACTS and TASKS first (list, [id], and the contacts sub-routes the app
uses: archive, unarchive, tasks) and tell me which routes you left alone.

Do not change what an AUTHENTICATED request returns. This is purely about the
unauthenticated path.

────────────────────────────────────────────────────────────────────
PART B — WRITE DOWN THE CONTRACTS
────────────────────────────────────────────────────────────────────

The mobile client has to declare TypeScript types for these responses. Last
time we guessed from the Prisma schema and it mostly worked, but "mostly" cost
a round of fixes. Give me the REAL shapes.

For each of these, paste an actual (redacted) JSON response and list every
query param with its default:

  GET    /api/v1/contacts
  POST   /api/v1/contacts
  GET    /api/v1/contacts/[id]
  PATCH  /api/v1/contacts/[id]
  DELETE /api/v1/contacts/[id]
  POST   /api/v1/contacts/[id]/archive     and /unarchive
  GET    /api/v1/contacts/[id]/tasks

  GET    /api/v1/tasks
  POST   /api/v1/tasks
  GET    /api/v1/tasks/[id]
  PATCH  /api/v1/tasks/[id]
  DELETE /api/v1/tasks/[id]

Specifically confirm:

1. **The list envelopes.** Contacts and tasks appear to differ — tasks returns
   `{ tasks, totalCount, page, pageSize, totalPages }`. What exactly does
   contacts return? If they're inconsistent, say so; don't change them.

2. **Enums, exactly as serialised.** From the schema they are:
       TaskStatus        OPEN | DONE | CANCELLED
       TaskPriority      LOW | NORMAL | HIGH
       RelationshipType  FRIEND | FAMILY | CLIENT | LEAD | VENDOR |
                         COLLABORATOR | COLLEAGUE | OTHER
   Confirm the wire format is these SCREAMING_CASE strings and not something
   lowercased on the way out.

3. **What POST/PATCH accept and what they REQUIRE.** For tasks I can see
   `title, description, status, priority, dueAt, repeatInterval` — is that
   everything? How are contacts attached to a task on create (`contactIds`?),
   and on update does PATCH replace the whole set or merge?

4. **Date formats.** `dueAt` in and out — ISO string? Is a date-only value
   accepted? Is it stored/returned in UTC or the user's timezone? (The user
   has a `timezone` field and src/lib/timezone.ts exists, so this is a real
   question, not a rhetorical one.)

5. **Tags.** Both lists run through `attachTagsToRecord`. What does the tag
   object look like on a contact and on a task, and can the app filter tasks
   by tag the way contacts do with `tagIds`?

6. **Task → contact embedding.** The tasks list includes `contacts.contact`.
   Which fields come back — enough to render a name and avatar in a list row?

────────────────────────────────────────────────────────────────────
PART C — GAPS, ONLY IF THEY'RE REAL
────────────────────────────────────────────────────────────────────

Do NOT add these speculatively. Tell me whether each is already possible with
today's params, and only implement the ones that aren't:

- **Overdue tasks.** The app wants "due before now AND not DONE". Possible
  with existing filters, or does it need a param?
- **Due-today / this-week.** Same question. A `dueBefore` / `dueAfter` pair
  would cover both if they don't exist.
- **Counts for a dashboard** — open tasks, overdue tasks, total contacts.
  `totalCount` with `pageSize=1` works but costs a full query per counter.
  Is there something better, or should we just do that?

────────────────────────────────────────────────────────────────────
VERIFY — run these and show real output
────────────────────────────────────────────────────────────────────

    # the bug is fixed
    curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/v1/contacts"        # 401
    curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/v1/tasks"           # 401
    curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/v1/contacts/abc"    # 401
    curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/v1/tasks/abc"       # 401

    # authenticated behaviour UNCHANGED
    curl -s "$BASE/api/v1/contacts?pageSize=2"            -H "Cookie: $C" | jq
    curl -s "$BASE/api/v1/tasks?status=OPEN&pageSize=2"    -H "Cookie: $C" | jq
    curl -s "$BASE/api/v1/tasks?priority=HIGH&sortBy=dueAt&sortOrder=asc" -H "Cookie: $C" | jq '.totalCount'
    curl -s "$BASE/api/v1/contacts?search=test&relationshipType=CLIENT"    -H "Cookie: $C" | jq '.  | keys'

    # another user's id → 404, never 403
    # the WEB app's contacts and tasks pages still work

────────────────────────────────────────────────────────────────────
WHEN YOU'RE DONE
────────────────────────────────────────────────────────────────────

  1. Files changed, one line each, and how many routes the auth fix covers.
  2. The JSON shapes from Part B — this is the deliverable I actually need.
  3. Part C answers: which gaps were already covered, which you implemented.
  4. Anything that behaved differently from this description.
  5. What you ran vs. what you reasoned about.
````

---

## After it ships

I'll build **Contacts** and **Tasks** as two new tabs, against the confirmed
shapes:

- **Contacts** — searchable list with relationship-type filter, detail screen
  showing the contact's tasks, interactions and linked recordings (those
  sub-routes already exist), create/edit, archive.
- **Tasks** — list filtered by status and priority, overdue highlighted,
  complete/reopen inline, create/edit, attach to a contact.

The tab bar goes from three to five, which is the natural ceiling — anything
beyond that needs a different navigation shape.

Related: [BACKEND-PHASE-0.md](BACKEND-PHASE-0.md) ·
[BACKEND-SHARE-TRANSCRIPT.md](BACKEND-SHARE-TRANSCRIPT.md)
