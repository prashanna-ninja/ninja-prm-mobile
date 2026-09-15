import { useTheme } from "@/providers/theme-provider";

/**
 * The app-controlled colour scheme.
 *
 * Reads from our ThemeProvider, NOT from the OS — the app theme is manual
 * (see docs/03-DESIGN-SYSTEM.md §8). Use this anywhere you need to branch on
 * light/dark in JS (e.g. picking a StatusBar style or an icon colour).
 */
export function useColorScheme() {
  return useTheme().theme;
}
