# Backend Phase 0 — paste-ready prompt

Run this in a **new Claude Code session opened in the backend repo**:

```
cd C:\Users\DELL\Projects_Advice_Ninja\ninja_prm
```

Everything below the line is the prompt. It is self-contained — the backend session does not need
this repo's docs.

> **Branch first.** The repo is on `main`. Ask it to work on `feat/mobile-api`.

---

## THE PROMPT

````
You are adding mobile support to the Ninja PRM Next.js app. A React Native (Expo) app is being
built against this backend and needs two things that don't exist yet: native magic-link auth, and
a REST surface for recordings. Everything here is ADDITIVE — no existing web behaviour changes.

Work on a new branch `feat/mobile-api`. Do PART A and PART B in order, verifying each before
moving on. Explain what you're doing as you go.

────────────────────────────────────────────────────────────────────────
CONTEXT YOU NEED FIRST
────────────────────────────────────────────────────────────────────────

Read these before writing anything:

  src/auth.ts                             Better Auth config
  src/lib/api-auth.ts                     requireApiAuth / getApiSession — USE THESE
  src/app/api/auth/[...all]/route.ts      already CORS/Origin-patched for mobile
  src/app/actions/recordings.ts           getUnifiedRecordings() — the merge logic. REUSE IT.
  src/lib/recordings-search-params.ts     parseUnifiedRecordingsSearchParams() — REUSE IT.
  src/app/actions/call-recordings.ts      getCallRecording(), getCallRecordingAudioUrl()
  src/app/actions/{plaud,granola,fieldy}.ts   per-source reads
  src/app/api/v1/call-recordings/[id]/audio/route.ts   existing audio route (the good pattern)
  src/app/api/v1/plaud-recordings/[id]/audio/route.ts  existing audio route (the PROBLEM one)
  src/lib/s3.ts                           getDownloadUrl() — presigned URLs
  src/lib/timezone.ts                     getUserTimezone / toUTC
  src/lib/webhook-secret.ts               existing HMAC pattern
  prisma/schema.prisma                    CallRecording / PlaudRecording / GranolaMeeting /
                                          FieldyConversation (~lines 660-1002)

Key facts:
- Recordings are read ONLY through server actions today. Native apps cannot call server actions,
  which is why this work exists.
- Four sources: call | plaud | granola | fieldy. Only `call` and `plaud` have audio.
- Everything is scoped per-user (userId / ownerId). There is no org sharing and no RBAC to apply.
- The mobile app's deep-link scheme is `ninjaprm://`.

────────────────────────────────────────────────────────────────────────
PART A — NATIVE MAGIC-LINK AUTH
────────────────────────────────────────────────────────────────────────

GOAL: a user taps the magic link in their email on their phone and lands INSIDE the Expo app,
signed in. The server must redirect to `ninjaprm://?cookie=<set-cookie>` so the app can capture
the session.

What's already right (don't change it):
- magicLink() is already configured with a 15-min TTL and a 3-per-60s rate limit.
- sendMagicLink passes the caller's `callbackURL` straight through, so the SAME email works for
  web and mobile with no change to the email template.
- trustedOrigins already reads and splits `process.env.BETTER_AUTH_TRUSTED_ORIGINS`, so trusting
  the app scheme is an ENV VALUE, not a code change.
- /api/auth/[...all]/route.ts already handles CORS preflight and injects an Origin header when a
  native client sends none.

A1. Install the plugin:
      pnpm add @better-auth/expo

A2. In src/auth.ts, add the expo() plugin and FIX THE PLUGIN ORDER:

      import { expo } from "@better-auth/expo";

      plugins: [
        expo(),          // ← ADD. Native clients + deep-link callbacks.
        admin({ ... }),  // unchanged
        magicLink({ ... }),  // unchanged
        nextCookies(),   // ← MOVE TO LAST. It is currently FIRST, which is wrong.
      ],

    ⚠️ nextCookies() must be the LAST plugin (Better Auth requirement). It is currently first.
    Moving it is correct but it touches the shared auth path, so you MUST re-test web login
    after this change — that is the one risky edit in this whole task.

A3. Add to .env (and tell me to set it on every deployed environment):

      BETTER_AUTH_TRUSTED_ORIGINS=ninjaprm://

    If the var is already set, APPEND `ninjaprm://` comma-separated — don't clobber it.

A4. Confirm these are set on whatever environment we'll test against, and tell me if any is
    missing:
      - NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL → the real HTTPS URL
      - BETTER_AUTH_SECRET
      - RESEND_API_KEY + a verified sender domain (or no magic-link email sends at all)

VERIFY PART A BEFORE CONTINUING:
  1. Web magic-link login still works end to end. This is not optional.
  2. This returns 200 and actually sends an email:
       curl -i -X POST "$BASE/api/auth/sign-in/magic-link" \
         -H "Content-Type: application/json" \
         -d '{"email":"you@example.com","callbackURL":"ninjaprm://"}'
  3. Tell me explicitly whether the verify redirect emits `ninjaprm://?cookie=...`. If the expo()
     plugin doesn't produce that shape, say so — the mobile app depends on that exact contract
     and I need to know before building against it.

