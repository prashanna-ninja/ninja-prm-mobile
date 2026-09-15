/** @type {import('tailwindcss').Config} */
module.exports = {
  // Everything lives under src/. NEVER add ref/ here — those are reference
  // codebases, not our code (see docs/02-SETUP-AND-STRUCTURE.md §6).
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      // Colours read from the HSL CSS variables in src/global.css. This is the
      // shadcn / React Native Reusables convention, so RNR components drop in
      // without extra config.
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
          strong: "hsl(var(--primary-strong))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
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
      // Brand fonts, loaded at startup via useFonts in src/app/_layout.tsx.
      // The VALUES here must match the keys in src/lib/fonts.ts.
      //
      // ⚠️ NEVER name a family `medium`, `semibold`, `bold`, `light`, … —
      // Tailwind's built-in fontWeight scale uses the SAME `font-` prefix, so
      // `font-semibold` becomes ambiguous and resolves to `fontWeight: 600`
      // with NO fontFamily. On Android/Fabric that half-specified text style
      // makes the native text measurer throw
      // ("IllegalStateException: Required value was null" in
      // TextLayoutManager.getOrCreateSpannableForText). Prefix them instead.
      //
      // React Native has no usable synthetic bold — always pick the FAMILY
      // (font-sans-semibold / font-display), never font-bold.
      fontFamily: {
        sans: ["Bricolage_400Regular"],
        "sans-medium": ["Bricolage_500Medium"],
        "sans-semibold": ["Bricolage_600SemiBold"],
        display: ["Bricolage_700Bold"],
      },
    },
  },
  plugins: [],
};
