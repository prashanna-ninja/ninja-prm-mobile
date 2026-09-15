import "../global.css";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { View } from "react-native";

import { appFonts } from "@/lib/fonts";
import { ThemeProvider } from "@/providers/theme-provider";

/**
 * ⏳ PHASE 3 STUB — flip to `true` to preview the logged-in side.
 *
 * Replaced by the real session once auth is wired:
 *
 *   const { data: session, isPending } = authClient.useSession();
 *   const isSignedIn = !!session?.user;
 *
 * ...plus `useAuthDeepLink()` to capture the magic-link return. See
 * docs/05-AUTH-DEEPLINK.md.
 */
const IS_SIGNED_IN_STUB = false;

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  // Load the brand fonts before showing UI. `fontError` lets us fail open
  // (render with system fonts) instead of hanging forever on a bad asset.
  const [fontsLoaded, fontError] = useFonts(appFonts);

  if (!fontsLoaded && !fontError) {
    // The branded hold, not a bare spinner — this is the first thing a user
    // sees on every cold start, and it matches the splash screen exactly so
    // the handover between them is invisible.
    return <View style={{ flex: 1, backgroundColor: "#FF8900" }} />;
  }

  // Guarded stacks: only ONE group is reachable at a time. When the session
  // appears or disappears, Expo Router redirects automatically.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={IS_SIGNED_IN_STUB}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!IS_SIGNED_IN_STUB}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
