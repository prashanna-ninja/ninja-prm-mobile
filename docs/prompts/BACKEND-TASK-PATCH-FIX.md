# Backend — fix the task PATCH data-loss bug

Run this in a **new Claude Code session opened in the backend repo**:

```
cd C:\Users\DELL\Projects_Advice_Ninja\ninja_prm
```

Context: [../implementation/BACKEND-CHANGES.md](../implementation/BACKEND-CHANGES.md) §10.
The mobile app can't trigger this bug — it never sends a date it didn't build itself — so this
is hardening, not a blocker for the Tasks screens.

---

## THE PROMPT

````
Fix a data-loss bug in PATCH /api/v1/tasks/[id]
(src/app/api/v1/tasks/[id]/route.ts). Work on a branch `fix/task-patch-transaction`.

THE BUG
When the body includes `contactIds`, the handler:
  1. deletes ALL of the task's TaskContact rows (prisma.taskContact.deleteMany),
  2. THEN parses `dueAt` inside the updateData builder, which throws
     "Invalid due date provided" on a bad value,
  3. with no transaction, and the catch returns 500.

So PATCH { "contactIds": ["<id>"], "dueAt": "not-a-date" } leaves the task with
NO contacts and reports failure. Any other throw from task.update does the same.

THE FIX
1. Parse and validate the whole body BEFORE any write. An invalid dueAt (or a
   year outside 1900–2100, matching POST) returns 400 with the same error
   messages POST uses — not 500.
2. Run the taskContact.deleteMany and the task.update in ONE
   prisma.$transaction, so a failure leaves the links untouched.
3. Extract the dueAt normalisation shared by POST and PATCH into one helper
   (it's duplicated today) — but keep its behaviour byte-for-byte: the
   calendar day in the user's timezone, stored as start-of-day UTC.

DO NOT CHANGE
- The response shape of any successful request.
- contactIds semantics: it still REPLACES the whole set.
- Anything about the unauthenticated path (separate work).

VERIFY — show real output
  # bad date with contacts → 400, and the links survive
  curl -s -X PATCH "$BASE/api/v1/tasks/$ID" -H "Cookie: $C" \
       -H 'Content-Type: application/json' \
       -d '{"contactIds":["'$CONTACT'"],"dueAt":"not-a-date"}' -w '\n%{http_code}\n'
  curl -s "$BASE/api/v1/tasks/$ID" -H "Cookie: $C" | jq '.contacts | length'   # unchanged

  # good request still works
  curl -s -X PATCH "$BASE/api/v1/tasks/$ID" -H "Cookie: $C" \
       -H 'Content-Type: application/json' \
       -d '{"status":"DONE"}' | jq '.status'                                  # "DONE"

  # the web app's task edit page still saves

WHEN YOU'RE DONE
  1. Files changed, one line each.
  2. The curl output above.
  3. What you ran vs. what you reasoned about.
````

---

## Mobile side after it ships

Nothing required. Optionally drop the "send only what changed" comments'
references to the bug in `src/types/task.types.ts` and `src/api/tasks.api.ts` —
but keep the diffing itself, which also stops the phone flattening the web's
rich-text descriptions.
