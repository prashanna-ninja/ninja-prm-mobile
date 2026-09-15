// ⚠️ Import from the WEIGHT SUBPATHS, not the package root.
//
// The package root re-exports all 7 weights, so importing from it makes Metro
// bundle every .ttf (~623KB) even though we use 4 (~356KB). Subpath imports
// pull in only what we reference. Verified via `npx expo export`.
import { BricolageGrotesque_400Regular } from "@expo-google-fonts/bricolage-grotesque/400Regular";
import { BricolageGrotesque_500Medium } from "@expo-google-fonts/bricolage-grotesque/500Medium";
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";

/**
 * Brand fonts, loaded once at startup (see `useFonts` in src/app/_layout.tsx).
 *
 * The PRM web app binds Bricolage Grotesque to `--font-sans`
 * (ref/prm/src/app/layout.tsx), so it is the app's ONE typeface. No second face.
 *
 * The KEYS below become the `fontFamily` names used in tailwind.config.js
 * (`font-sans`, `font-medium`, `font-semibold`, `font-display`) — keep the two
 * in sync.
 *
 * ⚠️ React Native has no usable synthetic bold: `fontWeight: "600"` on a single
 * loaded family renders a faked bold on Android. Every weight must be loaded and
 * named, and you always pick the FAMILY (font-semibold), never font-bold.
 */
export const appFonts = {
  Bricolage_400Regular: BricolageGrotesque_400Regular,
  Bricolage_500Medium: BricolageGrotesque_500Medium,
  Bricolage_600SemiBold: BricolageGrotesque_600SemiBold,
  Bricolage_700Bold: BricolageGrotesque_700Bold,
};
