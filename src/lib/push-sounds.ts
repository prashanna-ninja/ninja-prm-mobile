/**
 * Notification sounds — one per device, used for every push (texts, the tasks
 * summary, the test push).
 *
 * ⚠️ CONTRACT with the backend (docs/prompts/BACKEND-PUSH-SOUND.md). The ids
 * must match `PUSH_SOUND_IDS` in `ninja_prm/src/lib/push/sounds.ts`, the files
 * in `src/assets/sounds/<id>.wav` (made by scripts/convert-notification-sounds.mjs,
 * which checks this list) and the `sounds` array in app.json. For a device with
 * a sound set, the backend sends:
 * - `sound: "<id>.wav"`: iOS plays that bundled file;
 * - `channelId: "sound_<id>"`: Android 8+ plays that CHANNEL's sound and ignores
 *   `sound`. A channel's sound is fixed at creation, so there is one channel per
 *   sound (see `androidChannelFor`).
 *
 * `null` = the phone's default sound, on channel "default", which is exactly
 * what the app did before sounds existed.
 *
 * ⚠️ The "Star Wars" sounds are Lucasfilm's. They are fine for internal builds
 * only (the user decided this on 2026-11-01). Remove them here, in the backend
 * allowlist and in app.json before any store build.
 */

export type PushSoundCategory = "classic" | "themed";

export type PushSound = {
  id: string;
  name: string;
  category: PushSoundCategory;
  /** Bundled asset, for the preview in Settings. */
  asset: number;
};

export const PUSH_SOUND_CATEGORIES: { key: PushSoundCategory; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "themed", label: "Star Wars" },
];

export const PUSH_SOUNDS: PushSound[] = [
  { id: "classic_alert", name: "Alert", category: "classic", asset: require("@/assets/sounds/classic_alert.wav") },
  { id: "classic_plane_chime", name: "Plane Chime", category: "classic", asset: require("@/assets/sounds/classic_plane_chime.wav") },
  { id: "classic_car_beep", name: "Car Beep", category: "classic", asset: require("@/assets/sounds/classic_car_beep.wav") },
  { id: "classic_cartoon", name: "Cartoon", category: "classic", asset: require("@/assets/sounds/classic_cartoon.wav") },
  { id: "classic_corporate", name: "Corporate", category: "classic", asset: require("@/assets/sounds/classic_corporate.wav") },
  { id: "classic_ui_ping", name: "Ping", category: "classic", asset: require("@/assets/sounds/classic_ui_ping.wav") },
  { id: "classic_warning", name: "Warning", category: "classic", asset: require("@/assets/sounds/classic_warning.wav") },
  { id: "classic_warning_2", name: "Warning 2", category: "classic", asset: require("@/assets/sounds/classic_warning_2.wav") },
  { id: "classic_button", name: "Button", category: "classic", asset: require("@/assets/sounds/classic_button.wav") },
  { id: "themed_r2d2_squeaks_2", name: "R2-D2 Squeak", category: "themed", asset: require("@/assets/sounds/themed_r2d2_squeaks_2.wav") },
  { id: "themed_r2d2_squeaks_3", name: "R2-D2 Chatter", category: "themed", asset: require("@/assets/sounds/themed_r2d2_squeaks_3.wav") },
  { id: "themed_r2d2_squeaks_5", name: "R2-D2 Babble", category: "themed", asset: require("@/assets/sounds/themed_r2d2_squeaks_5.wav") },
  { id: "themed_r2d2_whistle_1", name: "R2-D2 Whistle", category: "themed", asset: require("@/assets/sounds/themed_r2d2_whistle_1.wav") },
  { id: "themed_r2d2_whistle_2", name: "R2-D2 Whistle 2", category: "themed", asset: require("@/assets/sounds/themed_r2d2_whistle_2.wav") },
  { id: "themed_saber_on", name: "Lightsaber On", category: "themed", asset: require("@/assets/sounds/themed_saber_on.wav") },
  { id: "themed_saber_off", name: "Lightsaber Off", category: "themed", asset: require("@/assets/sounds/themed_saber_off.wav") },
];

export function findPushSound(id: string | null | undefined): PushSound | null {
  if (!id) return null;
  return PUSH_SOUNDS.find((s) => s.id === id) ?? null;
}

/** Android channel id for a sound. `null` = the original "default" channel. */
export function androidChannelFor(id: string | null): string {
  return id ? `sound_${id}` : "default";
}
