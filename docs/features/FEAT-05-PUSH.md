# FEAT-05 — Push notifications

**Status:** app side built 2026-10-27 on `feat/push`. **Backend not built** (prompt:
[../prompts/BACKEND-PUSH.md](../prompts/BACKEND-PUSH.md)), **accounts not set up** (same file,
bottom), **needs a new native build**. Typecheck- and bundle-verified only.

Ported from Ninja CRM, where it's in production. Added at the user's request — the fifth scope
widening, and the first that isn't a tab.

---

## 1. What pushes

| Category | Event | Default | Tap opens |
| -------- | ----- | ------- | --------- |
| **Texts** (`sms`) | An incoming text on one of your CrazyTel numbers | **On** | That conversation |
| **Tasks due today** (`tasks`) | One summary at 8am your time, if anything is due or overdue | **Off** | Tasks |
| *(test)* | Settings → "Send a test notification" | — | The app |

Why Texts is on and Tasks is off is the CRM's reasoning, kept: a text is aimed at you and someone
may be waiting; a daily summary of work you already know about is what teaches people to swipe
notifications away unread. See `src/lib/push-categories.ts`.

## 2. How it works

```
backend event ─► push_delivery row ─► QStash ─► /api/push/worker ─► Expo ─► APNs / FCM ─► phone
                                                        └─► +15 min ─► /api/push/receipts ─► prune dead tokens
```

The app's job is only: get permission, get an Expo token, register it with the categories,
route a tap, and keep the badge honest.

## 3. The app side

| File | What |
| ---- | ---- |
| `providers/push-provider.tsx` | Permission, token, register/unregister, category switches. Ported from the CRM. |
| `components/notifications/push-bridge.tsx` | Tap → screen (running and cold start); icon badge = unread conversations |
| `lib/push-links.ts` | **The payload contract** and where each type leads |
| `lib/push-categories.ts` | **The category contract** and defaults |
| `api/push.api.ts` | `/api/v1/push/{register,unregister,preferences,test}` — fail quietly on 404 |
| `components/settings/notification-settings.tsx` | Settings → Notifications |
| `components/notifications/push-prompt-card.tsx` | One-time "Know the moment someone texts" card on Messages |
| `hooks/use-app-foreground.ts` | Copied from the CRM — re-reads the permission when you return from the Settings app |
| `src/assets/images/notification-icon.png` | Android status-bar icon, from `scripts/generate-icons.mjs` |

Edge cases carried over from the CRM, each one a real bug there:

- **`canAskAgain`, not `status`**, decides "blocked". Android lets you *dismiss* the prompt
  (denied but re-askable); treating that as blocked sent users to fix something that wasn't broken.
- **Coming back from the Settings app finishes the job.** If you asked, got blocked, and allowed it
  in Settings, push turns on when you return — no second tap.
- **Shared phone.** Settings are per-install, so they're stamped with the user who switched them on.
  A *different* user signing in starts with push off, rather than silently getting texts.
- **Sign-out unregisters first**, while the session can still authorise it.
- **Re-register every launch** — tokens rotate (reinstall, restore to a new phone).
- **The cold-start tap is cleared after use**, or every later mount would jump back to an old thread.
- **A push arriving while the app is open** refreshes Messages (or Tasks) immediately.

Differences from the CRM: our own `useSession()` (never `authClient.useSession()` — React 19
tearing), two categories instead of five, no notification centre (so the badge follows unread
texts), Android channel importance **HIGH** (heads-up banners for texts), and a test button.

## 4. Done criteria

- [x] Typecheck clean; Android bundle exports (6MB); the plugin writes the icon and colour into the
      Android manifest.
- [ ] Backend built and deployed (BACKEND-PUSH.md).
- [ ] Accounts: QStash + Expo token in Vercel; Firebase Android app + `google-services.json`; FCM
      key and APNs key in EAS.
- [ ] New dev builds, iOS and Android.
- [ ] On device: turn on → token registered → "Send a test notification" arrives.
- [ ] On device: text a CrazyTel number from another phone → push → tap opens that thread.
- [ ] On device: Texts switch off → no push, text still appears in Messages.
- [ ] On device: deny the prompt, allow in Settings, come back → push is on.
- [ ] On device: sign out, sign in as someone else → push is off for them.
- [ ] Uninstall, text again → the token is gone from `push_token` within ~15 minutes.

## 5. Known gaps

- No push for new call recordings or auto-generated tasks — listed for the backend to place.
- Only the Settings screen and the Messages card can turn push on.
