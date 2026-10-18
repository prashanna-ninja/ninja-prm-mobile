import { Stack } from "expo-router";

/**
 * Messages tab: inbox → thread, plus "new message".
 *
 * `initialRouteName` keeps the inbox underneath when a thread is opened from
 * ANOTHER tab (a contact's "Text" button) — same reason as the Tasks stack.
 */
export const unstable_settings = { initialRouteName: "index" };

export default function MessagesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
