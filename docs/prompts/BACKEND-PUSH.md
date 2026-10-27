# Backend — push notifications (Expo + QStash), ported from Ninja CRM

Run this in a **new Claude Code session opened in the backend repo**:

```
cd C:\Users\DELL\Projects_Advice_Ninja\ninja_prm
```

> ## Read this before you paste
>
> **Do the account setup first** (section "Accounts and env" at the bottom) — the prompt can be
> built without it, but nothing can be verified until `QSTASH_*` and `EXPO_ACCESS_TOKEN` exist.
>
> **The mobile side is already built** (`feat/push` in ninja_prm_mobile — FEAT-05). It calls the
> exact paths and payloads below; changing them breaks it silently.
>
> **The reference implementation is `../ninja_crm`** — working in production. Copy, don't redesign.
> The one structural difference: **the PRM has no Notification table**, so the outbox row carries
> its own title/body/data instead of pointing at a notification.

---

## THE PROMPT

````
Add push notifications to Ninja PRM for the mobile app (Expo). The design is
ALREADY PROVEN in the sibling repo ../ninja_crm — port it, don't redesign it.

Work on a branch `feat/push`.

────────────────────────────────────────────────────────────────────
READ FIRST — the reference implementation in ../ninja_crm
────────────────────────────────────────────────────────────────────

  lib/push/expo.ts           Expo HTTP transport, tickets + receipts. COPY VERBATIM.
  lib/push/queue.ts          QStash publish + signature verify. Copy, then adapt base URL (below).
  lib/push/worker-core.ts    The outbox drain (FOR UPDATE SKIP LOCKED). Adapt (below).
  lib/push/categories.ts     Category ↔ column map. Rewrite for PRM's two categories.
  lib/notifications.ts       dispatchPush / triggerPushDrain with after(). Port that part.
  app/api/push/worker/route.ts, receipts/route.ts, register/, unregister/, preferences/
  docs/PUSH-IMPLEMENTATION-CHECKLIST.md   — read "Two corrections to the guide" and
                                            "Web request latency — why after()".

Keep every ⚠️ comment from those files that still applies — they record real bugs.

────────────────────────────────────────────────────────────────────
ARCHITECTURE (same as the CRM)
────────────────────────────────────────────────────────────────────

  producer → queuePush()  ── INSERT push_delivery (status 'queued')
                          └─ after(): qstash.publish → POST /api/push/worker
  /api/push/worker  (QStash-signed)
     claim rows FOR UPDATE SKIP LOCKED → resolve the user's tokens, filter by
     category column → POST exp.host (≤100/batch) → push_ticket rows →
     qstash.publish({ delay: 900 }) → POST /api/push/receipts
  /api/push/receipts (QStash-signed)
     DeviceNotRegistered → DELETE that push_token row

Keep the outbox row even with a queue: if qstash.publish fails, the row
survives and the next drain sends it. With no QSTASH_TOKEN (local dev) drain
INLINE, exactly like the CRM's dispatchPush().

────────────────────────────────────────────────────────────────────
1. SCHEMA  (prisma/schema.prisma)
────────────────────────────────────────────────────────────────────

model PushToken {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token      String   @unique          // "ExponentPushToken[…]" — one row per device
  platform   String                    // "ios" | "android"
  deviceName String?
  /// ⚠️ Defaults MUST match DEFAULT_PUSH_PREFERENCES in the app
  /// (ninja_prm_mobile src/lib/push-categories.ts): sms on, tasks off.
  prefSms    Boolean  @default(true)
  prefTasks  Boolean  @default(false)
  lastSeenAt DateTime @default(now())
  createdAt  DateTime @default(now())
  @@index([userId])
  @@map("push_token")
}

model PushDelivery {          // the outbox — carries its own payload (no Notification table)
  id        String    @id @default(cuid())
  userId    String
  category  String              // "sms" | "tasks" | "test"
  title     String
  body      String
  data      Json                // see PAYLOAD CONTRACT
  status    String    @default("queued")   // queued | sending | sent | skipped
  attempts  Int       @default(0)
  error     String?
  createdAt DateTime  @default(now())
  sentAt    DateTime?
  @@index([status, createdAt])
  @@map("push_delivery")
}

model PushTicket {            // one per device per delivery, awaiting its receipt
  id         String   @id @default(cuid())
  ticketId   String   @unique
  token      String
  deliveryId String
  createdAt  DateTime @default(now())
  @@map("push_ticket")
}

Add `pushTokens PushToken[]` to User, and `lastTaskPushAt DateTime?` to User
(the once-a-day guard for the tasks summary).

