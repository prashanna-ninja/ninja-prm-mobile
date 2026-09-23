import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { addNetworkStateListener } from "expo-network";
import * as React from "react";

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

export function QueryProvider({ children }: { children: React.ReactNode }) {
  useOnlineManager();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
