# FEAT-05 — Push notifications

**Status 2026-10-30: live, working on Android** (user-confirmed on a dev build). iOS not yet
checked on a device. Backend deployed (ninja_prm PR #9); prompt and account setup:
[../prompts/BACKEND-PUSH.md](../prompts/BACKEND-PUSH.md).

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

## 3b. Notification sound (added 2026-11-01)

One sound per device, used for every push. Settings → Notifications → **Sound** (always visible, even with push off or on a simulator; the choice is saved locally and sent on the next register) opens a sheet:
"Phone default", then **Classic** (9) and **Star Wars** (7). Tapping one plays a preview
(`expo-audio`, heard even with the silent switch on) and saves it; the tick moves only once the
server has it, and a failure restores the previous sound.

- **Files:** masters in `src/assets/notification-sounds/` (as supplied) → `node
  scripts/convert-notification-sounds.mjs` → `src/assets/sounds/<id>.wav` (mono 22 kHz 16-bit PCM,
  1.1 MB total; the script checks iOS's rules — PCM, under 30s — and that its id list matches
  `src/lib/push-sounds.ts`). `app.json` → `expo-notifications` → `sounds` bundles them.
- **Contract** (`src/lib/push-sounds.ts` ↔ backend `src/lib/push/sounds.ts`): the backend sends
  `sound: "<id>.wav"` (iOS) and `channelId: "sound_<id>"` (Android); `null` = `"default"` both.
  Ids are snake_case because Android raw resources allow `[a-z0-9_]` only.
- **Android channels:** "default" always exists; the chosen sound's channel is created *before*
  the PATCH, and other `sound_*` channels are deleted only after the server accepted it (on a
  sound change, and after each successful register). A push to a deleted channel would land in a
  low-importance fallback channel.
- **Storage:** SecureStore `ninjaprm_push_sound`; sent on every register (a reinstall/new token
  carries it), PATCHed alone on change. Not reset by the ownership guard — it's a device setting.
- ⚠️ Star Wars sounds are Lucasfilm's: internal builds only. Remove from both lists + app.json
  before a store build.
- Needs a **new native build** (sounds are native resources).

## 3c. Clearing a thread's notifications (added 2026-11-03)

App-only, iOS and Android, no backend change. While a Messages thread is on screen with the app
in front (`useThreadNotifications` in `[threadId].tsx`, logic in `src/lib/push-dismiss.ts`):

- its delivered notifications are removed from the lock screen / notification centre —
  `getPresentedNotificationsAsync()` filtered on `data.type === "sms"` + `data.threadId`, then
  `dismissNotificationAsync()`. Runs on open, on returning to the app, and on each new message;
- a push for that thread shows **no banner** (the foreground handler checks `isViewingThread`).

⚠️ Matches every id the thread can have — route param, `thread.id`, `contact:<contactId>`,
`conv:<conversationId>` per phone — because saving a number to a contact changes the thread id
and older notifications carry the old one. Tasks notifications are untouched.

## 4. Done criteria

- [x] Typecheck clean; Android bundle exports (6MB); the plugin writes the icon and colour into the
      Android manifest.
- [x] Backend built and deployed (BACKEND-PUSH.md).
- [x] Accounts: QStash + Expo token in Vercel; Firebase Android app + `google-services.json`; FCM
      key in EAS. (APNs key: unconfirmed until iOS is tested.)
- [x] New dev build, Android. [ ] iOS.
- [x] On device (Android): turn on → push arrives. [ ] Same on iOS.
- [ ] On device: text a CrazyTel number from another phone → push → tap opens that thread.
- [ ] On device: Texts switch off → no push, text still appears in Messages.
- [ ] On device: deny the prompt, allow in Settings, come back → push is on.
- [ ] On device: sign out, sign in as someone else → push is off for them.
- [ ] Sound (needs backend `push-sound` deployed + new build): pick a sound → test push plays it
      with the app closed, iOS and Android; back to "Phone default" → default sound; Android
      system settings show one `Ninja PRM · <name>` channel, not sixteen.
- [ ] Clearing (iOS + Android): two texts arrive with the app closed → open that thread → both
      leave the notification centre; other threads' notifications stay. With the thread open, a
      new text shows in the thread with no banner; with another screen open, it still banners.
- [ ] Uninstall, text again → the token is gone from `push_token` within ~15 minutes.

## 5. Known gaps

- No push for new call recordings or auto-generated tasks — listed for the backend to place.
- Only the Settings screen and the Messages card can turn push on.