⚠️ HOW TO APPLY: first check how this database is managed. prisma/migrations
holds ONE folder, yet the schema has dozens of models added since — so it is
almost certainly a `db push` database like the CRM's. Confirm by checking
whether `_prisma_migrations` exists / is current. If it's db-push managed:
`npx prisma db push` WITHOUT --accept-data-loss, and confirm the diff is
additive only (CREATE TABLE ×3, ADD COLUMN on user). If it asks for
--accept-data-loss, STOP and tell me what it wants to drop.
NEVER run `prisma migrate dev` against it (it offers to reset the database).

────────────────────────────────────────────────────────────────────
2. lib/push/  — the library
────────────────────────────────────────────────────────────────────

- expo.ts — copy verbatim.
- categories.ts — PushCategory = "sms" | "tasks". CATEGORY_COLUMN
  { sms: "prefSms", tasks: "prefTasks" }. preferenceColumns(prefs) with
  fallbacks sms ?? true, tasks ?? false (MUST match the column defaults).
  "test" is NOT a category — a test push ignores preferences.
- queue.ts — copy, with ONE change: the callback base URL.
  ⚠️ The apex domain redirects to www, and QStash must hit the final URL.
  Use the existing src/lib/public-url.ts (getPublicBaseUrl / resolvePublicOrigin —
  already written for exactly this problem with CrazyTel's webhooks) rather
  than NEXT_PUBLIC_BASE_URL. verifyQstash must fail CLOSED with no signing keys.
- outbox.ts — the producer API:

    queuePush({ userId, category, title, body, data }): Promise<void>
      • NEVER throws (a push problem must not fail the request that caused it —
        wrap everything, log errors).
      • Cheap pre-check: skip the insert if the user has no token with this
        category enabled (one indexed query) — keeps the outbox and the QStash
        quota free of pushes nobody will receive. Skip the check for "test".
      • INSERT push_delivery, then triggerPushDrain() — port the CRM's
        triggerPushDrain/dispatchPush verbatim (after() in a request, inline
        when after() throws outside one, inline drain when no QStash).

- worker-core.ts — port drainPushOutbox with these changes:
  • No notification lookup: title/body/data come from the delivery row.
  • Category filter per DEVICE: category "test" → every token of that user
    (or ONLY data.token if set — see the test route); otherwise only tokens
    whose CATEGORY_COLUMN is true.
  • badge = the user's unread SMS conversation count:
      count of SmsConversation where userId and unreadCount > 0
    (same number the app's Messages tab badge shows — the app also syncs the
    icon badge to it, so they must agree). One groupBy for the whole batch.
  • channelId: "default" (the app creates it), sound "default", priority "high".
  • Keep: FOR UPDATE SKIP LOCKED, quoted "createdAt", MAX_ATTEMPTS 5, requeue
    on Expo failure, ticket rows createMany skipDuplicates, prune
    DeviceNotRegistered from tickets, enqueueReceiptCheck.

────────────────────────────────────────────────────────────────────
3. ROUTES
────────────────────────────────────────────────────────────────────

App-facing — under /api/v1/push, requireApiAuth() FIRST (401, never a redirect),
body validated with zod, 400 on bad input:

  POST  /api/v1/push/register     { token, platform:"ios"|"android", deviceName?, preferences:{sms?,tasks?} }
        → upsert on token. ⚠️ The update MUST overwrite userId (a token follows
        the DEVICE: a colleague signing in on the same phone sends the same
        token). Refresh lastSeenAt. → { success: true }
  POST  /api/v1/push/unregister   { token } → deleteMany where token AND userId
        (only your own; missing row is not an error) → { success: true }
  PATCH /api/v1/push/preferences  { token, preferences } → updateMany where
        token AND userId → { success: true }       ⚠️ PATCH, not POST
  POST  /api/v1/push/test         { token }
        → only if that token belongs to the caller (else 404); queuePush a
        "test" delivery targeted at THAT token only (put token in data, or a
        column — your call) titled "Ninja PRM" / "Test notification — push is
        working." with data { type: "test" }. Rate-limit: max 5 per user per
        10 minutes (src/lib/rate-limit.ts exists) → 429.
        → { success: true, queued: true }

QStash-facing — copy from the CRM, NOT under /api/v1 (no session; signature-verified):
  POST /api/push/worker    maxDuration = 60, dynamic = "force-dynamic"
  POST /api/push/receipts  maxDuration = 60
  ⚠️ Read the raw body ONCE (request.text()) and verify THAT string.
  ⚠️ Check these two paths aren't caught by middleware/auth (src/middleware.ts
  or proxy) — QStash has no cookie. They must reach the handler.

────────────────────────────────────────────────────────────────────
4. PRODUCERS — what actually sends a push
────────────────────────────────────────────────────────────────────

