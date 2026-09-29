# FEAT-03 — Tasks (the to-do list)

**Status:** built 2026-09-29. **Typecheck- and bundle-verified only** — not yet run on a device.

Tasks was specced on the backend but had no screens. It was added at the user's request on
2026-09-29 ("we will be also starting todo and tasks") — the third explicit widening of the v1
scope, after Contacts (2026-09-28) and the Settings tab (2026-09-23).

"Todo" and "task" are the same thing: the PRM has one `Task` model. Recording action items
already become tasks automatically on the server (`ref/prm/src/lib/recordings/auto-tasks.ts` —
calls, Plaud, Granola and Fieldy), so this list fills itself as recordings sync.

---

## 1. Scope

| Route | Screen |
| ----- | ------ |
| `(app)/tasks/index` | List: search, To do / Done / All, priority filter, infinite scroll, **＋** |
| `(app)/tasks/new` | Create form. Takes `contactId` + `contactName` to arrive pre-linked. |
| `(app)/tasks/[id]` | Detail. Takes `fromContact` so Back returns to that contact. |
| `(app)/tasks/[id]/edit` | Edit form (adds Status). |

The tab sits fourth, between Contacts and Settings. **Five tabs is the ceiling** for a bottom
bar; a sixth section needs a different navigation shape.

Not in scope: tags, opportunities, rich-text notes, recurrence *generation* (the server stores
`repeatInterval` but nothing acts on it — the app shows and edits it, the same as the web).

---

## 2. Screens

### List — `tasks/index.tsx`

- **To do** (default) = `status=OPEN`, sorted `dueAt asc`, grouped under **Overdue · Today ·
  This week · Later · No due date**. Postgres sorts NULLs last on ascending, so the groups arrive
  in that order and the headings are derived row by row across pages — no client re-sort.
- **Done** = `status=DONE`; **All** = no status. Both sorted `updatedAt desc`, no groups.
- Priority chips (High / Normal / Low) are a separate toggle; tapping the active one clears it.
- The tick is **optimistic** (`useSetTaskStatus`): it flips in every cached list and the detail
  at once, then the refetch moves the row to the right filter.
- All four states, with the empty state distinguishing "nothing to do", "nothing matches" and
  "nothing done yet".

### Row — `components/tasks/task-row.tsx`

Tick · title (struck through when closed) · due label (red *Overdue*, orange *Today*) ·
repeat icon · linked contact ("Jane Doe +2") · priority pill for **High/Low only** — Normal is
nearly every task, and a grey pill on every row is noise · "From <recording>" when auto-generated.

### Detail — `tasks/[id]/index.tsx`

