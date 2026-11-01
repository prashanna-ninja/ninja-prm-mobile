# Backend prompt — fast per-thread SMS feed (`GET /api/v1/sms/threads/[threadId]/feed`)

> Paste everything below the line into a Claude Code session opened in `../ninja_prm`.
> Written 2026-10-30 from measurements against production and a read of `main`.

---

## Goal

Add a **new** endpoint that lets the mobile app open a conversation with only its latest messages,
page older ones on scroll, and poll for **only what changed**. Leave
`GET /api/v1/sms/threads/[threadId]/messages` **exactly as it is** — shipped app builds call it
and must keep working. The web inbox (`messages-page-client.tsx`) is out of scope; don't touch it.

Don't commit, don't push, don't run `prisma migrate dev` (this DB is managed with `db push`).

## Why (measured 2026-10-30, signed in, production)

- `GET …/messages` returns the **whole conversation** (`take: 1000`) on every call, and the app
  polls it every 10s while a thread is open. Biggest thread: **157 KB per poll**, ~0.4s extra
  download over a small one.
- Each call also does far more DB work than it needs. Count the round trips in the current route:
  1. `requireApiAuth()` — Better Auth `getSession` + `prisma.user.findUnique`
  2. `getSmsThreadMessages()` → `requireSmsAccount()` → `requireAuth()` → `getServerSession()`
     (`getSession` **again** + `user.findUnique` + possibly `session.findUnique`) →
     `getSmsAccount()` (`crazytelConnection.findUnique` + decrypt) → `getThreadConversations()` →
     the message query
  3. `getSmsThreads()` → `requireSmsAccount()` **a third time**, then the `DISTINCT ON` scan of
     **every** message the user has, a `findMany` of every conversation, a `groupBy` — all to
     pick out this one thread's row.
- Every request already pays ~0.45s just reaching the function (Vercel `iad1`; that's a separate
  problem — don't add `preferredRegion` in this task, the DB has to move with it).

So the new endpoint should: resolve the session and SMS account **once**, never call
`getSmsThreads()`, and return as few messages as the caller asked for.

## The endpoint

`GET /api/v1/sms/threads/[threadId]/feed` — `threadId` is the existing `contact:<id>` /
`conv:<id>` format, URL-encoded (decode with the existing `decodeThreadId`).

Three modes, chosen by query params. `before` and `changedSince` are mutually exclusive (400 if
both).

| Mode | Params | Returns |
| ---- | ------ | ------- |
| **Open** | `limit` (default 50, max 200), `includeThread=1` | The latest `limit` messages, plus this thread's row |
| **Older** | `before=<messageId>`, `limit` | The `limit` messages before that one |
| **Changes** | `changedSince=<cursor>` | Messages **created or updated** after the cursor (max 200) |

### Response

```ts
type SmsFeedResponse = {
  /** Only when includeThread=1. Same shape as a GET /sms/threads row (SmsThreadListItem). null when the
   *  thread has no texts on a synced line — same meaning as the existing route. */
  thread?: SmsThreadListItem | null;
  /** Oldest first, like the existing route. Same fields as SmsMessageItem PLUS updatedAt. */
  messages: (SmsMessageItem & { updatedAt: string })[];
  /** Open/Older: whether anything exists before the first returned message. Omitted in Changes mode. */
  hasOlder?: boolean;
  /** Pass back as changedSince on the next poll. ISO string. See "Cursor" below. */
  cursor: string | null;
  /** Changes mode only: true when more than 200 rows changed — the app should re-open instead. */
  reset?: boolean;
};
```

Errors: reuse `smsErrorResponse` so codes match the other SMS routes — 401 unauthenticated,
404 unknown thread (`not_found`), 400 for bad params (`invalid`: non-numeric/out-of-range
`limit`, unparseable `changedSince`, `before` id not in this thread, both `before` and
`changedSince`).

Add `Cache-Control: private, no-store`.

### Which messages

Exactly the existing visibility rule from `getSmsThreadMessages`: messages in **all** of the
thread's conversations (`getThreadConversations` — a contact thread merges several numbers),
**only on synced line keys** (`syncedLineKeys(account)`), with `peerDisplay` from the
conversation. A message on an unsynced line must never appear in any mode.

- **Open:** `orderBy createdAt desc, id desc`, `take: limit + 1` → `hasOlder` = got more than
  `limit`; return the first `limit`, reversed to oldest-first.
- **Older:** look up `before`'s `createdAt` (it must belong to this thread's conversations, else
  400), then `where (createdAt, id) < (thatCreatedAt, thatId)` — i.e.
  `OR: [{ createdAt: { lt } }, { createdAt: equal, id: { lt } }]` so same-millisecond rows aren't
  skipped or duplicated — same ordering, `take: limit + 1`.
- **Changes:** `where updatedAt > (cursor − 5 seconds)`, `orderBy updatedAt asc`, `take: 201` →
  `reset: true` if 201 came back (return no messages in that case). See "Cursor" for the overlap.

