# Backend — REST surface for Messages (CrazyTel SMS)

Run this in a **new Claude Code session opened in the backend repo**:

```
cd C:\Users\DELL\Projects_Advice_Ninja\ninja_prm
```

> ## Read this before you paste
>
> 🚨 **`../ninja_prm` is BEHIND `ref/prm`.** As of 2026-10-18 the SMS module exists only in
> `ref/prm` (HEAD `73eb814 fix: prevent listing un-synced conversations`); `../ninja_prm` is
> at `6efd09e` and has no `src/lib/sms`, no `actions/sms.ts`, nothing. Pull it up to date first,
> or run the prompt in whichever checkout actually has the SMS code.
>
> **Why backend work is needed at all.** The web Messages page is 100% server actions
> (`src/app/actions/sms.ts`, `actions/contact-comms.ts`). There is **no `/api/v1/sms*` route** —
> checked every folder under `src/app/api/v1`. Native can't call server actions. Same situation
> Recordings was in before Phase 0.
>
> **What is NOT needed:** anything in `actions/crazytel.ts` (connect, numbers, lines, webhooks,
> re-import). Setup stays on the web; the phone only needs to know *whether* SMS is configured
> and which lines exist. The CrazyTel webhook and cron already land texts in the database, so
> the phone gets new texts just by re-reading.

---

## THE PROMPT

````
The Ninja PRM mobile app (React Native) is adding a Messages screen — the
phone version of /dashboard/messages (two-way SMS via CrazyTel). The logic
already exists as server actions in src/app/actions/sms.ts and
src/app/actions/contact-comms.ts. Native clients can't call server actions,
so expose them as REST routes under /api/v1/sms.

Work on a branch `feat/sms-api`.

────────────────────────────────────────────────────────────────────
APPROACH — thin wrappers, exactly like /api/v1/recordings
────────────────────────────────────────────────────────────────────

src/app/api/v1/recordings/route.ts already shows the pattern: call
requireApiAuth() FIRST (returns a 401 NextResponse when unauthenticated),
then call the existing server action. The action's own requireAuth() then
finds the same session via the cookie. Do the same here.

⚠️ requireApiAuth() must run first in EVERY route: requireAuth() inside the
actions calls redirect("/auth/login") when there's no session, which in a
route handler becomes a 307 to an HTML page — the app needs a 401.

Do NOT duplicate or rewrite the SMS logic, and do NOT change the server
actions' behaviour — the web page must keep working unchanged. If a wrapper
needs something an action doesn't expose, add a small optional parameter or
extract a helper both can call; don't fork the logic.

Serialise Dates as ISO strings (NextResponse.json does this already).

────────────────────────────────────────────────────────────────────
ERROR MAPPING — the app depends on these exact statuses
────────────────────────────────────────────────────────────────────

  401  not signed in                         (requireApiAuth)
  409  SMS not set up — the action throws "SMS is not set up. Connect
       CrazyTel in Integrations."  → 409 with that message in `error`.
       The app shows 409 messages verbatim as "fix this on the web".
  400  bad input: invalid threadId ("Invalid thread."), empty body,
       invalid phone number, missing name
  404  "Conversation not found." / "Contact not found."
  502  CrazyTel itself failed while sending
  500  anything else

sendSmsMessage and linkSmsThreadToContact RETURN { success:false, error }
instead of throwing — map those to the statuses above, don't return 200
with success:false.

Body shape for every error: { "error": "<message>" }.

────────────────────────────────────────────────────────────────────
THE ROUTES
────────────────────────────────────────────────────────────────────

1. GET /api/v1/sms/setup
   → getSmsSetup()
   { configured, source, lines: [{ key, label, display, isDefault }] }
   Must NOT 409 when unconfigured — return configured:false. The app uses
   this to decide between the inbox and a "connect CrazyTel on the web"
   empty state.

