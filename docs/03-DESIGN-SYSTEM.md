# 03 — Design System

The app should look like the PRM web app rendered natively — **with one deliberate change: the
primary colour is brand orange `#ff8900`, not the web app's blue.** Everything else (neutrals,
radius, type, spacing rhythm) is ported from `ref/prm/src/app/globals.css` and
`ref/prm/src/app/layout.tsx`.

---

## 1. Brand

| Token | Value | Used for |
| ----- | ----- | -------- |
| **Primary** | `#ff8900` | Buttons, active tab, icons, focus rings, the brand rule, progress fills |
| **Primary foreground** | `#ffffff` | Text/icons sitting **on** primary |
| **Neutrals** | zinc-ish grey scale, from the web app | Everything else |
| **Radius** | `0.5rem` (8px) base; `sm/md/lg/xl` derived | Cards, inputs, buttons |
| **Splash** | `#ff8900` background, **white** mark | Cold start |
| **Android adaptive icon bg** | `#ff8900` | Launcher |

### Using orange well (read this before you reach for it)

`#ff8900` is a mid-luminance orange. **White text on it scores ~2.3:1** — fine for a large button
label, not fine for small copy; **orange text on white scores ~2.2:1** — not fine for anything.
So:

- ✅ Orange as a **fill** (button, active pill, icon tile, badge dot, progress bar).
- ✅ Orange as an **icon** colour at 18px+.
- ✅ Orange as a **2–4px accent rule / left border** — the recurring brand mark.
- ❌ Orange as **body text**, captions, or link text. Use `foreground` / `muted-foreground`.
- ❌ Orange fills stacked next to each other. One orange element per visual group; it is the
  thing the eye should land on.

When you genuinely need orange-flavoured *text*, use `--primary-strong` (a darkened orange that
clears 4.5:1 on the light background).

---

## 2. Colour tokens

Written as HSL `H S% L%` triples so NativeWind can wrap them as `hsl(var(--x))` — the shadcn /
React Native Reusables convention, so RNR components drop in unmodified.

```css
/* global.css — ported from ref/prm/src/app/globals.css, primary swapped to #ff8900 */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;          /* #ffffff */
    --foreground: 240 10% 3.9%;       /* #09090b */
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;

    --primary: 32.2 100% 50%;         /* #ff8900  ← the one deliberate change */
    --primary-foreground: 0 0% 100%;
    --primary-soft: 32 100% 95%;      /* #fff2e0 — solid orange tint (see §3) */
    --primary-strong: 28 100% 34%;    /* #ad5100 — orange that is legible AS TEXT */

    --secondary: 240 4.8% 95.9%;      /* #f4f4f5 */
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;  /* #71717a */
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;

    --destructive: 0 84.2% 60.2%;     /* #ef4444 */
    --destructive-foreground: 0 0% 100%;
    --destructive-soft: 0 86% 97%;    /* solid red tint */

    --border: 240 5.9% 90%;           /* #e4e4e7 */
    --input: 240 5.9% 90%;
    --ring: 32.2 100% 50%;            /* follows primary */

    --radius: 0.5rem;
  }

  .dark {
    --background: 240 8% 8%;          /* #131316 */
    --foreground: 0 0% 98%;
    --card: 240 6% 12%;               /* #1d1d20 */
    --card-foreground: 0 0% 98%;
    --popover: 240 6% 12%;
    --popover-foreground: 0 0% 98%;

    --primary: 32.2 100% 55%;         /* #ff9a1a — lifted so it reads on dark */
    --primary-foreground: 240 8% 8%;  /* dark text on orange reads better here */
    --primary-soft: 30 30% 18%;
    --primary-strong: 32 100% 62%;

    --secondary: 240 5% 20%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 4% 18%;
    --muted-foreground: 240 5% 70%;   /* #adadb8 */
    --accent: 240 5% 20%;
    --accent-foreground: 0 0% 98%;

    --destructive: 0 62.8% 50.6%;
    --destructive-foreground: 0 0% 98%;
    --destructive-soft: 0 40% 18%;

    --border: 240 5% 22%;
    --input: 240 5% 22%;
    --ring: 32.2 100% 55%;
  }
}

@layer components {
  /* One shared wrapper so every screen has identical gutters. */
  .content-wrapper {
    @apply w-full self-center px-4;
  }
}
```

**What changed vs. the web app, and why:**

