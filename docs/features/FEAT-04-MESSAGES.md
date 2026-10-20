# FEAT-04 — Messages (two-way SMS through CrazyTel)

**Status:** UI built 2026-10-18 **against a backend that doesn't exist yet.** Typecheck- and
bundle-verified only. Every screen will show an error until the routes in
[../prompts/BACKEND-SMS-API.md](../prompts/BACKEND-SMS-API.md) ship.

The phone version of the web's `/dashboard/messages`: one thread per person, linked to contacts,
sent from the user's own CrazyTel numbers. Added at the user's request on 2026-10-18 — the
**fourth** widening of v1 scope.

---

## 1. Navigation change (the user's call)

| Before | After |
| ------ | ----- |
| Tabs: Home · Recordings · Contacts · Tasks · **Settings** | Tabs: Home · **Messages** · Recordings · Contacts · Tasks (Messages moved to second on 2026-10-20) |
| Home header, top right: theme toggle | Home header, top right: **Settings gear** |
| Theme toggle on Home *and* in Settings | Theme toggle in Settings → Appearance only |

Settings is still a route in the `(app)` tab group, hidden with `href: null`, and now has a back
arrow (`router.replace("/")` — a hidden tab has no stack of its own to pop). Five tabs is still
the ceiling.

The Messages tab carries an **unread badge** (`useSmsUnreadTotal`: a one-row list request,
polled every 60s while the app is foregrounded, off when SMS isn't set up).

---

## 2. Screens

| Route | Screen |
| ----- | ------ |
| `(app)/messages/index` | Inbox |
| `(app)/messages/[threadId]` | One conversation. Params: `title` (paints the header before the fetch), `fromContact` (Back returns to that contact). |
| `(app)/messages/new` | Start a conversation |

### Inbox — `messages/index.tsx`

- Search ("names, numbers or messages" — server-side, ≥2 chars, like the web).
- One chip row: **All · Unread · Contacts · Unknown**, then one chip per CrazyTel line when there's
  more than one (the web's "All my numbers" dropdown). Tapping the active line clears it.
- Rows: avatar (contact, or a plain person glyph for unknown numbers), name or number, time,
  "You: …" preview, unread count, and the line(s) used — the web's grey footer.
- **Not polled** (an infinite query refetches every page). Re-read on focus, on pull-to-refresh
  (which first runs `POST /sms/check`, CrazyTel's cheap change check), and after any write.
- ⟳ runs the heavy `POST /sms/sync` — only on tap.
- `configured:false` → "SMS isn't set up — connect CrazyTel on the web". Connection setup is
  web-only by design.

### Thread — `messages/[threadId].tsx`

- Header: back · avatar + name (tap → contact, if linked) · **Call** · **Save contact** (unknown
  numbers only).
- An **inverted FlatList**: opens at the newest text with no scroll-to-end dance, and only renders
  what's on screen — a thread can hold 1,000 messages. Day dividers between days.
- Bubbles: outbound in brand orange (the web's blue is the one token we replace), inbound as cards.
  Footer: "8:39 am · Ben CLS LEGACY · ✓ Delivered". `contentAvailable:false` rows say so in italics
  instead of showing an empty bubble.
- **Optimistic send.** The bubble appears at once (faded, "Sending…"). It's dropped when the real
  row arrives (same text, outbound, created no earlier than a minute before — clock skew). A failed
  send stays as a red "Not sent · Tap to retry" bubble with the reason, and the retry reuses the
  **same `clientRequestId`**, so CrazyTel can't send it twice.
- **Polling is rationed**, because every poll is expensive server-side: the messages route loads
  the user's whole inbox to fill in `thread`, and there's no messages-only endpoint. So: only
  while the thread screen is **focused** and the app foregrounded; **15s while the conversation
  is live** (a text either way in the last 2 minutes — a send counts, via invalidation), **60s once
  it's quiet**; and an immediate re-read when you come back to it. Marked read on open, and again
  whenever a new text lands while you're looking.
- Composer: multiline input, **From <line>** chip (opens a picker when there's more than one line),
  and a live length / segment / Unicode counter (`lib/sms-segments.ts`, copied from Ninja CRM
  Mobile — one emoji cuts a segment from 160 to 70 characters, and segments are billed).
- **The tab bar is hidden** on this screen and the keyboard is measured
  (`hooks/use-keyboard-height.ts`, copied from Ninja CRM Mobile). CLAUDE.md gotcha 6.
- Sender-name threads ("QANTAS", "Telstra") get a notice instead of a composer — carriers can't
  deliver replies to a name.
- Saving a contact changes the thread id (`conv:…` → `contact:…`), so the screen `replace`s itself
  with the new id.

### New message — `messages/new.tsx`

One field: digits → "Text 0403 …"; anything else searches contacts and lists **one row per phone
number** they have. A From-line chooser shows when there's more than one line. `POST /sms/threads`
returns the existing thread if there already is one.

### Contact detail

Each of a contact's numbers is now its own row (see §4, bug), and each has a **Text** button when
SMS is set up — it opens (or creates) the thread with `fromContact`, so Back returns to the contact.

---

## 3. Data

`src/api/sms.api.ts`, types in `src/types/sms.types.ts`, helpers in `src/lib/sms.ts`,
`src/lib/sms-segments.ts`, `src/hooks/use-app-active.ts`, `src/hooks/use-keyboard-height.ts`.

| Hook | Endpoint (assumed — see the prompt) |
| ---- | -------- |
| `useSmsSetup` | `GET /api/v1/sms/setup` (staleTime 5 min) |
| `useInfiniteSmsThreads` | `GET /api/v1/sms/threads?search&filter&lineKey&page&pageSize` |
| `useSmsUnreadTotal` | same, `pageSize=1`, reads `unreadTotal` |
| `useSmsThreadMessages` | `GET /api/v1/sms/threads/:threadId/messages` — polled 15s live / 60s quiet, focused only |
| `useMarkSmsThreadRead` | `POST /api/v1/sms/threads/:threadId/read` |
| `useSendSms` | `POST /api/v1/sms/send` |
| `useStartSmsThread` | `POST /api/v1/sms/threads` |
| `useLinkSmsThread` | `POST /api/v1/sms/threads/:threadId/link-contact` |
| `useCheckForNewTexts` | `POST /api/v1/sms/check` |
| `useSyncSmsHistory` | `POST /api/v1/sms/sync` |

Query keys `qk.sms.{all,setup,unread,threadLists,threads,messages}`. Linking a contact also
invalidates `qk.contacts.all()` (it can create a contact, or add a number to one).

**threadIds contain a colon** (`contact:abc`) and are always `encodeURIComponent`ed in paths.

Polling is gated on `useAppActive()` (AppState), so a backgrounded phone stops hitting the server.

---

## 4. Found along the way

🐛 **Contact detail showed `phone` raw.** The PRM stores it as a JSON-encoded list
(`["0403 656 153"]`) — the same trap as likes/dislikes (FEAT-02 §3) — so the screen printed the
brackets and dialled them. Now parsed with `parseStringList`, one row per number, and the `tel:`
link strips everything but digits and `+`. Messages' Save contact writes this format too, so it
would only have got more common.

---

## 5. Done criteria

- [x] Typecheck clean (with regenerated route types); Android bundle exports (5.9MB).
- [ ] **Backend shipped**, and every type in `sms.types.ts` checked against real JSON.
- [ ] On device: inbox filters, search, line chips; unread badge appears and clears.
- [ ] On device: send, see "Sending…" → real bubble; kill the network mid-send → "Not sent" →
      retry → **arrives once**.
- [ ] On device: keyboard on **both platforms** — composer sits on top of it, no gap, no overlap.
- [ ] On device: Save contact (new + existing) → thread re-keys → contact shows the number.
- [ ] On device: contact → Text → thread → Back lands on the contact.
- [ ] On device: Settings gear on Home → Settings → back; theme still switches.

## 6. Known gaps

- **No push notifications** for incoming texts — needs Expo push tokens stored server-side and a
  send from the CrazyTel webhook. Separate backend work; ask first.
- **No Texts block on contact detail** (`GET /contacts/:id/sms` is in the prompt but unused) — the
  Text button covers the common case.
- **No CrazyTel setup** on the phone, by design.
