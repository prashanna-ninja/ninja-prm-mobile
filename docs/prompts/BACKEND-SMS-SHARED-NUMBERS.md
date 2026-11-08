# Backend prompt — CrazyTel numbers shared by several PRM accounts

> Paste everything below the line into a Claude Code session opened in `../ninja_prm`.
> Written 2026-11-04 from a read of `origin/main` (6ad7a50). BACKEND-CHANGES §15.

---

## The problem

Three PRM accounts are connected to the **same CrazyTel account** (account code 570365) and
sync the **same numbers**. Every PRM connection has its own `webhookToken`, so each account has
its own webhook URL. But the code keeps only **one** forwarding route to this app per CrazyTel
number:

- `registerSmsWebhook` (`src/lib/sms/crazytel-client.ts`) removes every route whose destination
  contains the webhook path and adds the caller's URL;
- the hourly self-heal `ensureSmsWebhooks` (`src/lib/sms/webhook-routes.ts`, run from
  `/api/cron/crazytel-sync` in the first 5 minutes of each UTC hour) re-registers for every
  connection whose own URL is missing;
- the Integrations page shows ⚠ "forwards to an outdated link" whenever the route isn't this
  account's exact URL (`receiveStateFor` in `src/app/actions/crazytel.ts`).

So the accounts take the numbers from each other. Whoever has a number gets its texts instantly
(webhook → `recordSmsMessage` → push). The others only get them from the 15-minute sync or the
"check for new texts" call, which means late pushes. If the text is more than 10 minutes old by
then, there's no push at all (`FRESH_TEXT_MS` in `src/lib/push/sms-push.ts`). The user saw
exactly this: they pressed "Receive on all", and 15 minutes later every number showed ⚠ again.

## The fix

Keep **one** route per number. When a text arrives, save it into **every** PRM account connected
to the **same CrazyTel account** that has that number synced. Stop the accounts taking the route
from each other.

## Ground rules

- Branch: `git switch main && git pull && git switch -c sms-shared-numbers`. Stop and say so if
  the working tree isn't clean.
- **No schema change and no `db push`.** Everything needed already exists
  (`CrazytelConnection.accountCode`, `CrazytelLine.phoneNumber/enabled/autoReceive/webhookRegistered`).
- Don't commit, push or deploy.
- **Read the files named below before changing them.** If anything here doesn't match the code
  (a function signature, a field name, a behaviour), stop and tell me instead of improvising.
- **Behaviour must be identical to today for:**
  - a connection with **no siblings** (the normal case: one PRM account per CrazyTel account);
  - a connection whose `accountCode` is **null** (treat it as having no siblings);
  - the **legacy env-configured account** (`getLegacySmsAccount`, no token) — don't touch that path;
  - sending texts, the 15-minute sync, `/api/v1/sms/check`, the history import, call
    recordings, the Microsoft sync, and every `/api/v1/*` route the mobile app calls.
- Keep the changes small and contained. Put the new logic in **one new file**,
  `src/lib/sms/shared-numbers.ts`, and call it from the existing places.

## Definitions

- **Siblings of connection C:** other `CrazytelConnection` rows with
  `accountCode === C.accountCode`, where `C.accountCode` is **not null**, and `id !== C.id`.
  The account code comes from CrazyTel's `/balance` call when the API key is validated
  (`connectCrazytel` in `src/app/actions/crazytel.ts`). A user can't type it in, so only accounts
  that really hold the same CrazyTel credentials ever share texts.
- **Accepted URLs for connection C:** C's own webhook URL plus each sibling's webhook URL. Each
  one is built with the existing `resolveSmsWebhookUrl(token)`, so the domain logic stays exactly
  as it is.
- **A sibling wants Receive on number N:** its line for N has `enabled && autoReceive`.

## Changes

### 1. New `src/lib/sms/shared-numbers.ts`

Header comment: explain the problem above in 3–4 lines and point to BACKEND-CHANGES §15.

- `getSiblingConnections(connection: { id: string; accountCode: string | null })` → siblings with
  their `lines`. Return `[]` immediately when `accountCode` is null, with no query.
- `getAcceptedWebhookUrls(connection)` → `Promise<string[]>`: own URL plus the siblings' URLs.
- `findInboundRecipients(owner: SmsAccount, ownerConnection, toNumber: string)` → the list of
  `{ account: SmsAccount; line: SmsLine; connectionId: string }` that should store an inbound
  text sent to `toNumber`:
  - the token owner, **if** `findLineByNumber(owner, toNumber)` finds an enabled line (same as
    today);
  - plus every sibling with an **enabled** line for that number (build each sibling's
    `SmsAccount` the same way `getSmsAccountByWebhookToken` does, with `linesFromConnection`);
  - de-duplicated by `userId`, owner first.
- `releaseSmsWebhook(connection, phoneNumber)`: what "this account stops receiving N" does now.
  - If a sibling **wants Receive** on N: hand the number over. Call
    `registerSmsWebhook(apiKey, N, siblingUrl)`, which already replaces our route with theirs, and
    set that sibling line's `webhookRegistered: true`.
  - Otherwise: call `unregisterSmsWebhook(apiKey, N, connection.webhookToken)` exactly as today.
  - Never throws. Log and swallow, as the existing callers do with `.catch(() => {})`.

