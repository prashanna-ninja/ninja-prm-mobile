import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL } from "@/constants/env";

/**
 * Better Auth client for the app.
 *
 * ⚠️ Three things must agree or sign-in silently breaks:
 *   1. `baseURL` must equal the server's BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL.
 *      Confirmed 2026-09-15 to be `https://www.ninjaprm.com.au` — the APEX
 *      (no www) 307-redirects, and a redirected auth call loses its cookie.
 *   2. `scheme` must match app.json's `scheme`, the sign-in callbackURL, and
 *      the server's BETTER_AUTH_TRUSTED_ORIGINS entry (`ninjaprm://`).
 *   3. `storagePrefix` sets the SecureStore key (`ninjaprm_cookie`), which
 *      lib/session-cookie.ts writes to by hand — keep them in sync.
 *
 * Version is pinned to 1.4.3 to match the backend exactly. Client/server drift
 * in Better Auth shows up as cookie-format bugs that are miserable to diagnose.
 *
 * ⚠️ Imported from `better-auth/client`, NOT `better-auth/react`. The React
 * entry's `useStore` drives `useSyncExternalStore` from a ref its own
 * `subscribe` mutates, which React 19 reports as tearing during concurrent
 * rendering. We read the session through providers/session-provider.tsx
 * instead, so the hooks — and that module — are never loaded.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    magicLinkClient(),
    expoClient({
      scheme: "ninjaprm",
      storagePrefix: "ninjaprm",
      storage: SecureStore,
    }),
  ],
});
