import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";

/** App-wide TanStack Query client. Screens use hooks; this holds the cache. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Never retry a 4xx — the answer won't change, and retrying a 401
      // just delays the redirect to sign-in.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 30_000, // 30s — don't refetch on every remount
      gcTime: 5 * 60_000, // keep unmounted data 5 min for instant back-nav
      refetchOnWindowFocus: false, // not meaningful on native
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});
