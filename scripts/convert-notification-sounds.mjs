#!/usr/bin/env node
/**
 * Converts the notification-sound masters into the files the app bundles.
 *
 *   node scripts/convert-notification-sounds.mjs
 *
 * Masters:  src/assets/notification-sounds/<category>/<original name>  (as supplied)
 * Output:   src/assets/sounds/<id>.wav                                 (bundled)
 *
 * Why every output is converted, not copied:
 * - iOS plays a notification sound only if it is uncompressed (linear PCM)
 *   in .wav/.aiff/.caf and under 30 seconds. The `.m4r` masters are AAC, which
 *   iOS silently replaces with the default sound.
 * - Android raw resources must be named [a-z0-9_] only (no spaces or hyphens),
 *   and the name is the id the backend sends (`<id>.wav`, channel `sound_<id>`).
 * - Mono 22.05 kHz 16-bit keeps 16 short sounds around 1.3 MB instead of 2.5 MB.
 *
 * ⚠️ The ids are a CONTRACT: they must match `src/lib/push-sounds.ts` and the
 * backend allowlist (`ninja_prm/src/lib/push/sounds.ts`). The script fails if
 * this list and push-sounds.ts disagree.
 *
 * Needs ffmpeg + ffprobe on PATH.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTERS = join(ROOT, "src/assets/notification-sounds");
const OUT = join(ROOT, "src/assets/sounds");
const MAX_SECONDS = 30;

/** id → master file (relative to MASTERS). */
const SOURCES = {
  classic_alert: "classic/Alert SFX.wav",
  classic_plane_chime: "classic/Beep Announcement Tone Plane 02.wav",
  classic_car_beep: "classic/Beep Veh Car Warning Tone.wav",
  classic_cartoon: "classic/Cartoon Play Warning Tone.wav",
  classic_corporate: "classic/Corporate Message Warning.wav",
  classic_ui_ping: "classic/UI_NOTIFICATION_Warning_08.wav",
  classic_warning: "classic/Warning.wav",
  classic_warning_2: "classic/Warning 2.wav",
  classic_button: "classic/Warning Button.wav",
  themed_r2d2_squeaks_2: "themed/r2d2-squeaks2.m4r",
  themed_r2d2_squeaks_3: "themed/r2d2-squeaks3.m4r",
  themed_r2d2_squeaks_5: "themed/r2d2-squeaks5.m4r",
  themed_r2d2_whistle_1: "themed/r2d2-whistle1.m4r",
  themed_r2d2_whistle_2: "themed/r2d2-whistle2.m4r",
  themed_saber_on: "themed/saberon.m4r",
  themed_saber_off: "themed/saberoff.m4r",
};

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.error) fail(`${cmd} not runnable (${result.error.message}) — is it on PATH?`);
  if (result.status !== 0) fail(`${cmd} ${args.join(" ")}\n${result.stderr}`);
  return result.stdout;
}

/* --- The ids must match the app's list ------------------------------------ */

const appList = readFileSync(join(ROOT, "src/lib/push-sounds.ts"), "utf8");
const appIds = [...appList.matchAll(/\bid:\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
const ids = Object.keys(SOURCES);
const missingInApp = ids.filter((id) => !appIds.includes(id));
const missingHere = appIds.filter((id) => !ids.includes(id));
if (missingInApp.length || missingHere.length) {
  fail(
    `id lists disagree — only here: [${missingInApp.join(", ")}], only in push-sounds.ts: [${missingHere.join(", ")}]`,
  );
}

/* --- Convert ---------------------------------------------------------------- */

mkdirSync(OUT, { recursive: true });
// Stale outputs (a renamed or removed id) would still be bundled by app.json.
for (const file of readdirSync(OUT)) {
  if (!ids.includes(file.replace(/\.wav$/, ""))) rmSync(join(OUT, file));
}

let total = 0;
for (const [id, rel] of Object.entries(SOURCES)) {
  if (!/^[a-z0-9_]+$/.test(id)) fail(`${id}: Android resource names allow [a-z0-9_] only`);
  const src = join(MASTERS, rel);
  if (!existsSync(src)) fail(`${id}: master missing — ${rel}`);

  const dest = join(OUT, `${id}.wav`);
  run("ffmpeg", [
    "-v", "error", "-y", "-i", src,
    "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le",
    "-map_metadata", "-1", dest,
  ]);

  const probe = run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration:stream=codec_name",
    "-of", "default=nw=1", dest,
  ]);
  const codec = /codec_name=(\S+)/.exec(probe)?.[1];
  const seconds = Number(/duration=([\d.]+)/.exec(probe)?.[1]);
  if (codec !== "pcm_s16le") fail(`${id}: expected pcm_s16le, got ${codec}`);
  if (!(seconds > 0 && seconds < MAX_SECONDS)) fail(`${id}: ${seconds}s — iOS needs under ${MAX_SECONDS}s`);

  const bytes = statSync(dest).size;
  total += bytes;
  console.log(`✓ ${id.padEnd(24)} ${seconds.toFixed(2)}s  ${(bytes / 1024).toFixed(0)} KB`);
}

console.log(`\n${ids.length} sounds, ${(total / 1024).toFixed(0)} KB total → src/assets/sounds/`);
