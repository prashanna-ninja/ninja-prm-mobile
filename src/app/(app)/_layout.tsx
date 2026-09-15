import { Stack } from "expo-router";

/**
 * Logged-IN stack. Reachable only when a session exists.
 *
 * Phase 5 replaces this with the bottom-tab layout (Home · Recordings), with
 * `settings` present but `href: null`. See docs/features/FEAT-01-RECORDINGS.md §3.
 */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