| Token | Web | Mobile | Why |
| ----- | --- | ------ | --- |
| `--primary` | `221 83% 53%` (blue) | `32.2 100% 50%` (`#ff8900`) | Brand decision for the app. |
| `--ring` | blue | orange | Follows primary. |
| `--primary-soft`, `--primary-strong`, `--destructive-soft` | — | added | NativeWind can't do alpha on these tokens (§3). |
| chart / sidebar tokens | present | dropped | No charts, no sidebar on mobile. Re-add if we ever chart something. |
| `.dark` trigger | class, app forces light | class, toggled by our theme provider | Mobile users expect dark mode; we support it. |

### ⚠️ The alpha gotcha (inherited from Ninja CRM Mobile)

`bg-primary/10` **does not reliably work** in NativeWind, because the token is
`hsl(var(--primary))` with no alpha placeholder. That's why `--primary-soft` and
`--destructive-soft` exist as *solid* colours. Rules:

- Need a tinted surface from a theme colour → use the `-soft` token.
- Need alpha → apply it to a **literal** colour (`bg-black/40` for a scrim is fine).
- Category dots use a hex string straight from the API → `style={{ backgroundColor: color }}`,
  which takes alpha fine if ever needed.

---

## 3. Tailwind mapping

```js
// tailwind.config.js (excerpt)
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
          strong: "hsl(var(--primary-strong))",
        },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontFamily: {
        sans: ["Bricolage_400Regular"],
        medium: ["Bricolage_500Medium"],
        semibold: ["Bricolage_600SemiBold"],
        display: ["Bricolage_700Bold"],
      },
    },
  },
};
```

So a screen writes `className="bg-primary text-primary-foreground rounded-lg"` — the same class
names a web dev on this codebase already knows.

---

## 4. Typography

The web app loads exactly one typeface: **Bricolage Grotesque**, bound to `--font-sans`
(`ref/prm/src/app/layout.tsx`). We do the same. **One family, four weights** — no second face.

```ts
// src/lib/fonts.ts — keys become the fontFamily names in tailwind.config.js. Keep in sync.
import {
  BricolageGrotesque_400Regular as Bricolage_400Regular,
  BricolageGrotesque_500Medium  as Bricolage_500Medium,
  BricolageGrotesque_600SemiBold as Bricolage_600SemiBold,
  BricolageGrotesque_700Bold    as Bricolage_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";

export const appFonts = {
  Bricolage_400Regular,
  Bricolage_500Medium,
  Bricolage_600SemiBold,
  Bricolage_700Bold,
};
```

> **React Native has no synthetic bold that looks right.** You must load and name each weight —
> `fontWeight: "600"` on a single loaded family renders a faked bold on Android. Always pick the
> family (`font-semibold`, `font-display`), never `font-bold` on the regular family.

### Type scale

| Role | Class | Size / line | Weight |
| ---- | ----- | ----------- | ------ |
| Screen title | `font-display text-[30px]` | 30 / 36, tracking `-0.5` | 700 |
| Section title | `font-semibold text-base` | 16 / 22 | 600 |
| Card title | `font-medium text-[15px]` | 15 / 20 | 500 |
| Body | `font-sans text-sm` | 14 / 20 | 400 |
| Secondary / meta | `font-sans text-xs text-muted-foreground` | 12 / 16 | 400 |
| Badge / pill | `font-medium text-xs` | 12 / 16 | 500 |
| Transcript | `font-sans text-sm leading-relaxed` | 14 / 22 | 400 |

Transcripts are long-form reading: keep them at `leading-relaxed` and full content width, and let
them be selectable (`selectable` on `<Text>`) so users can copy a quote.

---

## 5. Spacing, elevation, shape

- **Gutter:** 16px (`px-4`) via `<Container>`. One gutter, everywhere.
- **Vertical rhythm:** 12px between cards in a list (`gap-3`), 24px between sections (`gap-6`) —
  mirrors the web's `space-y-3` / `space-y-6`.
- **Card:** `bg-card border border-border rounded-lg p-4`. **No drop shadows.** The web app is a
  flat, Linear/Notion-style surface design; borders carry the hierarchy. Shadows on Android
  (`elevation`) and iOS diverge badly and add nothing here.
- **Touch targets:** minimum 44×44. Icon buttons get `h-10 w-10` with the icon at 20px.
- **Press feedback:** `active:opacity-70` on `Pressable`, plus `expo-haptics` `selectionAsync()`
  on destructive or state-changing taps only — not on navigation.

---

## 6. Component conventions

