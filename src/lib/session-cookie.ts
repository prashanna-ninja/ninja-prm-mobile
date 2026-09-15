import { getSetCookie, storageAdapter } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

/**
 * The one place we write the Better Auth session cookie into the client's
 * cookie jar. The magic-link deep-link return funnels through here, so what we
 * store is byte-for-byte what `authClient.getCookie()` expects to read back.
 */

// Must match expoClient({ storagePrefix: "ninjaprm" }) → `${prefix}_cookie`.
const COOKIE_KEY = "ninjaprm_cookie";

// The exact storage wrapper the Better Auth Expo client uses, so our write
// matches its read (same chunking / normalising).
const cookieStorage = storageAdapter(SecureStore);

/**
 * Merge a raw `Set-Cookie` string into the stored session cookie.
 * `getSetCookie` normalises it and preserves any other cookies already present.
 */
export async function storeSessionCookie(setCookie: string): Promise<void> {
  const prev = cookieStorage.getItem(COOKIE_KEY) ?? undefined;
  await cookieStorage.setItem(COOKIE_KEY, getSetCookie(setCookie, prev));
}