Tick + title + status/priority badges · due date and repeat · Notes · Related contacts (tap →
contact) · **From recording** (tap → the recording that generated it, via `sourceType`/`sourceId`)
· created/updated · **Cancel task** / **Reopen** and **Delete** (confirmed — it's a hard delete).

### Create / edit — `components/tasks/task-form.tsx`

Title (required) · Due · Priority · Status (edit only) · Related contacts · Repeat · Notes.

- **Due** is quick picks (No date / Today / Tomorrow / Next week = coming Monday) plus a
  **plain-JS month grid** (`due-date-field.tsx`). Not `@react-native-community/datetimepicker`:
  that's a native module — a new native build, per-platform behaviour — for a date-only field.
- **Contacts** open `contact-picker-sheet.tsx`: searchable, paged, multi-select, working on a
  draft so closing it is a real cancel. It reuses `useInfiniteContacts`, so it's usually cached.
- **Edit sends only what changed** (`toUpdateTaskInput`). See §3, traps 2 and 3.

### Contact detail integration

`contacts/[id].tsx`'s Open tasks block is now always shown, its rows open the task, and a
**＋ Task** link creates one pre-linked to the contact.

---

## 3. Data

`src/api/tasks.api.ts`, types in `src/types/task.types.ts`, helpers in `src/lib/tasks.ts`.

| Hook | Endpoint |
| ---- | -------- |
| `useInfiniteTasks` | `GET /api/v1/tasks` |
| `useTask` | `GET /api/v1/tasks/[id]` |
| `useCreateTask` | `POST /api/v1/tasks` |
| `useUpdateTask` | `PATCH /api/v1/tasks/[id]` |
| `useSetTaskStatus` | `PATCH /api/v1/tasks/[id]` with `{ status }` only — optimistic |
| `useDeleteTask` | `DELETE /api/v1/tasks/[id]` |

Query keys: `qk.tasks.{all,lists,list,detail}`. **Every task write invalidates both
`qk.tasks.all()` and `qk.contacts.all()`** — contact rows count tasks and the contact detail
embeds its open ones.

### Wire-format traps (verified against the route code, 2026-09-29)

1. **`dueAt` is date-only, and the server owns the timezone.** It reads the calendar day of
   whatever instant you send *in the user's profile timezone* and stores that day's start as UTC.
   The phone can't do tz math (no tz database; Hermes' Intl is unreliable on Android), so:
   **write local noon** of the chosen day (`dueAtForDay`) — noon survives any ±12h mismatch — and
   **read by rounding to the nearest local midnight** (`dueDay`). Never format `dueAt` with
   `formatDateCompact`: that shows "12:00 am" for today.
2. **`description` is HTML** — the web form is a rich-text editor and renders it with
   `dangerouslySetInnerHTML`. The app reads it with `htmlToText` and writes `<p>`-per-line HTML
   with `textToHtml` (bare newlines would collapse on the web). An **untouched** description is
   never sent back, so editing a task's title on the phone doesn't flatten its web formatting.
3. 🚨 **`contactIds` on PATCH replaces the whole set — and the server deletes the old links
   before it validates `dueAt`, outside a transaction.** A bad date after a contactIds change
   loses every link. The app can't trigger it (it only sends dates it built, and contactIds only
   when they changed), but the backend bug is real: `BACKEND-CHANGES` §10.
4. **An invalid `status`/`priority` query param 500s** — they're cast straight into the Prisma
   where-clause. `buildQuery` only sends real enum values.
5. **An invalid `status`/`priority` in a PATCH body is silently ignored**, not rejected.
6. **Two list envelopes.** `/tasks` is `{ tasks, totalCount, page, pageSize, totalPages }`;
   `/contacts/[id]/tasks` is `{ tasks, hasMore, totalCount }` with skip/take. The contact detail
   doesn't use either — it reads the embedded `tasks` (OPEN only, capped at 5).
7. **Embedded contacts differ by endpoint:** list/POST/PATCH give `id, name, image`; GET [id]
   adds `email, phone`. `TaskContactRef` marks the extras optional.
8. **`sourceType` includes `fieldy`**, even though the schema comment says `call | plaud | granola`.
9. **`DELETE` is a hard delete** with no undo. The detail screen always confirms, and offers
   Cancel task as the keep-it-on-record alternative.

---

## 4. Done criteria

- [x] Typecheck clean; Android bundle exports (5.8MB — icons imported from `@/lib/icons`).
- [ ] On device: tick/untick from the list and the detail; the row leaves To do after refetch.
- [ ] On device: create with a due date, confirm the **web** shows the same day.
- [ ] On device: create from a contact → pre-linked → Back lands on the contact.
- [ ] On device: edit only the title of a web-created task with formatted notes → the web
      formatting survives.
- [ ] On device: open "From recording" on an auto-generated task.
- [ ] Dark mode pass over the badges (literal light tints, same as the relationship badges).

## 5. Known gaps

- **No Home-screen summary** (open / overdue counts). Needs either `pageSize=1` count queries or
  a stats endpoint — see `BACKEND-CONTACTS-TASKS.md` Part C.
- **No tags** on tasks, and no tag filter.
- **Notes are plain text**; formatting written on the phone is paragraphs only.
