/**
 * The app's icon set — import icons from HERE, never from "lucide-react-native".
 *
 * ⚠️ WHY THIS FILE EXISTS
 * `import { Send } from "lucide-react-native"` pulls in the package barrel,
 * which Metro does not tree-shake — that bundles all ~1600 icons and added
 * ~3MB to the Android bundle for five icons (measured 2026-09-15: 3.7MB → 6.7MB).
 * Importing each icon's own module instead keeps only what we use.
 *
 * So: one ugly import per icon, confined to this file, and the rest of the
 * codebase writes `import { Send } from "@/lib/icons"` as normal. It also gives
 * us one place to see every icon the app ships.
 *
 * Adding an icon: find its kebab-case name at lucide.dev, add a line below.
 * Re-check the bundle with `npx expo export` if you add a lot at once.
 */
export { default as ArrowLeft } from "lucide-react-native/dist/esm/icons/arrow-left";
export { default as Check } from "lucide-react-native/dist/esm/icons/check";
export { default as Mail } from "lucide-react-native/dist/esm/icons/mail";
export { default as MailOpen } from "lucide-react-native/dist/esm/icons/mail-open";
export { default as RefreshCw } from "lucide-react-native/dist/esm/icons/refresh-cw";
export { default as ShieldCheck } from "lucide-react-native/dist/esm/icons/shield-check";
