import "../global.css";

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { appFonts } from "@/lib/fonts";
import { ThemeProvider } from "@/providers/theme-provider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const scheme = useColorScheme();

  // Load the brand fonts before showing UI. `fontError` lets us fail open
  // (render with system fonts) instead of hanging forever on a bad asset.
  const [fontsLoaded, fontError] = useFonts(appFonts);

  if (!fontsLoaded && !fontError) {
    return (
      <View className="flex-1 items-center justify-center bg-primary">
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </>
  );
}
