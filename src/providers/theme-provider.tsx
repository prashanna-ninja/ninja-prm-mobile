import { colorScheme } from "nativewind";
import * as React from "react";
import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";

export type AppTheme = "light" | "dark";

const STORAGE_KEY = "ninjaprm_theme";

/**
 * Apply a scheme to BOTH systems that care about it:
 *  - `Appearance` so React Native's own `useColorScheme()` follows
 *  - NativeWind's `colorScheme` so the `.dark` CSS variables switch
 */
function applyScheme(theme: AppTheme) {
  Appearance.setColorScheme(theme);
  colorScheme.set(theme);
}

/**
 * Force light at module load, BEFORE React renders.
 *
 * Without this, a device set to dark shows a dark flash on cold start before
 * the stored preference loads. Don't remove it.
 */
applyScheme("light");

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

/**
 * App theme: MANUAL light/dark, defaulting to LIGHT, persisted to SecureStore.
 *
 * Deliberately does NOT follow the OS setting. A brand-heavy app that silently
 * flips to dark on a device set to dark looks broken to a first-time user.
 * See docs/03-DESIGN-SYSTEM.md §8.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<AppTheme>("light");

  // Load the stored preference once on mount.
  React.useEffect(() => {
    let active = true;

    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        if (stored === "light" || stored === "dark") {
          setThemeState(stored);
          applyScheme(stored);
        }
      })
      .catch(() => {
        // Storage unavailable — stay on the light default.
      });

    return () => {
      active = false;
    };
  }, []);

  const setTheme = React.useCallback((next: AppTheme) => {
    setThemeState(next);
    applyScheme(next);
    SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {
      // Non-fatal: the choice just won't survive a restart.
    });
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Read and change the app theme. */
export function useTheme() {
  return React.useContext(ThemeContext);
}
