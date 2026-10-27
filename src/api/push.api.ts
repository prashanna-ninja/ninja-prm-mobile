import { ApiError, apiFetch } from "@/lib/api-client";
import type { PushPreferences } from "@/lib/push-categories";

/**
 * Device-token registration. Ported from Ninja CRM Mobile (`src/api/push.api.ts`);
 * the paths moved under `/api/v1` to match every other PRM route.
 *
 * ⚠️ Built ahead of the backend (docs/prompts/BACKEND-PUSH.md). Everything
 * here fails QUIETLY: a missing endpoint must not throw an error dialog while
 * someone flips a switch, and must not stop the local preference saving.
 * Settings reports the sync state separately.
 *
 * These are plain functions, not TanStack hooks: they're device plumbing the
 * push provider calls at launch and on sign-out, not server state any screen
 * reads — there's nothing to cache.
 */

export type PushPlatform = "ios" | "android";

export type RegisterPushTokenInput = {
  /** `ExponentPushToken[…]`. */
  token: string;
  platform: PushPlatform;
  /** e.g. "iPhone 15 Pro", so a user can tell their devices apart. */
  deviceName?: string | null;
  preferences: PushPreferences;
};

/**
 * "The backend hasn't shipped this" (404/501) is not "the call failed": the
 * first is expected until the routes land, and the user can do nothing about it.
 */
export type PushSyncResult =
  | { status: "ok" }
  | { status: "unavailable" }
  | { status: "error"; message: string };

async function attempt(run: () => Promise<unknown>): Promise<PushSyncResult> {
  try {
    await run();
    return { status: "ok" };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 501)) {
      return { status: "unavailable" };
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** Register (or refresh) this device. Idempotent on `token`; called every launch. */
export function registerPushToken(input: RegisterPushTokenInput): Promise<PushSyncResult> {
  return attempt(() =>
    apiFetch<{ success: true }>("/api/v1/push/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

/**
 * Drop this device's token — on sign-out and when push is switched off.
 * Deleting the row IS the off switch: no token, no send, enforced server-side.
 */
export function unregisterPushToken(token: string): Promise<PushSyncResult> {
  return attempt(() =>
    apiFetch<{ success: true }>("/api/v1/push/unregister", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );
}

/** Push the per-category switches to the row the sender reads. Note: PATCH. */
export function updatePushPreferences(
  token: string,
  preferences: PushPreferences,
): Promise<PushSyncResult> {
  return attempt(() =>
    apiFetch<{ success: true }>("/api/v1/push/preferences", {
      method: "PATCH",
      body: JSON.stringify({ token, preferences }),
    }),
  );
}

/**
 * Ask the server to send a test notification to THIS device — through the
 * real outbox → queue → worker path, so it proves the whole pipeline, not just
 * the token. Throws (unlike the others): the Settings button shows the result.
 */
export function sendTestPush(token: string) {
  return apiFetch<{ success: true; queued: boolean }>("/api/v1/push/test", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
