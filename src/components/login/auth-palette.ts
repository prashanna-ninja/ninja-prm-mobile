/**
 * The sign-in screen's palette, deliberately NOT the themed tokens.
 *
 * Auth is the one place in the app that is always light and always brand-forward:
 * it's a first impression, shown before we know anything about the user, and a
 * signed-out screen that flips to dark adds nothing. Everything behind the
 * session guard uses the themed tokens from global.css as normal.
 *
 * The hero is brand orange — the same move the Ninja CRM app makes with its
 * purple. The wordmark is white, so it needs a saturated ground, and orange is
 * what makes the app recognisably ours the instant it opens.
 */
export const AUTH = {
  /* Hero — a gentle orange gradient, light at the top, deeper at the fold, so
     the block has some depth instead of reading as a flat rectangle. */
  heroTop: "#FF9A1F",
  heroBottom: "#F07E00",
  heroText: "#FFFFFF",
  heroMuted: "rgba(255,255,255,0.88)",

  /* Sheet */
  sheet: "#FFFFFF",
  ink: "#18181B",
  inkSoft: "#52525B",
  muted: "#71717A",
  line: "#E4E4E7",
  lineStrong: "#D4D4D8",
  fieldBg: "#FAFAFA",

  /* Brand — the CTA sits on the white sheet, far from the hero, so orange
     still reads as "the thing to tap". */
  brand: "#FF8900",
  brandPressed: "#E87C00",
  brandSoft: "#FFF2E0",

  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  white: "#FFFFFF",
} as const;