| Component | Convention |
| --------- | ---------- |
| `Button` | CVA variants `default` (orange fill) · `outline` · `ghost` · `destructive`; sizes `sm` · `default` · `icon`. |
| `Card` | Border + radius, no shadow. `CardHeader` / `CardContent` split like the web. |
| `Badge` | Variants `default` · `secondary` · `outline`. Source labels and categories use `outline`. |
| `Avatar` | Image with initials fallback (`initialsFromName` in `lib/format.ts`), `h-8 w-8` in lists. |
| `Skeleton` | `bg-muted rounded` block with a subtle pulse. Every list and detail screen has one. |
| `SearchBar` | Leading `Search` icon, trailing clear `X` when non-empty. Debounced 300ms. |
| `Sheet` | Bottom sheet for filters and pickers. One sheet at a time — **do not nest modals** (known-finicky on RN; bit the CRM app). |

### Icons

`lucide-react-native`, same names as the web so a screen is greppable across both repos.
Recording icons are fixed by the web app (`recordings-page-client.tsx`):

| Source | Icon | Label |
| ------ | ---- | ----- |
| `call` | `Phone` | Call |
| `plaud` | `AudioLines` | Plaud |
| `granola` | `NotebookPen` | Granola |
| `fieldy` | `Mic` | Fieldy |
| all / empty state | `Library` | — |

Default icon size 20px in lists, 16px inline with text, 24px in headers. Icon colour is
`muted-foreground` unless it's the one accent in the group, then `primary`.

---

## 7. Recording-specific visual rules (ported from the web)

- **Source tile:** a 40×40 `rounded-md bg-primary-soft` square with the source icon in
  `text-primary`. Same treatment for all four sources — the *icon* differentiates them, not the
  colour. (The web does exactly this; a per-source palette was considered and rejected as it
  fights the single brand accent.)
- **"New" recording** = unarchived **and** with no contacts linked. The web marks it with a
  `border-l-4 border-l-red-500` on the card plus a red outline "New" badge
  (`new-recording-indicator.tsx`). We keep both. This is the one place red is *not* an error.
- **Category badge:** outline badge with a 8px dot filled from the category's own hex `color`
  (server-provided; palette in `ref/prm/src/lib/recording-category-colors.ts`, default `#6366f1`).
- **Date format:** `d MMM yyyy, h:mm a` in lists, `d MMMM yyyy, h:mm a` on detail — matching the
  web's `date-fns` formats. Use `date-fns`; do **not** use `Intl` (inconsistent on Android/Hermes).
- **Summary clamp:** 2 lines in the list (`numberOfLines={2}`), full text on detail.
- **Empty summary** renders the literal string `No summary yet`, like the web.

---

## 8. Dark mode

The web app force-locks light. On mobile we **support both**, with a **manual toggle that defaults
to light** and persists — the same decision as Ninja CRM Mobile, for the same reason: a brand-heavy
app that silently flips to dark on a device set to dark looks broken to a first-time user.

Owned by `src/providers/theme-provider.tsx`: it drives `Appearance.setColorScheme()` (so RN's
`useColorScheme()` follows) plus NativeWind's `colorScheme.set()`, and persists the choice in
`expo-secure-store`. Apply `light` at module load so there's no dark flash on cold start.

---

## 9. Splash & app icon

| Asset | Spec |
| ----- | ---- |
| Splash background | `#ff8900` (light **and** dark — a brand splash shouldn't change) |
| Splash mark | White Ninja PRM logo, `imageWidth: 200`, `resizeMode: "contain"` |
| App icon | Supplied by the user (`src/assets/images/icon.png`, 1024×1024) |
| Android adaptive icon | White foreground on `#ff8900` background |
| Favicon (web target) | Same mark |

```jsonc
// app.json (excerpt)
"plugins": [
  "expo-router",
  ["expo-splash-screen", {
    "image": "./src/assets/images/splash-icon.png",
    "imageWidth": 200,
    "resizeMode": "contain",
    "backgroundColor": "#ff8900",
    "dark": { "backgroundColor": "#ff8900" }
  }],
  "expo-secure-store",
  "expo-web-browser"
],
"android": {
  "adaptiveIcon": {
    "backgroundColor": "#ff8900",
    "foregroundImage": "./src/assets/images/adaptive-icon.png"
  }
}
```

⏳ **Waiting on:** the logo artwork from the user. Until it arrives, ship a placeholder wordmark
and keep the colours correct so the swap is a one-file change.

---

## 10. Accessibility floor

Not optional, and cheap if done from the start:

- Every icon-only control gets `accessibilityLabel`.
- Every `Pressable` gets `accessibilityRole="button"`.
- Text never relies on colour alone — the "New" state has a badge *and* a rule, not just red.
- Respect the OS text-size setting: use `text-*` classes (which scale) and avoid fixed-height
  rows for anything containing text.
- Audio controls are labelled (`Play`, `Pause`, `Seek to 2 minutes 30 seconds`).