A. AN INCOMING TEXT  (category "sms", default ON)

   Hook it into recordSmsMessage() in src/lib/sms/persist.ts — the single
   choke point BOTH the CrazyTel webhook and the history sync go through.
   Push only when ALL hold:
     • direction INBOUND and markUnread is true
     • outcome === "stored"   (a "duplicate"/"updated" is the same text arriving
       by the other path — the webhook then the sync — never push twice)
     • the message's createdAt is within the last 10 minutes
       ⚠️ This is what stops a history import from firing a push per old text:
       the user's first sync imported ~9,800 messages. Without it, connecting
       CrazyTel or re-importing a line would spray the phone.
   Call queuePush AFTER the message is committed; never let it throw out of
   recordSmsMessage.

   Payload:
     title: the contact's name if the conversation is linked, else the
            display number / sender name (the same displayPeer() the inbox uses)
     body:  the text, ≤ 178 chars (… if cut); contentAvailable:false →
            "New text message"
     data:  { type: "sms", threadId }   — threadId exactly as the inbox builds
            it: "contact:<contactId>" if linked, else "conv:<conversationId>"
            (threadIdFor() in actions/sms.ts — reuse it, don't re-derive).

B. TASKS DUE TODAY  (category "tasks", default OFF — opt-in morning summary)

   Run from the EXISTING hourly cron (/api/cron/daily-digest) — add a call to a
   new runTaskPushes() after runDailyDigest(); don't add a cron (vercel.json
   stays as is). For each user who has at least one push_token with
   prefTasks = true:
     • it is 08:00–08:59 in the user's timezone (reuse shouldSendDigestNow()
       from src/lib/digest/should-send-digest.ts with lastTaskPushAt)
     • count OPEN tasks with dueAt < start of TOMORROW in the user's timezone
       (that's due today + overdue — reuse src/lib/timezone.ts helpers; dueAt
       is stored as start-of-day in the user's tz, see the tasks route)
     • if > 0: queuePush
         title: "3 tasks due today"  (or "1 task due today")
         body:  "2 overdue · <title of the soonest one>"  — omit the overdue
                part when 0; ≤ 178 chars
         data:  { type: "tasks_due" }
     • set lastTaskPushAt = now whether or not anything was sent, so the hour
       only runs once per user per day.

C. NOT IN THIS CHANGE — list only, don't build: new call recording summarised,
   auto-generated tasks. Tell me where you'd hook each.

────────────────────────────────────────────────────────────────────
PAYLOAD CONTRACT — read by the app (src/lib/push-links.ts)
────────────────────────────────────────────────────────────────────

  data: { type: "sms", threadId: string }
      | { type: "tasks_due" }
      | { type: "test" }

  The app routes on these exact strings. Unknown types are ignored (the tap
  just opens the app), so adding a type later is safe; renaming one is not.

────────────────────────────────────────────────────────────────────
ENV
────────────────────────────────────────────────────────────────────

  QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY,
  EXPO_ACCESS_TOKEN  — add all four to src/lib/env-validation.ts as OPTIONAL
  (push degrades: no QStash → inline drain; no signing keys → worker routes
  refuse; no Expo token → unauthenticated sends still work).
  APP_URL must be the FINAL origin: https://www.ninjaprm.com.au

  Install: npm install @upstash/qstash   (the CRM uses ^2.11.3)

────────────────────────────────────────────────────────────────────
VERIFY — run these and show real output
────────────────────────────────────────────────────────────────────

  # app routes: unauthenticated → 401
  for p in register unregister test; do
    curl -s -o /dev/null -w "%{http_code} $p\n" -X POST "$BASE/api/v1/push/$p"; done
  curl -s -o /dev/null -w "%{http_code} preferences\n" -X PATCH "$BASE/api/v1/push/preferences"

  # QStash routes: unsigned → 401, never 200 (and never a 307 to the login page)
  curl -s -o /dev/null -w "%{http_code} worker\n"   -X POST "$BASE/api/push/worker"   -d '{}'
  curl -s -o /dev/null -w "%{http_code} receipts\n" -X POST "$BASE/api/push/receipts" -d '{}'

  # register a fake-but-wellformed token with a session cookie, then:
  #   push_token row exists with prefSms=true, prefTasks=false
  #   PATCH preferences {tasks:true} → prefTasks flips
  #   unregister → row gone

  # producers, against the DB with QStash unset (inline drain):
  #   • simulate an inbound text via recordSmsMessage with createdAt = now →
  #     a push_delivery row (category sms, data.threadId correct)
  #   • the SAME call again (duplicate) → no second row
  #   • createdAt = 2 days ago → no row
  #   • runTaskPushes() for a user at 08:xx local with a due task → one row;
  #     run it again → none (lastTaskPushAt)

  # the web app still works: send/receive SMS on /dashboard/messages,
  # the daily digest email still sends.

────────────────────────────────────────────────────────────────────
WHEN YOU'RE DONE
────────────────────────────────────────────────────────────────────

  1. Files changed, one line each.
  2. The db push diff you applied (or why you didn't).
  3. Where you'd hook the two producers in C.
  4. Anything that behaved differently from this description.
  5. What you ran vs. what you reasoned about.
````

---

## Accounts and env — what you need, and what changes because the CRM already has them

You already run all of this for Ninja CRM. Most of it is **reused**; four things are per-app and
have to be done again for PRM.

### 1. Upstash QStash — reuse the CRM's account

| | |
| --- | --- |
| **Reuse** | The same Upstash account and the **same three values**: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (Upstash console → QStash). QStash has no per-app setup: every message carries its own callback URL, so CRM messages go to ninjacrm.com.au and PRM's to ninjaprm.com.au without any configuration. |
| **Do** | Add the three values to the **PRM** Vercel project (Production + Preview) and PRM's local `.env`. |
| **Watch** | **The daily message quota is now shared** by both apps. Each push costs about **two** QStash messages (the drain, then the receipt check 15 minutes later), plus retries. Check your plan's daily cap in the Upstash console against CRM + PRM volume. |
| **Watch** | **Rotating the signing keys now affects both apps.** Update CRM and PRM together, or one app's worker starts refusing QStash. |
| **Alternative** | A separate Upstash account (or team) for PRM, if you want quotas and keys isolated. Costs nothing extra on the free tier. |

### 2. Expo access token — reuse only if both apps are in the same Expo account

| | |
| --- | --- |
| **Check** | expo.dev → is the PRM project (`84245266-ff07-459a-93e8-51d833f5d9cd`) in the same account/organisation as the CRM's (`07901521-…`)? |
| **If yes** | You can reuse the CRM's `EXPO_ACCESS_TOKEN`. Better: create a separate robot token named `prm-push` (expo.dev → Account settings → Access tokens), so revoking one app's token doesn't break the other's push. |
| **If no** | Create one in the account that owns the PRM project. |
| **Do** | `EXPO_ACCESS_TOKEN` in the PRM Vercel project and `.env`. Then on expo.dev → the PRM project → **Settings → Enhanced push security** → enable, so only that token can send to PRM devices. |

### 3. Android — Firebase (per app, required for Android push)

1. Firebase console → **the CRM's existing project is fine** → Add app → **Android** → package
   **exactly** `com.adviceninja.ninjaprm`.
2. Download that app's `google-services.json` → put it at **this repo's root** → add to `app.json`:
   ```json
   "android": { "googleServicesFile": "./google-services.json", ... }
   ```
   → commit it. It ships inside every APK anyway, and its key is restricted by package name.
   ⚠️ Not added yet on purpose: `app.json` pointing at a file that doesn't exist fails the Android build.
3. The **FCM V1 service-account key**: if you used the CRM's Firebase project, you can reuse the
   same key file (Firebase → Project settings → Service accounts). **But credentials in EAS are
   per project**, so upload it again from this repo: `eas credentials -p android` →
   Push Notifications (FCM V1). ⚠️ This file is a real secret — never commit it.
4. Until this is done, Android shows "This build can't register for notifications" in Settings.
   iOS is unaffected.

### 4. iOS — APNs (per app, mostly automatic)

`eas credentials -p ios` (or the next `eas build -p ios`) → when asked about a **Push
Notifications key**, choose to **reuse the CRM's existing APNs key**. One key works for every
app in your Apple team, and Apple caps how many a team can create, so don't make a new one.

### 5. New builds — this is a native change

`expo-notifications` and `expo-device` are native modules, so a Metro reload is **not enough**:

```bash
eas build -p ios --profile development       # new dev client to test on
eas build -p android --profile development   # after step 3
eas build -p ios --profile production        # then TestFlight
```

Push can't be tested on a simulator. Prove the device and credentials first: take the token
(Settings → Notifications → "Send a test notification" uses it; or log it) and send to it from
[expo.dev/notifications](https://expo.dev/notifications). If that doesn't arrive, the problem is
credentials, not the backend.

### 6. Before App Store submission

- **App Privacy:** a push token is an identifier linked to the user → declare **Identifiers →
  Device ID**, *App Functionality*, linked, **not** tracking.
- **Privacy policy:** a line saying device tokens are stored to deliver notifications.
- **Review notes:** the reviewer can't practically receive a text push; say Messages shows the
  same texts in-app.