2. GET /api/v1/sms/threads
   → getSmsThreads(), then filter + page IN THE ROUTE (the web does the
     same filtering client-side; getSmsThreads returns every thread).
   Query params (all optional):
     search    if ≥2 chars, keep only ids from searchSmsThreadIds(search)
     filter    all | unread | contacts | unknown   (default all)
               unread = unreadCount>0, contacts = contact!=null,
               unknown = contact==null — match the web's tabs exactly;
               check messages-page-client.tsx for its definitions
     lineKey   keep threads whose lineKeys include it ("All my numbers" = omit)
     page, pageSize   default 1 / 50, max 100
   Response:
     { threads: SmsThreadListItem[], totalCount, page, pageSize,
       totalPages, unreadTotal }
   unreadTotal = sum of unreadCount across ALL threads (before filter /
   paging) — it drives the tab badge.
   An invalid `filter` value → 400, never 500.

3. GET /api/v1/sms/threads/[threadId]/messages
   → getSmsThreadMessages(threadId)   { messages: SmsMessageItem[] }
   threadId looks like "contact:<id>" or "conv:<id>". The app sends it
   URL-encoded (contact%3Aabc) — decodeURIComponent the param defensively
   so both forms work.
   Also return the thread's own row (same shape as a list item) as
   `thread`, so the app can open a thread from a push or deep link without
   loading the whole list. Fine to compute it via getSmsThreads().find().

4. POST /api/v1/sms/threads/[threadId]/read
   → markSmsThreadRead(threadId)   → { success: true }

5. POST /api/v1/sms/send
   body { to, body, lineKey?, clientRequestId? }
   → sendSmsMessage(input)   → { success: true, threadId }
   clientRequestId is the idempotency key — the app generates one per
   message and reuses it on retry. Confirm it really reaches CrazyTel so a
   retry after a dropped connection can't double-send.
   Also return the saved message (same shape as SmsMessageItem) as
   `message` if it's cheap to — it lets the app replace its optimistic
   bubble without refetching the thread. If it isn't cheap, skip it and say so.

6. POST /api/v1/sms/threads
   body { to, lineKey? }
   → startSmsThread(input)   → { threadId }
   (the "+" / new-message button, and "Text" from a contact)

7. POST /api/v1/sms/threads/[threadId]/link-contact
   body { contactId } OR { newContactName }
   → linkSmsThreadToContact({ threadId, ...body })   → { success, threadId }
   (the "Save contact" button — note the threadId CHANGES to contact:<id>)

8. POST /api/v1/sms/check
   → checkForNewTexts()   → { checked, imported }
   Cheap and self-throttled (110s) — the app calls it on pull-to-refresh
   and when the app returns to the foreground.

9. POST /api/v1/sms/sync
   → syncSmsHistory()   → { success, imported, alreadyRunning, backfillPending }
   The heavy one (up to 50 CrazyTel requests). The app only calls it from
   an explicit "Sync with CrazyTel" action, never automatically.

10. GET /api/v1/contacts/[id]/sms
    → getContactSmsSummary(contactId)   (actions/contact-comms.ts)
    For the Texts block on the contact detail screen. 404 if the contact
    isn't the caller's.

NOT NEEDED — don't build: searchContactsForSms (the app already has
GET /api/v1/contacts?search=), and everything in actions/crazytel.ts.

────────────────────────────────────────────────────────────────────
CHECK AND REPORT — don't change unless it's a real bug
────────────────────────────────────────────────────────────────────

a. getSmsThreads loads every conversation for the user, then the route
   pages in memory. How many threads does a heavy account (Ben's) have,
   and how long does GET /threads take for it? If it's over ~1s, tell me —
   don't optimise it in this change.
b. SmsMessageItem.status — list every value it can actually take
   (SmsMessageStatus enum: RECEIVED, QUEUED, SENT, DELIVERED, FAILED?).
c. When a send FAILS at CrazyTel after recordSmsMessage — or never reaches
   it — is a FAILED message row saved, or nothing? The app needs to know
   whether to keep a failed bubble locally.
d. Can a message's `body` contain anything other than plain text (MMS,
   attachments)? `contentAvailable:false` rows have an empty body — confirm.