`updatedAt` already exists on `SmsMessage` (`@updatedAt`), so Changes catches **new** texts and
**changed** ones — a sent text going SENDING → DELIVERED/FAILED, a CDR-only row whose body arrives
later (`contentAvailable` / `bodyTruncated` flipping). Filtering on `createdAt` would miss both;
don't.

### Cursor

- The cursor is **the largest `updatedAt` among the rows this response looked at**, taken from the
  database — never the phone's clock and never `new Date()` on the server (a message inserted by a
  slow transaction can carry an earlier timestamp than "now").
- Open: largest `updatedAt` among the returned rows. Older: return the cursor unchanged — echo
  nothing new (`cursor: null` is fine; the app keeps its own). Changes: largest `updatedAt` among
  returned rows, or **the incoming cursor unchanged** when nothing changed.
- The **5-second overlap** (`updatedAt > cursor − 5s`) covers rows committed late with a slightly
  older timestamp. It means a poll can return rows the app already has; the app merges by `id`,
  so that's harmless. Do not remove it to "save bytes".
- Deleted messages aren't reported. Nothing deletes individual SMS rows today; if that changes,
  this needs a tombstone — note it in a comment, don't build it.

### The thread row, for this thread only

`includeThread=1` must produce **the same object** `getSmsThreads()` produces for this thread,
without building the inbox. Extract the per-thread assembly that's currently inline in
`getSmsThreads()` (the `for (const row of rows)` block: phones, replyPhone, replyLineKey, canReply,
lineKeys, lastDirection, lastMessageAt, lastMessagePreview, unreadCount) into a helper that both
use, and feed it:

- the thread's conversations (already loaded for the messages),
- their latest synced-line message — the same `DISTINCT ON ("conversationId")` query but
  `WHERE m."conversationId" = ANY(<these ids>)` instead of every conversation the user has,
- their line keys — the same `groupBy` restricted to these ids.

Keep `getSmsThreads()`'s output **byte-identical** after the refactor (it feeds the web inbox
and the list route). Same `null` rule as the existing route: if none of the conversations has a
synced-line message **and** none is message-less, `thread` is `null`.

### Do the auth and account work once

The new route should do: `requireApiAuth()` once → the SMS account once → conversations →
messages (→ thread row only when asked). Don't go through `requireSmsAccount()` /
`requireAuth()` again from inside helpers. Concretely: add account-taking variants of the helpers
you need (e.g. `loadThreadMessages(account, threadId, opts)`), have the existing exported
functions call them after their own `requireSmsAccount()`, and call the variants from the new
route. Resolve the account with `getSmsAccount(session.user.id)`; a missing account is the existing
`not_configured` SmsError.

Run the independent queries together (`Promise.all`) where one doesn't need the other's result
(e.g. Open mode's message query and the thread-row queries both only need the conversation ids).

### Index

Add `@@index([conversationId, updatedAt])` to `SmsMessage` for the Changes query. It's purely
additive. Show me the SQL `db push` would run before applying it (`prisma migrate diff` from the
live database to the schema, with `--script` — use the flag names this Prisma 7 setup accepts) — it
must be a single `CREATE INDEX`. If it shows anything else, stop and tell me.

### Don't

- Don't change `GET …/messages`, `GET /sms/threads`, or any response shape the app already reads.
- Don't change the mark-read, send, link or sync routes. (A send still invalidates; the next
  Changes poll picks up its row.)
- Don't add websockets/SSE.

## Verify

1. `tsc` and `next build` pass.
2. **Refactor safety:** for 3+ threads (a contact thread with 2+ numbers, a `conv:` thread, a
   message-less just-started thread), the new helper's thread row deep-equals the row
   `getSmsThreads()` returns, and `GET /sms/threads` output is unchanged before/after.
3. **Open:** a thread with >50 messages → 50 messages, oldest first, `hasOlder: true`, and they
   equal the last 50 of `GET …/messages` for the same thread (minus `updatedAt`).
4. **Older:** paging with `before` back to the start reproduces the full `GET …/messages` list
   exactly — no gaps, no duplicates — including two messages with the same `createdAt`.
5. **Changes:** with the cursor from Open, immediately poll → empty `messages`, same cursor.
   Insert a new inbound row → it comes back. Update an existing row's `status` → it comes back.
   A row on an **unsynced** line → never comes back.
6. 401 signed out, 404 for an unknown `contact:`/`conv:` id, 400 for each bad-param case.
7. **Timing**, against the deployed preview with a real session cookie, 5 runs each: the existing
   `…/messages` vs `…/feed?limit=50&includeThread=1` vs `…/feed?changedSince=<cursor>`, on the
   biggest thread. Report time-to-first-byte and bytes. Expect Changes to be a few hundred bytes.
8. List the files changed, and anything you did differently from this prompt and why.
