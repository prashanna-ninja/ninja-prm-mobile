import { Stack } from "expo-router";

/** Logged-OUT stack. Reachable only when there is no session. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