────────────────────────────────────────────────────────────────────────
PART B — RECORDINGS REST API
────────────────────────────────────────────────────────────────────────

Four new routes under src/app/api/v1/recordings/. ALL of them:
  - guard with requireApiAuth() from src/lib/api-auth.ts
  - scope every query to session.user.id
  - return 404 (NOT 403) for a row that belongs to someone else — never confirm it exists
  - serialise Dates as ISO strings (Date objects don't survive JSON)

B1. GET /api/v1/recordings  →  src/app/api/v1/recordings/route.ts

  The unified, paginated, searchable, filterable list. This is the app's main screen.

  Query params (reuse parseUnifiedRecordingsSearchParams for all of these):
    page       default 1
    pageSize   default 20, CLAMP to max 50
    sortBy     date | title          default date
    sortOrder  asc | desc            default desc
    search     free text — the existing action already searches title, summary, transcript and
               (for calls) callNumber / receiverNumber
    source     all | call | plaud | granola | fieldy   default all

  ⚠️ REUSE getUnifiedRecordings() and parseUnifiedRecordingsSearchParams(). Do NOT reimplement
  the four-table merge. Web and mobile must never drift apart.

  Response:
    {
      items: [{
        id, source, title, occurredAt (ISO string), summary,
        durationSec, hasAudio, hasTranscript, isNew,
        contacts: [{ id, name, image }],
        category: { id, name, color } | null
      }],
      totalCount, countsBySource: { call, plaud, granola, fieldy },
      page, pageSize, sortBy, sortOrder, search, source
    }

  STRIP the `href` field — it's a web route, the app builds its own.

  ADD these four fields to UnifiedRecordingItem in src/app/actions/recordings.ts (the web list can
  ignore them; the phone needs them to avoid N extra round-trips per screen):

    durationSec: number | null
        call   → durationSec
        plaud  → Math.round(durationMs / 1000)
        granola/fieldy → derive from startAt/endAt when both exist, else null
        Add the needed columns to each select.

    hasAudio: boolean
        source === "call" || source === "plaud"

    hasTranscript: boolean
        transcript != null  (fieldy uses `content`)
        ⚠️ SELECT A BOOLEAN, NOT THE TRANSCRIPT TEXT.

    isNew: boolean
        contacts.length === 0   (the list is already unarchived-only)
        This mirrors the web's "New" badge in
        src/components/recordings/new-recording-indicator.tsx

  🚨 CRITICAL: do NOT select `transcript` in the list query. Transcripts are tens of KB each;
  twenty of them is a multi-megabyte response over mobile data.

B2. GET /api/v1/recordings/[source]/[id]  →  .../[source]/[id]/route.ts

  One handler, switch on source, reusing the existing per-source reads.

  - Validate `source` against ["call","plaud","granola","fieldy"] → 400 if not.
  - SANITISE actionItems into a real string[] HERE. It's `Json?` on all four models and is NOT
    guaranteed to be an array of strings — the web currently defends against it at every call
    site (see parseActionItems in src/components/call-recordings/call-recording-detail.tsx).
    Do it once, server-side, so no client ever has to.
  - Normalise contacts: calls have 0-1 (via contactId), the other three have 0-many (join table).
    Always return an array.

  Response:
    {
      id, source, title, occurredAt, endAt, durationSec,
      summary, transcript, actionItems: string[],
      archived, category, contacts: [{ id, name, image, email, phone }],
      hasAudio,
      details: { ...source-specific... }
    }

  details by source:
    call     → { callNumber, receiverNumber, sentiment, spam, noteCount }
    plaud    → { keyTopics: string[] }
    granola  → { attendees: [{name,email}], ownerName, webUrl, calendarEventTitle }
    fieldy   → { keywords: string[], speakers: string[], quotes: [{text,context}],
                 fieldyTasks, sharables }

B3. GET /api/v1/recordings/[source]/[id]/audio

  Always returns JSON with a PLAYABLE URL — never raw bytes:
    { url, mimeType, expiresInSec }

  🚨 THE IMPORTANT CONSTRAINT: the mobile app hands this URL to the native OS player
  (AVPlayer / ExoPlayer), which does NOT share the JS fetch stack and will NOT send our session
  cookie. The URL must be independently playable for a short window.

    call     → wrap the existing /api/v1/call-recordings/[id]/audio. It already returns a
               presigned S3 URL, which is exactly right. Add expiresInSec from the presign TTL.

    plaud    → THIS IS THE REAL WORK. The current route streams bytes behind the session cookie,
               so the native player gets a 401. Replace with a short-lived SIGNED proxy URL:
                 /api/v1/recordings/plaud/[id]/audio/stream?exp=<ts>&sig=<hmac>
               verified WITHOUT a session. Follow the HMAC pattern already in
               src/lib/webhook-secret.ts. Add a RECORDING_AUDIO_SIGNING_SECRET env var.
               The signed URL must not be forgeable and must not replay after exp.

    granola,
    fieldy   → 404 { error: "This recording has no audio" }

  If the signed proxy turns out to be more work than it's worth, STOP and tell me — there's a
  client-side fallback (download the bytes through the authed fetch, play from local cache) and
  I'd rather choose than have you guess. Either way the client contract stays { url, mimeType },
  so this can change later without touching the app.

B4. GET /api/v1/recordings/stats  →  src/app/api/v1/recordings/stats/route.ts

  Powers the app's Home screen. NOTHING like this exists — I checked /api/v1/dashboard and
  src/app/actions/dashboard.ts and neither touches any recording model.

  Response:
    {
      total: number,
      bySource: { call, plaud, granola, fieldy },
      thisWeek: number,          // occurredAt >= start of this week
      lastWeek: number,          // the preceding 7-day window (for a trend arrow)
      unassigned: number,        // unarchived AND zero linked contacts — the "New" count
      totalDurationSec: number   // null-safe sum; nulls count as 0, never NaN
    }

  Requirements:
  - Use the SAME predicate as the unified list: archived: false everywhere, plus spam: false for
    calls. If stats and list disagree, users notice instantly and stop trusting both.
  - 🚨 Compute week boundaries in the USER'S TIMEZONE, not UTC. User.timezone and
    src/lib/timezone.ts already exist. UTC makes "this week" wrong for every Australian user
    before ~10am.
  - Eight count() calls plus one duration aggregate in a single Promise.all. No new indexes needed.

────────────────────────────────────────────────────────────────────────
VERIFY — run these and show me the real output
────────────────────────────────────────────────────────────────────────

Grab a session cookie from a signed-in browser, then:

  curl -s "$BASE/api/v1/recordings?pageSize=5"                 -H "Cookie: $C" | jq
  curl -s "$BASE/api/v1/recordings?source=plaud&search=test"   -H "Cookie: $C" | jq '.totalCount, .countsBySource'
  curl -s "$BASE/api/v1/recordings?sortBy=title&sortOrder=asc" -H "Cookie: $C" | jq '.items[].title'
  curl -s "$BASE/api/v1/recordings/stats"                      -H "Cookie: $C" | jq
  curl -s "$BASE/api/v1/recordings/call/$ID"                   -H "Cookie: $C" | jq
  curl -s "$BASE/api/v1/recordings/call/$ID/audio"             -H "Cookie: $C" | jq
  curl -s "$BASE/api/v1/recordings/granola/$ID/audio"          -H "Cookie: $C" -o /dev/null -w '%{http_code}\n'   # expect 404
  curl -s "$BASE/api/v1/recordings/call/$ID"                                   -w '\n%{http_code}\n'             # expect 401
  curl -s "$BASE/api/v1/recordings/bogus/$ID"                  -H "Cookie: $C" -w '\n%{http_code}\n'             # expect 400

Confirm specifically:
  - the list response contains NO transcript text anywhere
  - durationSec / hasAudio / hasTranscript / isNew are present and correct per source
  - a recording id belonging to ANOTHER user returns 404, not 403
  - the presigned call-audio URL plays in a browser with NO cookie attached
  - web magic-link login still works

────────────────────────────────────────────────────────────────────────
KNOWN CAVEAT — flag it, don't fix it
────────────────────────────────────────────────────────────────────────

getUnifiedRecordings fetches up to MAX_FETCH = 500 rows PER SOURCE, merges in memory, sorts, then
slices the page. So deep pagination degrades and silently truncates past ~500 per source, and
sortBy:"title" only sorts the fetched window rather than the true global set.

That's acceptable for v1 (a phone user scrolls a few pages). Do NOT rewrite it as part of this
task. Just confirm you've seen it and note it.

────────────────────────────────────────────────────────────────────────
WHEN YOU'RE DONE
────────────────────────────────────────────────────────────────────────

Give me:
  1. Every file added or changed, one line each.
  2. Every new env var, and which environments still need it set.
  3. The exact redirect URL shape the magic-link verify produces for callbackURL=ninjaprm://
  4. Anything that behaved differently from this spec — I'm building a client against these exact
     contracts, so surprises are expensive.
  5. What you verified by actually running it vs. what you only reasoned about.
````

---

## After it's done

Bring these four answers back to the mobile repo:

| Answer | Unblocks |
| ------ | -------- |
| The deep-link redirect shape | Phase 3 (auth) — `use-auth-deep-link.ts` parses it |
| Real JSON from `GET /api/v1/recordings` | Phase 4 (`types/recording.types.ts`) |
| Plaud audio decision (signed URL vs. fallback) | Phase 8 (audio player) |
| The deployed HTTPS base URL | `.env` → `EXPO_PUBLIC_API_BASE_URL` |

Then tick Phase 0 in [../implementation/IMPLEMENTATION-PLAN.md](../implementation/IMPLEMENTATION-PLAN.md)
and log it in [../IMPLEMENTATION-LOG.md](../IMPLEMENTATION-LOG.md).