### 2. `registerSmsWebhook` (`src/lib/sms/crazytel-client.ts`)

Add an optional last parameter `acceptedUrls?: string[]`. If the number already has exactly one
route to our webhook path and its destination is in `acceptedUrls`, **return without changing
anything**, because a sibling's route already delivers to this account. With `acceptedUrls`
omitted, behaviour is **exactly** as today. Leave non-PRM routes untouched, as today.

### 3. The status / ⚠ (`receiveStateFor` in `src/app/actions/crazytel.ts`)

Compute "on" against the **accepted URLs** (own plus siblings) instead of only the own URL.
`wrong_url` and `off` keep their current meaning. The existing `webhookRegistered` resync just
below it then follows automatically. Load the accepted URLs once per status call, not per line.

### 4. Turning Receive on (`applyLineWebhook`, enabled branch)

Pass the accepted URLs to `registerSmsWebhook`, so turning Receive on doesn't take the number
from a sibling that already has it. Keep setting `webhookRegistered: true, autoReceive: true` as
today: this account wants Receive, and it's covered.

### 5. Hourly self-heal (`ensureSmsWebhooks` in `src/lib/sms/webhook-routes.ts`)

`routed` becomes "a route's destination is in the accepted URLs", not only this connection's
own URL. Compute the accepted URLs once per call. Everything else in that function stays the same.

### 6. Every place that removes our route → `releaseSmsWebhook`

Replace these direct `unregisterSmsWebhook(...)` calls, and keep each one's existing
conditions, `.catch` behaviour and ordering:
- `applyLineWebhook`, disabled branch (Receive switched off);
- `removeCrazytelLine`;
- `disconnectCrazytel`: must run **before** the connection row is deleted, as it does today;
- `setLinesSynced`, disable branch (`src/lib/sms/line-sync.ts`).

Grep for any other `unregisterSmsWebhook` caller, and tell me if there is one.

### 7. The webhook (`src/app/api/webhooks/crazytel/sms/route.ts`)

Keep `resolveAccount`, the 401 for an unknown token, the no-token legacy path, `parseBody` and
the response shapes exactly as they are.

- **Identifying the parties:** today `resolveParties` uses the owner's lines to work out which
  number is "to". Owner's connection only: also pass the siblings' enabled lines, as a merged
  read-only `SmsAccount` used **only** for working out from/to, so a text still resolves when the
  route is the owner's but only a sibling syncs that number. With no siblings, the result must be
  identical to today.
- **Storing:** for the legacy account, or a connection without siblings, do **exactly** what the
  code does now. Otherwise call `findInboundRecipients` and, **for each recipient,
  sequentially**, run the existing `recordSmsMessage({...})` call with that recipient's `userId`
  and `line` and every other argument unchanged (`externalId: wh:<id>`, `status: "received"`,
  `markUnread: true`). Each recipient gets its own `try/catch`.
- **Delivery log:** log each recipient's outcome to **its own** connection
  (`logCrazytelEvent({ connectionId: recipient.connectionId, ... })`), so every account's
  Integrations page shows its own `stored`. Keep the owner's `unparsed` and `no_line` logging for
  when **nobody** has the line. Don't log `no_line` to the owner when a sibling stored the text,
  because the owner's page would show a red "wasn't saved".
- **Response:** if **any** recipient's store threw, return the same 500 as today so CrazyTel
  retries. Retries are safe: a recipient that already stored the text gets `duplicate` (the
  `@@unique([conversationId, externalId])` dedupe in `recordSmsMessage`), and `pushIncomingText`
  only runs for a newly stored row, so nobody gets a second push. Confirm that reading of
  `recordSmsMessage` before relying on it.
- **Pushes:** none to add. `recordSmsMessage` already pushes per `userId`, so each account's
  devices get their own push with their own preferences and sound.

### 8. Not in scope (don't change)

- `src/lib/public-url.ts` / `resolvePublicOrigin`. If you notice the resolved origin can differ
  between instances (a redirect probe that times out falls back to the un-redirected
  `APP_URL`), **report it and don't fix it here.**
- The sync, `/sms/check`, sending, the outbound path, the call-recordings webhook, the schema,
  and the mobile app.

## Verify

1. `npx tsc --noEmit` is clean. Run the existing tests, if any.
2. **Read-through check:** with `accountCode: null`, or no siblings, list each changed function
   and show it does exactly what it did before. Put this in your report.
3. **Read-only look at production data**, **only if I say yes when you ask.** List the connections
   with `accountCode = '570365'` (user email, `webhookToken` last 4 characters only, lines with
   `enabled/autoReceive/webhookRegistered`). Don't print tokens or API keys.
4. After deploy, I'll run this by hand:
   - turn Receive on in **one** account → no ⚠ in **all three** accounts;
   - with the apps closed, text a shared number → **all three** phones get a push within seconds,
     and **all three** delivery logs show `stored`;
   - wait past the next hourly self-heal (xx:00–xx:05 UTC) → still no ⚠;
   - turn Receive off in the account that owns the route → the other two still receive instantly,
     because the route was handed to a sibling;
   - a CrazyTel account with a single PRM connection behaves as before.

## Report back

1. A diff summary, per file.
2. The "unchanged without siblings" read-through from Verify 2.
3. Any assumption above that didn't match the code.
4. Anything you noticed in `resolvePublicOrigin`.
