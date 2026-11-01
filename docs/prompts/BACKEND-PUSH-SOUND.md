# Backend prompt — per-device notification sound

> Paste everything below the line into a Claude Code session opened in `../ninja_prm`.
> Written 2026-11-01 from a read of `fast-message` (95a9df0), whose push code is the same as `main`.

---

## Goal

Let each mobile device choose **one notification sound** for all its pushes (SMS, tasks, test).
The phone can't pick the sound for a push that arrives while the app is closed, so the backend
has to put the sound in the push:

- **iOS** plays the file named in the push's `sound` field (the file is built into the app).
- **Android 8+** ignores `sound`. The sound belongs to a notification **channel**, and a
  channel's sound can never change after it is created. So the app creates **one channel per
  sound**, and the push has to name that channel in `channelId`.

A device that hasn't chosen a sound must get **exactly what it gets today**:
`sound: "default"`, `channelId: "default"`. Shipped app builds don't have the sound files or
channels, and they never send a sound, so they stay on the default.

## Ground rules

- Branch: `git switch main && git pull && git switch -c push-sound`. This is independent of
  `fast-message`, so it can deploy on its own. Stop and say so if the working tree isn't clean.
- Don't commit, don't push, don't deploy.
- Don't run `prisma migrate dev`. This DB is managed with `db push`. Before running it, show me
  the SQL it would run (`prisma migrate diff --from-schema-datasource prisma/schema.prisma
  --to-schema-datamodel prisma/schema.prisma --script`). It must be **one**
  `ALTER TABLE "PushToken" ADD COLUMN "sound" TEXT;` and nothing else. Wait for my OK.
- Keep the existing per-category preference behaviour exactly as it is, including the
  "PATCH only changes keys that were sent" rule in `changedPreferenceColumns`.

## Changes

### 1. `prisma/schema.prisma`: `PushToken`

Add an optional column after `prefTasks`:

```prisma
  /// Chosen notification sound id (see src/lib/push/sounds.ts). null = OS default.
  sound      String?
```

No default and no index. Run `prisma generate`.

### 2. New `src/lib/push/sounds.ts`: the allowlist

This is a contract with the app, in the same style as `categories.ts`. The app has a matching
list in `ninja_prm_mobile/src/lib/push-sounds.ts`; the two must stay in step.

```ts
/**
 * Notification sounds bundled into the mobile app.
 *
 * ⚠️ Contract. Mirrors `src/lib/push-sounds.ts` in ninja_prm_mobile. An id here
 * must exist as `<id>.wav` inside the app build AND as Android channel
 * `sound_<id>`, or iOS plays the default sound and Android files the push
 * under a fallback channel.
 */
export const PUSH_SOUND_IDS = [
  "classic_alert",
  "classic_plane_chime",
  "classic_car_beep",
  "classic_cartoon",
  "classic_corporate",
  "classic_ui_ping",
  "classic_warning",
  "classic_warning_2",
  "classic_button",
  "themed_r2d2_squeaks_2",
  "themed_r2d2_squeaks_3",
  "themed_r2d2_squeaks_5",
  "themed_r2d2_whistle_1",
  "themed_r2d2_whistle_2",
  "themed_saber_on",
  "themed_saber_off",
] as const;

export type PushSoundId = (typeof PUSH_SOUND_IDS)[number];

export function isPushSoundId(value: string): value is PushSoundId {
  return (PUSH_SOUND_IDS as readonly string[]).includes(value);
}

/** What goes into the Expo message for a device's stored sound. */
export function pushSoundFields(sound: string | null): { sound: string; channelId: string } {
  if (sound && isPushSoundId(sound)) {
    return { sound: `${sound}.wav`, channelId: `sound_${sound}` };
  }
  return { sound: "default", channelId: "default" };
}
```

`pushSoundFields` treats an unknown stored value as the default rather than throwing. That way,
removing a sound from the list later can't break delivery for devices still set to it.

### 3. Shared zod schema: `src/lib/push/api.ts`

Add a field schema next to `pushPreferencesSchema`:

```ts
// null = back to the OS default. undefined (key absent) = leave unchanged.
export const pushSoundSchema = z.enum(PUSH_SOUND_IDS).nullable();
```

### 4. `PATCH /api/v1/push/preferences`

The body becomes `{ token, preferences?: { sms?, tasks? }, sound?: <id> | null }`.

- `preferences` becomes optional, so the app can send a sound change on its own.
- `sound` key **absent** → don't touch the column. `sound: null` → set the column to null.
  Value not in the allowlist → 400 (zod already does this).
- Keep the `updateMany({ where: { token, userId } })` scoping. Run the update when there are
  preference columns **or** the `sound` key is present (check `"sound" in data`, not truthiness,
  because `null` is a real value here).
- Update the doc comment at the top of the file.

### 5. `POST /api/v1/push/register`

Accept an optional `sound` (same schema). A token can rotate or get re-registered, and the app
will send its saved sound on every register so the choice follows the device.

- **create**: `sound: data.sound ?? null`.
- **update**: set `sound` **only if the key was sent**. A register without `sound` (any
  shipped build) must not wipe a stored choice.

### 6. Sender: `src/lib/push/worker-core.ts`

- Add `sound: true` to the `pushToken.findMany` `select` (if it has one).
- In the message loop, replace the hard-coded `sound: "default"` and
  `channelId: "default"` with `...pushSoundFields(t.sound)`.

### 7. `src/lib/push/expo.ts`

Widen the type: `sound?: "default" | null | string;`. Expo's push API accepts a bundled file
name for iOS. Add a one-line comment saying so.

### 8. Anything else that builds an Expo message

Grep for `sendExpoPush`, `channelId` and `sound:` across `src/`. Any other place that builds a
message per device (the test push, the digest, a drain path) should use `pushSoundFields`
too, so a test push plays the chosen sound. If one sends without a token row to hand, leave it
on the default and tell me where it is.

## Verify

1. `npx tsc --noEmit` is clean. Run the existing push tests, if there are any.
2. Unit-check `pushSoundFields`: `null` → default/default; `"classic_alert"` →
   `classic_alert.wav` / `sound_classic_alert`; `"nope"` → default/default.
3. Against a local or preview server with a signed-in cookie:
   - `PATCH /api/v1/push/preferences` with `{ token, sound: "classic_alert" }` → 200, and the row
     shows `sound = classic_alert` with `prefSms`/`prefTasks` unchanged.
   - `{ token, sound: "bogus" }` → 400.
   - `{ token, sound: null }` → 200, and the column is null.
   - `{ token, preferences: { tasks: true } }` → 200, and `sound` is unchanged.
   - `POST /api/v1/push/register` without `sound` on an existing token → `sound` is unchanged.
4. Use `/api/v1/push/test` for a device with a sound set, and log or inspect the outgoing Expo
   payload. It should carry `sound: "classic_alert.wav"`, `channelId: "sound_classic_alert"`.

## Report back

Give me the diff summary, the `migrate diff` SQL, and the verify results. Also list anything in
step 8 you left on the default.
