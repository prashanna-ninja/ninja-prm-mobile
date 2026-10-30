import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { addNetworkStateListener } from "expo-network";
import * as React from "react";
import { AppState } from "react-native";

import { queryClient } from "@/lib/query-client";

/**
 * Tell TanStack Query about connectivity.
 *
 * Without this, a query fired in a tunnel fails immediately and surfaces an
 * error; with it, Query holds the request and runs it when the connection
 * comes back. `expo-network` is installed anyway — @better-auth/expo lazily
 * imports it for its own online manager — so this is free.
 */
function useOnlineManager() {
  React.useEffect(() => {
    const subscription = addNetworkStateListener((state) => {
      // `isInternetReachable` is undefined while the OS is still probing;
      // treat that as online rather than blocking every request on a maybe.
      onlineManager.setOnline(state.isInternetReachable !== false);
    });
    return () => subscription.remove();
  }, []);
}

/**
 * Tell TanStack Query when the app comes back to the foreground.
 *
 * Query's "window focus" is a browser event; on native it never fires, so
 * coming back to the app refreshed nothing — a text that arrived (and pushed)
 * while the app was backgrounded stayed missing until the next poll. Mapping
 * AppState onto focus makes every mounted, stale query refetch silently on
 * return. SMS queries are always stale (staleTime 0), so Messages always does.
 */
function useAppFocusManager() {
  React.useEffect(() => {
    focusManager.setEventListener((handleFocus) => {
      const subscription = AppState.addEventListener("change", (state) =>
        handleFocus(state === "active"),
      );
      return () => subscription.remove();
    });
  }, []);
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  useOnlineManager();
  useAppFocusManager();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
