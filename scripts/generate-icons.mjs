/**
 * Regenerate the app icon, splash mark and Android adaptive-icon foreground
 * from the master logo.
 *
 *   node scripts/generate-icons.mjs
 *
 * Why this is a script and not a one-off: the sizing rules below are not
 * obvious, and getting them wrong produces bugs that only surface after a
 * 20-minute native build (blank icons, circle-cropped splashes).
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "ref/prm/public/logo.png");
const OUT = path.join(ROOT, "src/assets/images");
const BRAND = { r: 255, g: 137, b: 0 }; // #ff8900
const SIZE = 1024;

/**
 * Mark width as a fraction of the canvas.
 *
 * ICON 0.76 — matches ninja_crm_mobile's icon (measured at 75.5%), whose icon
 *   reads cleanly on a home screen. Bigger is sharper: at 66% the strokes had
 *   ~15% fewer pixels once iOS scaled the icon to ~60pt, and it looked soft.
 *   iOS icons are corner-rounded, never circle-masked, so this is safe.
 *
 * SPLASH/ADAPTIVE 0.52 — these ARE circle-masked (Android 12+ splash and
 *   adaptive launcher icons both mask to ~2/3 of the canvas), so the mark's
 *   DIAGONAL must stay inside that circle. The script asserts this below.
 */
const ICON_PCT = 0.76;
const MASKED_PCT = 0.52;

/** The source has a 1px stray column on its right edge; crop it off. */
async function cleanSource() {
  const meta = await sharp(SRC).metadata();
  const inset = Math.max(1, Math.round(meta.width * 0.001));
  return sharp(SRC)
    .extract({ left: 0, top: 0, width: meta.width - inset, height: meta.height })
    .toBuffer();
}

async function render({ name, widthPct, opaque }) {
  const source = await cleanSource();
  const meta = await sharp(source).metadata();

  const markW = Math.round(SIZE * widthPct);
  const markH = Math.round((meta.height / meta.width) * markW);

  // The source is ~16600px wide, so this is a >20x downscale. Lanczos keeps
  // it clean but softens edges; a light sharpen restores the crispness that
  // matters once iOS scales the icon down again on device.
  const mark = await sharp(source)
    .resize({ width: markW, height: markH, kernel: "lanczos3" })
    .sharpen({ sigma: 0.7 })
    .toBuffer();

  let pipeline = sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: opaque ? { ...BRAND, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: mark, gravity: "center" }]);

  // Flatten so every pixel is opaque, but KEEP the alpha channel — the sibling
  // apps whose iOS icons render correctly all ship 4-channel PNGs.
  if (opaque) pipeline = pipeline.flatten({ background: BRAND });

  const out = path.join(OUT, name);
  await pipeline.png({ compressionLevel: 9 }).toFile(out);

  const written = await sharp(out).metadata();
  const diagonal = Math.round(Math.hypot(markW, markH));
  const safeCircle = Math.round(SIZE * (2 / 3));

  if (!opaque && diagonal > safeCircle) {
    throw new Error(
      `${name}: mark diagonal ${diagonal} exceeds the ${safeCircle}px circle mask — it will be cropped`,
    );
  }
  if (opaque && !(await sharp(out).stats()).isOpaque) {
    throw new Error(`${name}: has transparent pixels — iOS icons must be opaque`);
  }

  console.log(
    `${name.padEnd(20)} ${written.width}x${written.height} ch=${written.channels}` +
      `  mark ${markW}x${markH} (${(widthPct * 100).toFixed(0)}%)` +
      (opaque ? "  opaque" : `  diag ${diagonal}/${safeCircle} fits`) +
      `  ${(fs.statSync(out).size / 1024).toFixed(1)}KB`,
  );
}

await render({ name: "icon.png", widthPct: ICON_PCT, opaque: true });
await render({ name: "splash-icon.png", widthPct: MASKED_PCT, opaque: false });
await render({ name: "adaptive-icon.png", widthPct: MASKED_PCT, opaque: false });
console.log("\nDone. Native change — rebuild with `eas build` to see it on device.");
