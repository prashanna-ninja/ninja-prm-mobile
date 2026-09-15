/**
 * The app's icon set — import icons from HERE, never from "lucide-react-native".
 *
 * ⚠️ WHY THIS FILE EXISTS
 * `import { Send } from "lucide-react-native"` pulls in the package barrel,
 * which Metro does not tree-shake — that bundles all ~1600 icons and added
 * ~3MB to the Android bundle for five icons (measured 2026-09-15: 3.7MB → 6.7MB).
 * Importing each icon's own module instead keeps only what we use.
 *
 * Use the `lucide-react-native/icons/<kebab-name>` subpath: it's declared in
 * the package's `exports` map (→ dist/esm/icons/*.mjs, with types at
 * dist/types/icons/*.d.ts). Reaching into `dist/esm/...` directly also works
 * but is NOT in `exports`, so Metro logs a "falling back to file-based
 * resolution" warning for every icon.
 *
 * Adding an icon: find its kebab-case name at lucide.dev, add a line below.
 * Re-check the bundle with `npx expo export` if you add a lot at once.
 */
export { default as ArrowLeft } from "lucide-react-native/icons/arrow-left";
export { default as Check } from "lucide-react-native/icons/check";
export { default as Mail } from "lucide-react-native/icons/mail";
export { default as MailOpen } from "lucide-react-native/icons/mail-open";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as ShieldCheck } from "lucide-react-native/icons/shield-check";