e. Is there anything in the webhook path (api/webhooks/crazytel/sms) that
   assumes the web page is the only reader? (e.g. unread counts, read
   receipts pushed back to CrazyTel)

────────────────────────────────────────────────────────────────────
VERIFY — run these and show real output
────────────────────────────────────────────────────────────────────

  # unauthenticated → 401 on every route (never 307, never 500)
  for p in sms/setup sms/threads "sms/threads/contact%3Ax/messages"; do
    curl -s -o /dev/null -w "%{http_code} $p\n" "$BASE/api/v1/$p"; done

  curl -s "$BASE/api/v1/sms/setup" -H "Cookie: $C" | jq
  curl -s "$BASE/api/v1/sms/threads?pageSize=3" -H "Cookie: $C" | jq '{totalCount,unreadTotal,first:.threads[0]}'
  curl -s "$BASE/api/v1/sms/threads?filter=unknown&pageSize=2" -H "Cookie: $C" | jq '.threads[].contact'
  curl -s "$BASE/api/v1/sms/threads?search=thanks" -H "Cookie: $C" | jq '.totalCount'
  curl -s "$BASE/api/v1/sms/threads?filter=bogus" -H "Cookie: $C" -w '\n%{http_code}\n'   # 400
  T=$(curl -s "$BASE/api/v1/sms/threads?pageSize=1" -H "Cookie: $C" | jq -r '.threads[0].id' | jq -sRr @uri)
  curl -s "$BASE/api/v1/sms/threads/$T/messages" -H "Cookie: $C" | jq '.messages[-1], .thread.id'

  # a REAL send, to a number you own — confirm it arrives, then retry with
  # the SAME clientRequestId and confirm it does NOT arrive twice
  curl -s -X POST "$BASE/api/v1/sms/send" -H "Cookie: $C" -H 'Content-Type: application/json' \
       -d '{"to":"<your mobile>","body":"API test","clientRequestId":"test-123"}' | jq

  # an account with CrazyTel NOT connected → /setup configured:false, /threads 409
  # the WEB Messages page still works: list, open, send, save contact

────────────────────────────────────────────────────────────────────
WHEN YOU'RE DONE
────────────────────────────────────────────────────────────────────

  1. Files changed, one line each.
  2. A real (redacted) JSON response for each of the 10 routes — this is
     the deliverable the mobile client is typed from.
  3. Answers to a–e.
  4. Anything that behaved differently from this description.
  5. What you ran vs. what you reasoned about.
````

---

## Mobile side — BUILT 2026-10-18, ahead of this backend

The user chose: **Messages replaces the Settings tab; Settings becomes a gear on Home** (where the
theme toggle was). The UI is in [../features/FEAT-04-MESSAGES.md](../features/FEAT-04-MESSAGES.md)
and calls exactly the routes above. Once they ship, check every field in `src/types/sms.types.ts`
against the real JSON.

What was planned (and is now done unless noted):

- `src/types/sms.types.ts`, `src/api/sms.api.ts`, `qk.sms.{setup,threads,messages}`.
- Inbox: search, line picker, All / Unread / Contacts / Unknown, unread badge on the tab.
- Thread: bubbles, delivered/failed state, composer with "From <line>", **optimistic send with a
  `clientRequestId`** reused on retry, mark-read on open, "Save contact".
- Polling, matching the web: re-read threads every ~15s **while the screen is focused and the app
  is foregrounded**, `POST /sms/check` on pull-to-refresh and on foreground. No background polling.
- Contact detail: a Texts block from `GET /contacts/[id]/sms`, and a "Text" action.
- **Not in this pass:** push notifications for incoming texts. They'd need Expo push tokens
  stored server-side plus a send from the CrazyTel webhook — separate backend work. Ask first.
- Keyboard: the composer is a bottom-anchored input, so hide the tab bar on the thread screen
  and measure the keyboard (CLAUDE.md gotcha 6, HANDOVER gotcha 7).
