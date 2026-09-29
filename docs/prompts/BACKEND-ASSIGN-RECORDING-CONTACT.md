# Backend prompt — assign a recording to a contact

**Run this in the `ninja_prm` (PRM web) repo, not the mobile repo.**

## Why

The mobile app can read recordings and read contacts, but cannot connect the two. Verified on
2026-09-29 by listing every non-GET handler under `src/app/api/v1`: all 54 of them. Every
`recordings` route is GET-only except `share` (POST), and `PATCH /contacts/[id]` has no
recording field. The web does this through a **server action**, which a React Native client
cannot call.

This traces back to the "v1 is read-only" decision in
[../implementation/BACKEND-CHANGES.md](../implementation/BACKEND-CHANGES.md) §7.

---

## The prompt

```
Add ONE endpoint to this repo:

    PUT /api/v1/recordings/[source]/[id]/contacts

`source` is one of call | plaud | granola | fieldy — the same union the existing
src/app/api/v1/recordings/[source]/[id]/route.ts already validates. Reuse that
validation rather than writing a second copy.

WRAP the existing server actions. Do not reimplement the queries — they already do
the ownership checks, the category resolution and the revalidation, and getting
those subtly wrong is how you leak another user's data.

  call     → assignCallRecordingContact(id, contactId | null)   src/app/actions/call-recordings.ts:247
  plaud    → setPlaudRecordingContacts(id, contactIds)          src/app/actions/plaud.ts:433
  granola  → setGranolaMeetingContacts(id, contactIds)          src/app/actions/granola.ts:290
  fieldy   → setFieldyConversationContacts(id, contactIds)      src/app/actions/fieldy.ts:486

⚠️ THE SHAPES DIFFER AND THAT IS THE WHOLE DIFFICULTY OF THIS TICKET.

  - `call` takes ONE contact (`contactId: string | null`), THROWS on failure, and
    also resolves and writes `categoryId` via resolveCategoryIdForContact().
  - the other three take MANY (`contactIds: string[]`) and RETURN
    `{ success: boolean; error?: string }` instead of throwing.

Pick ONE request body for all four sources so the client doesn't branch:

    { "contactIds": string[] }

and adapt inside the route:
  - call: reject with 400 if contactIds.length > 1 ("a call can only have one
    contact"); pass contactIds[0] ?? null; catch the throw.
  - others: pass the array straight through; map { success: false } to an error
    response.

Auth and status codes — match the existing v1 routes exactly:
  - use the same session helper the other v1 routes use (src/lib/api-auth.ts)
  - 401 when there is no session. NOT 500. This was a real bug fixed once already
    in docs/prompts/BACKEND-CONTACTS-TASKS.md — don't reintroduce it.
  - 404 (not 403) when the recording or a contact belongs to someone else, so we
    don't confirm that another user's id exists
  - 400 on a malformed body, a non-array contactIds, or an unknown source
  - 200 with the updated recording in the SAME shape as
    GET /api/v1/recordings/[source]/[id], so the app can drop the response
    straight into its TanStack Query cache without a second fetch

Then give me the curl commands to verify all four sources plus the 401 and 404 cases.
```

---

## Also worth asking for, while you're in there

Both are small and remove a known asymmetry in the mobile Contacts screen:

1. **`GET /api/v1/contacts/[id]/fieldy-conversations`** — `call-recordings`,
   `plaud-recordings` and `granola-meetings` all exist under `contacts/[id]/`; fieldy is the
   only one missing. Until it lands, a contact's detail screen can only ever show calls.
2. **Fix `PATCH /api/v1/tasks/[id]`** — it deletes the task's contact links *before* validating
   `dueAt`, with no transaction, so an invalid date silently loses the links. **Data loss.**

---

## What changes in the mobile app afterwards

Nothing until the endpoint is live. Then:

- `src/api/recordings.api.ts` — add `useAssignRecordingContacts(source, id)`, invalidating
  `qk.recordings.detail(source, id)`, `qk.recordings.all()` and `qk.contacts.recordings(...)`
  for both the old and new contact.
- `src/components/recordings/recording-actions.tsx` — an "Assign to contact" action.
- A contact-picker sheet, modelled on `components/contacts/relationship-filter.tsx`.
- Home's **Needs a contact** stat card can finally deep-link into a real work queue instead of
  just navigating to a filtered list.
