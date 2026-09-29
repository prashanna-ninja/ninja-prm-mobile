/**
 * Regenerate the app icon, splash mark and Android adaptive-icon foreground
 * from the master logo.
 *
 *   node scripts/generate-icons.mjs
 *
 * Why this is a script and not a one-off: the sizing rules below are not
 * obvious, and getting them wrong produces bugs that only surface after a
 * 20-minute native build (blank icons, circle-cropped splashes).
 *
 * THE MASTER IS `src/assets/images/icon.png` — hand-authored, white mark on a
 * flat orange ground. It used to be `ref/prm/public/logo.png`, but the icon's
 * wordmark was redrawn by hand on 2026-09-29 (bigger PRM, different face) and
 * the web logo no longer matches. Re-point this at the web logo only if the
 * two are brought back into sync.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src/assets/images");
const MASTER = path.join(OUT, "icon.png");
const BRAND = { r: 255, g: 137, b: 0 }; // #ff8900
const SIZE = 1024;

/**
 * Mark width as a fraction of the canvas.
 *
 * ICON 0.76 — matches ninja_crm_mobile's icon (measured at 75.5%), whose icon
 *   reads cleanly on a home screen. Bigger is sharper: at 66% the strokes had
 *   ~15% fewer pixels once iOS scaled the icon to ~60pt, and it looked soft.
 *   iOS icons are corner-rounded, never circle-masked, so this is safe.
 *   The hand-drawn master already sits at 76.1%, so this is a no-op re-crop.
 *
 * SPLASH/ADAPTIVE 0.52 — these ARE circle-masked (Android 12+ splash and
 *   adaptive launcher icons both mask to ~2/3 of the canvas), so the mark's
 *   DIAGONAL must stay inside that circle. The script asserts this below.
 *   Kept at 0.52 across the wordmark redraw so the splash mark renders at the
 *   width it always has; the new art is simply shorter, which buys headroom.
 */
const ICON_PCT = 0.76;
const MASKED_PCT = 0.52;

/**
 * Lift the white mark off its orange ground into a transparent PNG.
 *
 * The master is a flat two-colour image: every pixel is `a` parts white over
 * `1 - a` parts background. Blue has the widest spread between the two
 * (bg 22 → white 255), so it recovers `a` with the least rounding error —
 * and because the ground really is flat, the recovered alpha is exact, not an
 * approximation. Verified: 0 pixels in the master fall outside that model.
 *
 * Doing it this way keeps the antialiased edges intact. A chroma-key or a
 * threshold would leave an orange fringe that shows up as dirt once the mark
 * is composited onto the splash's (slightly different) orange.
 */
async function extractMark() {
  const { data, info } = await sharp(MASTER)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const bg = [data[0], data[1], data[2]]; // top-left is always ground
  const span = 255 - bg[2];
  const out = Buffer.alloc(width * height * 4);

  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = Math.max(
        0,
        Math.min(255, Math.round(((data[(y * width + x) * channels + 2] - bg[2]) / span) * 255)),
      );
      const o = (y * width + x) * 4;
      out[o] = 255;
      out[o + 1] = 255;
      out[o + 2] = 255;
      out[o + 3] = alpha;

      if (alpha > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) throw new Error("no mark found in the master — is it a flat image?");

  // Trim to the ink. Every percentage below is a fraction of the MARK, so the
  // master's own padding must not be counted.
  return sharp(out, { raw: { width, height, channels: 4 } })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();
}

async function render(mark, { name, widthPct, opaque }) {
  const meta = await sharp(mark).metadata();

  const markW = Math.round(SIZE * widthPct);
  const markH = Math.round((meta.height / meta.width) * markW);

  // Lanczos softens edges on any real downscale; a light sharpen restores the
  // crispness that matters once the OS scales the icon down again on device.
  // Skip it when we're barely resizing — sharpening a 1:1 copy only adds ringing.
  let resized = sharp(mark).resize({ width: markW, height: markH, kernel: "lanczos3" });
  if (markW < meta.width * 0.9) resized = resized.sharpen({ sigma: 0.7 });

  let pipeline = sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: opaque ? { ...BRAND, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: await resized.toBuffer(), gravity: "center" }]);

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

const mark = await extractMark();
const markMeta = await sharp(mark).metadata();
console.log(`mark extracted ${markMeta.width}x${markMeta.height} from icon.png\n`);

// icon.png is both the input and an output: the mark is re-laid onto a
// 1024 canvas in the exact brand orange. Writing it last would be fine too,
// but extractMark() has already read the file into memory by now either way.
await render(mark, { name: "icon.png", widthPct: ICON_PCT, opaque: true });
await render(mark, { name: "splash-icon.png", widthPct: MASKED_PCT, opaque: false });
await render(mark, { name: "adaptive-icon.png", widthPct: MASKED_PCT, opaque: false });
console.log("\nDone. Native change — rebuild with `eas build` to see it on device.");
