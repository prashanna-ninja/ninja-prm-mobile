import { Stack } from "expo-router";

/**
 * Tasks tab: list → detail → edit, plus the create screen.
 *
 * `initialRouteName` keeps the list underneath when a task is opened from
 * ANOTHER tab (a contact's open tasks) — without it the Tasks tab's stack
 * would be just that detail screen, and tapping the tab would show it.
 */
export const unstable_settings = { initialRouteName: "index" };

export default function TasksLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
