# Backend — Share transcript by email

Run this in a **new Claude Code session opened in the backend repo**:

```
cd C:\Users\DELL\Projects_Advice_Ninja\ninja_prm
```

Everything below the line is the prompt. It's self-contained.

> **Why this exists.** The mobile app can already hand a transcript to the OS
> share sheet as a `.txt`. What it *can't* do is what the PRM web app does:
> collect recipient addresses plus a note and have the **server** send a
> branded Ninja PRM email. That lives in `shareRecordingTranscript`, a **server
> action with no REST route** — so native has nothing to call.
>
> This is a small job: one route, wrapping an action that already works.

---

## THE PROMPT

````
Add a REST endpoint so the Ninja PRM mobile app can email a recording
transcript, the same way the web app's "Share transcript" dialog does.

Work on a branch `feat/share-transcript-api`. This is ADDITIVE — no existing
web behaviour changes.

────────────────────────────────────────────────────────────────────
READ FIRST
────────────────────────────────────────────────────────────────────

  src/app/actions/share-transcript.ts      shareRecordingTranscript — REUSE IT
  src/lib/recordings/share-transcript.ts   getShareableRecordingContent,
                                           parseRecipientEmails,
                                           validateRecipientEmails
  src/lib/send-transcript-share-email.ts   the branded email template
  src/lib/api-auth.ts                      requireApiAuth
  src/app/api/v1/recordings/[source]/[id]/route.ts   the shape to match

Everything needed already exists. You are writing a thin HTTP wrapper, NOT
new share logic, NOT a new email template.

────────────────────────────────────────────────────────────────────
THE ENDPOINT
────────────────────────────────────────────────────────────────────

  POST /api/v1/recordings/[source]/[id]/share

Body:
  {
    "recipients": "a@x.com, b@y.com",   // required; comma/semicolon/newline separated
    "note": "Thought you'd want this"   // optional
  }

Responses:
  200  { "success": true }
  400  { "error": "<message>" }   validation — return the helper's message VERBATIM
  401  { "error": "Unauthorized" }
  404  { "error": "This recording does not have a transcript to share yet." }
  502  { "error": "<message>" }   the email provider failed

Create `src/app/api/v1/recordings/[source]/[id]/share/route.ts`.

Non-negotiables:

- **Call `shareRecordingTranscript` — do not reimplement it.** It already
  parses and validates recipients, enforces the caps, scopes the lookup to the
  session user, and sends the email. Duplicating any of that guarantees drift
  from the web.

- **Validate `source`** against ["call","plaud","granola","fieldy"] → 400.

- **Map the action's `{ success:false, error }` to the right STATUS.** The
  action returns 200-shaped objects for every failure. Distinguish:
    · "does not have a transcript" → 404
    · anything from validateRecipientEmails / the note cap → 400
    · a send failure → 502
  Returning 200 with `success:false` would make the app show a success toast
  on a failed send.

- **`requireApiAuth()` THROWS, it does not return a NextResponse.** The
  `if (authResult instanceof NextResponse)` pattern used across the older v1
  routes is dead code, and those routes return 500 instead of 401 when
  unauthenticated (verified in production 2026-09-15). Wrap in try/catch and
  return a real 401, matching what the newer recordings routes do.

The limits already enforced by the action — don't re-add or change them:
  · at most 10 recipients      (validateRecipientEmails)
  · note at most 4,000 chars   (shareRecordingTranscript)
  · recipients deduped + lowercased, split on , ; or newline
  · first recipient goes in To:, the rest are CC'd

────────────────────────────────────────────────────────────────────
ONE THING TO DECIDE — RATE LIMITING
────────────────────────────────────────────────────────────────────

This endpoint sends email to arbitrary addresses on request. Ten recipients
per call, no cap on calls. That is a spam vector and a Resend reputation risk
in a way the web dialog partly mitigated by being behind a UI nobody scripts.

`/sign-in/magic-link` is already capped in src/auth.ts via
`rateLimit.customRules`. Add something comparable for this route — a small
per-user limit, e.g. 10 shares/hour — or tell me explicitly why not. Don't
silently ship it uncapped.

────────────────────────────────────────────────────────────────────
VERIFY — run these, show me the real output
────────────────────────────────────────────────────────────────────

Grab a session cookie from a signed-in browser, then:

  # happy path — send to yourself
  curl -s -X POST "$BASE/api/v1/recordings/call/$ID/share" -H "Cookie: $C" \
    -H "Content-Type: application/json" \
    -d '{"recipients":"you@example.com","note":"test"}' | jq

  # validation
  curl -s -X POST ".../share" -H "Cookie: $C" -H "Content-Type: application/json" \
    -d '{"recipients":""}'            -w '\n%{http_code}\n'   # 400
  curl -s -X POST ".../share" -H "Cookie: $C" -H "Content-Type: application/json" \
    -d '{"recipients":"not-an-email"}' -w '\n%{http_code}\n'  # 400, names the address

  # 11 recipients → 400 "up to 10 recipients"
  # a recording with NO transcript → 404
  # someone else's recording id → 404 (never 403 — don't confirm it exists)
  # no cookie → 401 (NOT 500)
  # /api/v1/recordings/bogus/$ID/share → 400

Confirm specifically:
  - the email actually ARRIVES (check the Resend dashboard, not just the 200)
  - the first recipient is in To: and the rest are CC'd
  - the note renders in the email when present, and the block is absent when not
  - the web app's own share dialog still works

────────────────────────────────────────────────────────────────────
WHEN YOU'RE DONE
────────────────────────────────────────────────────────────────────

  1. Files added/changed, one line each.
  2. The rate-limit decision and where it lives.
  3. The exact 400 message strings, so the app can be tested against them.
  4. Anything that behaved differently from this spec.
  5. What you verified by running vs. what you only reasoned about.
````

---

## After it ships

I'll add an **Email transcript** action to the recording detail screen: a
bottom sheet with a recipients field, an optional note, and Send — sitting
alongside the existing **Save audio** and **Copy transcript** buttons.

Two things that make it nicer, both free:

- **"Email it to myself"** as a one-tap default — `/api/v1/me` already returns
  the signed-in user's address, so the field can prefill.
- The **10-recipient** and **4,000-character** caps get enforced client-side
  too, so the user sees the limit before a round-trip.

The OS share sheet stays. They're different jobs: the sheet is *"get this file
into Drive/WhatsApp"*, this is *"send a client a branded transcript"*.

Related: [BACKEND-PHASE-0.md](BACKEND-PHASE-0.md) · the parked-share note in
[../IMPLEMENTATION-LOG.md](../IMPLEMENTATION-LOG.md).
