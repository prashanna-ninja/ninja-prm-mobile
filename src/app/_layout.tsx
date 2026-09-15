import "../global.css";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { View } from "react-native";

import { useAuthDeepLink } from "@/hooks/use-auth-deep-link";
import { appFonts } from "@/lib/fonts";
import { QueryProvider } from "@/providers/query-provider";
import { SessionProvider, useSession } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  // Load the brand fonts before showing UI. `fontError` lets us fail open
  // (render with system fonts) instead of hanging forever on a bad asset.
  const [fontsLoaded, fontError] = useFonts(appFonts);

  const { data: session, isPending, refetch } = useSession();
  const isSignedIn = !!session?.user;

  // Capture the session from the magic-link return (ninjaprm://?cookie=…).
  // See hooks/use-auth-deep-link.ts for why the Expo plugin can't do this.
  useAuthDeepLink(refetch);

  // Hold until BOTH the stored session has resolved and the fonts are ready —
  // otherwise the sign-in screen flashes before the guard redirects a user who
  // is already signed in.
  const isBooting = isPending || (!fontsLoaded && !fontError);

  if (isBooting) {
    // The branded hold, matching the splash exactly so the handover between
    // them is invisible.
    return <View style={{ flex: 1, backgroundColor: "#FF8900" }} />;
  }

  // Guarded stacks: only ONE group is reachable at a time. When the session
  // appears or disappears, Expo Router redirects automatically.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
