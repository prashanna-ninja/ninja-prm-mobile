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
 * the package's `exports` map. Reaching into `dist/esm/...` directly also works
 * but is NOT in `exports`, so Metro logs a "falling back to file-based
 * resolution" warning for every icon.
 *
 * Adding an icon: find its kebab-case name at lucide.dev, add a line below.
 * Re-check the bundle with `npx expo export` if you add a lot at once.
 */

/* auth */
export { default as ArrowLeft } from "lucide-react-native/icons/arrow-left";
export { default as Check } from "lucide-react-native/icons/check";
export { default as Mail } from "lucide-react-native/icons/mail";
export { default as MailOpen } from "lucide-react-native/icons/mail-open";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as ShieldCheck } from "lucide-react-native/icons/shield-check";

/* tabs + navigation */
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as House } from "lucide-react-native/icons/house";
export { default as Library } from "lucide-react-native/icons/library";
export { default as Moon } from "lucide-react-native/icons/moon";
export { default as Settings } from "lucide-react-native/icons/settings";
export { default as Sun } from "lucide-react-native/icons/sun";

/**
 * Recording sources. These four are fixed by the web app
 * (ref/prm/src/components/recordings/recordings-page-client.tsx) — keep them
 * identical so a screen is greppable across both repos.
 */
export { default as AudioLines } from "lucide-react-native/icons/audio-lines";
export { default as Mic } from "lucide-react-native/icons/mic";
export { default as NotebookPen } from "lucide-react-native/icons/notebook-pen";
export { default as Phone } from "lucide-react-native/icons/phone";

/* audio player */
export { default as Pause } from "lucide-react-native/icons/pause";
export { default as Play } from "lucide-react-native/icons/play";
export { default as RotateCcw } from "lucide-react-native/icons/rotate-ccw";
export { default as RotateCw } from "lucide-react-native/icons/rotate-cw";

/* list + detail affordances */
export { default as FileText } from "lucide-react-native/icons/file-text";
export { default as Search } from "lucide-react-native/icons/search";
export { default as TrendingDown } from "lucide-react-native/icons/trending-down";
export { default as TrendingUp } from "lucide-react-native/icons/trending-up";
export { default as UserPlus } from "lucide-react-native/icons/user-plus";
export { default as Volume2 } from "lucide-react-native/icons/volume-2";
export { default as X } from "lucide-react-native/icons/x";
export { default as ArrowUpDown } from "lucide-react-native/icons/arrow-up-down";
