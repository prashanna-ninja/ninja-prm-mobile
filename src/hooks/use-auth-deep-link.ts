import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

import { storeSessionCookie } from "@/lib/session-cookie";

/**
 * "ok"     — a valid session cookie was captured.
 * "failed" — the link came back from the auth flow but WITHOUT a session
 *            (expired/invalid magic link, or the server returned an error).
 * "ignore" — not an auth callback (a normal app open) → do nothing.
 */
type CaptureResult = "ok" | "failed" | "ignore";

/**
 * Pull the session cookie out of a `ninjaprm://?cookie=…` deep link.
 *
 * ⚠️ Parse with `URL.searchParams`, NOT `decodeURIComponent`.
 * The server percent-encodes the whole Set-Cookie string, and its separators
 * arrive as `%3B+` — `decodeURIComponent` leaves `+` as a literal plus, giving
 * you `;+Max-Age` and a cookie the server can't read. `searchParams` decodes
 * `+` as a space correctly.
 *
 * ⚠️ Then pass the value on VERBATIM. The token's signature legitimately
 * contains `%2B` / `%3D` — that's Better Auth's own cookie-value encoding, not
 * an extra layer. Decoding a second time corrupts the session.
 */
function readCookieParam(url: string): string | null {
  try {
    return new URL(url).searchParams.get("cookie");
  } catch {
    // Custom schemes occasionally trip the URL parser on older engines; fall
    // back to expo-linking, which handles them.
    const { queryParams } = Linking.parse(url);
    const value = queryParams?.cookie;
    return typeof value === "string" ? value : null;
  }
}

async function captureSessionFromUrl(
  url: string | null,
): Promise<CaptureResult> {
  if (!url) return "ignore";

  const cookie = readCookieParam(url);
  if (cookie) {
    await storeSessionCookie(cookie);
    return "ok";
  }

  // No cookie. If the link still looks like it came back from the magic-link
  // flow, treat it as a failed sign-in so we can tell the user, rather than
  // silently doing nothing.
  const looksLikeAuthCallback =
    url.includes("error") || url.includes("cookie") || url.includes("token");
  return looksLikeAuthCallback ? "failed" : "ignore";
}

function showLinkFailed() {
  Alert.alert(
    "Sign-in link didn't work",
    "This link is invalid or has expired. Please request a new one.",
    [{ text: "OK" }],
  );
}

/**
 * Establishes the session after a MAGIC-LINK return.
 *
 * ⚠️ This has to exist. The Better Auth Expo plugin only auto-captures the
 * session for OAuth — its hook matches `/callback` and `/oauth2/callback`, and
 * `/magic-link/verify` matches neither. A magic link is tapped in the email
 * app, opens the system browser, and comes back as a plain deep link that
 * nothing in the library is watching for. (Verified against the plugin source,
 * 2026-09-15; also better-auth issue #6936.)
 *
 * Takes `refetch` as an argument rather than calling `useSession()` itself —
 * an extra subscription here was a second source of the concurrent-render
 * tearing described in providers/session-provider.tsx.
 *
 * Call once, high in the tree (root layout).
 */
export function useAuthDeepLink(refetch: () => void) {
  // Hold refetch in a ref so a changing function identity can't re-run the
  // effect and re-register the listener on every render.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    let active = true;

    const handle = (result: CaptureResult) => {
      if (!active) return;
      if (result === "ok") refetchRef.current();
      else if (result === "failed") showLinkFailed();
    };

    // Cold start: the app was launched by the deep link.
    Linking.getInitialURL().then(async (url) => {
      handle(await captureSessionFromUrl(url));
    });

    // Warm: the app was already running and brought forward by the link.
    const sub = Linking.addEventListener("url", async ({ url }) => {
      handle(await captureSessionFromUrl(url));
    });

    return () => {
      active = false;
      sub.remove();
    };
    // Empty deps: register the listener exactly once for the app's lifetime.
  }, []);
}
