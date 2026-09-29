# FEAT-02 — Contacts

**Status:** shipped 2026-09-28 (`4ee67a7`, `b5f972c`). Device-verified on iOS; Android
unverified pending a preview build.

Contacts was **not** in the v1 scope. It was added at the user's request on 2026-09-28, which
superseded CLAUDE.md rule 1 ("scope is Recordings"). This doc is written after the fact so the
feature stops being knowable only from the diff.

---

## 1. Scope

A phone-sized version of the web app's `/dashboard/contacts`. Read, create, archive, delete,
and log an interaction. **No editing of an existing contact** — `useUpdateContact` exists in the
API layer but nothing calls it yet.

| Route | Screen |
| ----- | ------ |
| `(app)/contacts/index` | List: search, relationship filter, infinite scroll, **＋** to create |
| `(app)/contacts/new` | Create form |
| `(app)/contacts/[id]` | Detail |

The tab sits third, between Recordings and Settings (`src/app/(app)/_layout.tsx`).

---

## 2. Screens

### List — `contacts/index.tsx`

- Header shows the live `totalCount` ("12 contacts"), and a round primary **＋** button.
- Debounced search (`use-debounced-value`) + a relationship-type chip row
  (`components/contacts/relationship-filter.tsx`).
- `useInfiniteContacts` with `placeholderData: (prev) => prev`, so switching a filter keeps the
  old list on screen instead of flashing a skeleton.
- All four states: skeleton, empty (distinguishes "no contacts yet" from "nothing matches your
  filters" via `hasFilters`), error + retry, data.

### Create — `contacts/new.tsx`

- `components/contacts/contact-form.tsx` owns the fields plus `EMPTY_CONTACT_FORM` and
  `toCreateInput`. `name` is the only required field.
- Likes/dislikes/tags use `components/contacts/chip-input.tsx`.
- On success: `router.replace` to the detail screen — **not** `push`. Backing out of a brand-new
  contact should land on the list, not on the form you just submitted.
- Cancelling a dirty form asks before discarding.

### Detail — `contacts/[id].tsx`

Top to bottom: avatar + relationship badge · tappable phone/email/location/company/birthday rows ·
About · Preferences (likes/dislikes) · Open tasks · Call recordings (tap through to the recording
detail) · Interactions + **Log** · Overview counters · Archive / Delete.

- `components/contacts/contact-overview.tsx` is the four-up counter grid. Interactions, tasks and
  key dates come from the detail response's `_count`; **recordings do not** — `_count` omits them,
  so the screen passes `totalCount` down from the call-recordings query.
- `InteractionsBlock` runs its **own** query rather than reading `data.interactions` from the
  detail response. The detail caps at 50 and doesn't refresh when you log something; the embedded
  array is used only as a first-paint fallback.
- `components/contacts/log-interaction-sheet.tsx` is a bottom sheet. `occurredAt` is always "now"
  and is not editable — on a phone you log an interaction right after it happens, and a date
  picker for "now" is three taps of friction for the common case.

---

## 3. Data

`src/api/contacts.api.ts`, `src/api/interactions.api.ts`, types in `src/types/contact.types.ts`.

| Hook | Endpoint |
| ---- | -------- |
| `useInfiniteContacts` | `GET /api/v1/contacts` |
| `useContact` | `GET /api/v1/contacts/[id]` |
| `useCreateContact` | `POST /api/v1/contacts` |
| `useUpdateContact` *(unused)* | `PATCH /api/v1/contacts/[id]` |
| `useArchiveContact` | `POST /api/v1/contacts/[id]/archive` · `/unarchive` |
| `useDeleteContact` | `DELETE /api/v1/contacts/[id]` |
| `useContactInteractions` | `GET /api/v1/contacts/[id]/interactions?take=20` |
| `useLogInteraction` | `POST /api/v1/contacts/[id]/interactions` |
| `useContactRecordings` | `GET /api/v1/contacts/[id]/call-recordings?take=5` |

Query keys: `qk.contacts.{all,list,detail,interactions,recordings}` in `src/lib/query-keys.ts`.
Every mutation invalidates `qk.contacts.all()`; logging an interaction also invalidates
`qk.contacts.detail(id)` because the Overview counter reads `_count.interactions`.

### Wire-format traps (all verified against the route code, 2026-09-28)

1. **`likes` / `dislikes` come back as JSON-ENCODED STRINGS**, e.g. `"[\"golf\"]"` — not arrays.
   You send arrays; the server encodes them for storage. `parseStringList()` in
   `contact.types.ts` decodes, and falls back to treating the value as one free-text entry
   because older rows hold plain text.
2. **The list `select` and the full row differ.** `ContactListItem` has no `archived` and no
   `updatedAt`. They're separate types here rather than one optimistic interface.
3. **An invalid `relationshipType` 500s server-side**, so `buildQuery` only ever sends a real
   enum value and omits the param entirely for "all".
4. **`POST /interactions` requires both `type` and `occurredAt`** and 400s without them.
5. **`DELETE` is a hard delete** with no undo — `useDeleteContact` carries a warning comment and
   the screen always confirms.
6. **Call recordings only.** There is no `fieldy-conversations` endpoint, and Plaud/Granola live
   on their own routes. Calls are the dominant source, so this covers the common case without
   three round-trips per contact.

---

## 4. Known gaps

- **You cannot assign a recording to a contact from the phone.** No endpoint exists — see
  [../implementation/BACKEND-CHANGES.md](../implementation/BACKEND-CHANGES.md) §7 and
  [../prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md](../prompts/BACKEND-ASSIGN-RECORDING-CONTACT.md).
- **No edit screen.** `useUpdateContact` is wired and unused.
- **Tasks are read-only here** — open tasks render on the detail screen, but there is no Tasks
  feature and no way to create or complete one.
- **Companies and tags can't be created** from the app; only picked if they already exist.
