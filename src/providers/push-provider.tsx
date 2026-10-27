import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as React from "react";
import { Platform } from "react-native";

import {
  registerPushToken,
  unregisterPushToken,
  updatePushPreferences,
  type PushSyncResult,
} from "@/api/push.api";
import { useAppForeground } from "@/hooks/use-app-foreground";
import {
  DEFAULT_PUSH_PREFERENCES,
  normalisePushPreferences,
  type PushCategory,
  type PushPreferences,
} from "@/lib/push-categories";
import { qk } from "@/lib/query-keys";
import { useSession } from "@/providers/session-provider";

/**
 * Push notifications: OS permission, the Expo token, and keeping the server's
 * copy of both in step.
 *
 * Ported from Ninja CRM Mobile (`src/providers/push-provider.tsx`), where every
 * edge case below was found on real devices. Changes for the PRM:
 * - the session comes from OUR `useSession()`, never `authClient.useSession()`
 *   (it trips React 19's tearing check — see providers/session-provider.tsx);
 * - two categories instead of five (lib/push-categories.ts);
 * - a push landing while the app is open refreshes Messages/Tasks, not a
 *   notification centre (the PRM doesn't have one).
 */

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

const KEY_ENABLED = "ninjaprm_push_enabled";
const KEY_PREFERENCES = "ninjaprm_push_preferences";
const KEY_EXPLAINER_SEEN = "ninjaprm_push_explainer_seen";
/**
 * Who turned push on. SecureStore is per-INSTALL, not per-user, so without this
 * the next person to sign in on the phone inherits the previous one's push —
 * and receives texts meant for them. See the ownership guard below.
 */
const KEY_OWNER_ID = "ninjaprm_push_owner_id";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * - `unsupported`: a simulator. Expo tokens need real hardware, so the switch
 *   explains that rather than looking broken.
 * - `blocked`: refused in a way we can NO LONGER re-ask — only the OS Settings
 *   app can undo it. Deliberately not "denied": Android lets a user DISMISS the
 *   prompt (denied but re-askable), and conflating the two told Android users
 *   they were blocked when they weren't.
 */
export type PushPermission = "loading" | "undetermined" | "granted" | "blocked" | "unsupported";

/** What `enable()` actually achieved, so the caller can respond honestly. */
export type EnableOutcome = "enabled" | "denied" | "blocked" | "unsupported" | "failed";

type PushContextValue = {
  permission: PushPermission;
  /** The user's master switch — independent of the OS permission. */
  enabled: boolean;
  preferences: PushPreferences;
  token: string | null;
  /** Whether the server accepted the token. */
  sync: PushSyncResult | null;
  /**
   * OS permission granted, but this build couldn't get an Expo token — almost
   * always Android without Firebase (`google-services.json`) in the build.
   * Distinct from "off" so Settings can say what's actually wrong.
   */
  tokenUnavailable: boolean;
  /** Has the one-time "turn on notifications" card had its chance? */
  explainerSeen: boolean;

  enable: () => Promise<EnableOutcome>;
  disable: () => Promise<void>;
  setCategory: (category: PushCategory, value: boolean) => Promise<void>;
  markExplainerSeen: () => Promise<void>;
  /** Re-read the OS permission — it can change outside the app. */
  refreshPermission: () => Promise<void>;
  /** Call BEFORE signing out, while the session cookie still works. */
  unregisterForSignOut: () => Promise<void>;
};

const PushContext = React.createContext<PushContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/* Device plumbing                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A notification arriving while the app is OPEN still shows its banner — you
 * can be deep in a recording when someone texts. No sound: the OS already plays
 * one when the app is backgrounded, and doubling it mid-use is obnoxious.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Android needs an explicit channel, or notifications arrive with no
 * importance — no sound, no heads-up banner. The backend sends to channelId
 * "default", which is this one. iOS ignores it.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Ninja PRM",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#FF8900",
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * The Expo push token for this install. `projectId` is required — without it
 * the call throws in a built app. It's `app.json` → `extra.eas.projectId`.
 */
async function fetchExpoPushToken(): Promise<string | null> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  if (!projectId) {
    console.warn("[push] no EAS projectId in app config — cannot get a token");
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ?? null;
  } catch (error) {
    // Android without Firebase credentials in the build throws here. A build
    // problem, not something the user can fix from Settings.
    console.warn("[push] getExpoPushTokenAsync failed:", error);
    return null;
  }
}

/**
 * ⚠️ `canAskAgain` is the signal, NOT `status` — the CRM learned this on a real
 * Android. iOS asks once ("Don't Allow" = denied + canAskAgain:false, final).
 * Android 13+ lets the user DISMISS the prompt: denied + canAskAgain:TRUE, and
 * it may be asked again. Keying on status sent re-askable Android users to the
 * Settings app to fix something that wasn't broken.
 */
async function readOsPermission(): Promise<PushPermission> {
  if (!Device.isDevice) return "unsupported";
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (canAskAgain) return "undetermined";
  return "blocked";
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function PushProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;

  const [permission, setPermission] = React.useState<PushPermission>("loading");
  const [enabled, setEnabled] = React.useState(false);
  const [preferences, setPreferences] = React.useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [token, setToken] = React.useState<string | null>(null);
  const [sync, setSync] = React.useState<PushSyncResult | null>(null);
  const [tokenUnavailable, setTokenUnavailable] = React.useState(false);
  const [explainerSeen, setExplainerSeen] = React.useState(true); // assume seen until loaded

  /**
   * The user asked for push and the OS refused. A blocked user has to leave
   * for the Settings app, so their request is necessarily interrupted — this
   * lets us FINISH it when they come back, instead of making them find the
   * switch and press it again (which reads as the first press not working).
   */
  const awaitingPermission = React.useRef(false);

  /* --- Load persisted state once ----------------------------------------- */

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedEnabled, storedPrefs, storedSeen] = await Promise.all([
        SecureStore.getItemAsync(KEY_ENABLED).catch(() => null),
        SecureStore.getItemAsync(KEY_PREFERENCES).catch(() => null),
        SecureStore.getItemAsync(KEY_EXPLAINER_SEEN).catch(() => null),
      ]);
      if (cancelled) return;

      setEnabled(storedEnabled === "true");
      setExplainerSeen(storedSeen === "true");
      if (storedPrefs) {
        try {
          setPreferences(normalisePushPreferences(JSON.parse(storedPrefs)));
        } catch {
          setPreferences(DEFAULT_PUSH_PREFERENCES);
        }
      }

      await ensureAndroidChannel();
      const osPermission = await readOsPermission();
      if (!cancelled) setPermission(osPermission);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- Ownership guard: the shared-phone case ----------------------------- */

  /**
   * A turns push on and signs out; B signs in on the same phone. `enabled` is
   * still "true" in SecureStore and the OS permission is still granted, so the
   * effect below would enrol B silently, with A's categories — B gets texts
   * having never opted in. So the settings belong to whoever switched them on:
   * a DIFFERENT user resets to off (one tap to re-enable, no prompt, since the
   * OS permission is app-level); the same user is left exactly as they were.
   */
  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const owner = await SecureStore.getItemAsync(KEY_OWNER_ID).catch(() => null);
      if (cancelled || !owner || owner === userId) return;
      setEnabled(false);
      awaitingPermission.current = false;
      await Promise.all([
        SecureStore.setItemAsync(KEY_ENABLED, "false").catch(() => {}),
        SecureStore.deleteItemAsync(KEY_OWNER_ID).catch(() => {}),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* --- Re-register on every launch where push is on ----------------------- */

  /**
   * Not redundant: Expo tokens rotate (reinstall, restore to a new phone), and
   * re-registering keeps `lastSeenAt` current on the server. Idempotent on the
   * token, so it's cheap.
   */
  React.useEffect(() => {
    if (!userId || !enabled || permission !== "granted") return;
    let cancelled = false;
    (async () => {
      const expoToken = await fetchExpoPushToken();
      if (cancelled) return;
      if (!expoToken) {
        setTokenUnavailable(true);
        return;
      }
      setTokenUnavailable(false);
      setToken(expoToken);
      const result = await registerPushToken({
        token: expoToken,
        platform: Platform.OS === "ios" ? "ios" : "android",
        deviceName: Device.deviceName ?? null,
        preferences,
      });
      if (!cancelled) setSync(result);
    })();
    return () => {
      cancelled = true;
    };
    // `preferences` deliberately excluded — a switch change goes through
    // `setCategory`, which PATCHes instead of re-registering the device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, enabled, permission]);

  /* --- A push landing while the app is open refreshes what it's about ------ */

  React.useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((n) => {
      const type = (n.request.content.data as { type?: unknown } | undefined)?.type;
      // The text is already in the database — refetch so the inbox, an open
      // thread and the tab badge show it now rather than at the next poll.
      if (type === "sms") void queryClient.invalidateQueries({ queryKey: qk.sms.all() });
      if (type === "tasks_due") void queryClient.invalidateQueries({ queryKey: qk.tasks.all() });
    });
    return () => subscription.remove();
  }, [queryClient]);

  /* --- Actions ------------------------------------------------------------ */

  const persistPreferences = React.useCallback(async (next: PushPreferences) => {
    setPreferences(next);
    await SecureStore.setItemAsync(KEY_PREFERENCES, JSON.stringify(next)).catch(() => {});
  }, []);

  const enable = React.useCallback(async (): Promise<EnableOutcome> => {
    if (!Device.isDevice) {
      setPermission("unsupported");
      return "unsupported";
    }

    const current = await Notifications.getPermissionsAsync();
    let granted = current.status === "granted";

    if (!granted) {
      if (!current.canAskAgain) {
        // The prompt is spent and the answer was no — only the Settings app
        // can undo it. Remember they asked, so coming back with it granted
        // finishes the job.
        awaitingPermission.current = true;
        setPermission("blocked");
        return "blocked";
      }

      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.status === "granted";
      if (!granted) {
        awaitingPermission.current = true;
        // Re-read canAskAgain from the RESULT: an Android dismissal leaves the
        // prompt available, and calling that "blocked" would stop us asking.
        if (requested.canAskAgain) {
          setPermission("undetermined");
          return "denied";
        }
        setPermission("blocked");
        return "blocked";
      }
    }

    awaitingPermission.current = false;
    setPermission("granted");
    await ensureAndroidChannel();

    const expoToken = await fetchExpoPushToken();
    if (!expoToken) {
      setTokenUnavailable(true);
      return "failed";
    }
    setTokenUnavailable(false);
    setToken(expoToken);

    const result = await registerPushToken({
      token: expoToken,
      platform: Platform.OS === "ios" ? "ios" : "android",
      deviceName: Device.deviceName ?? null,
      preferences,
    });
    setSync(result);

    setEnabled(true);
    await Promise.all([
      SecureStore.setItemAsync(KEY_ENABLED, "true").catch(() => {}),
      // Stamp who switched it on, for the ownership guard.
      userId ? SecureStore.setItemAsync(KEY_OWNER_ID, userId).catch(() => {}) : Promise.resolve(),
    ]);
    return "enabled";
  }, [preferences, userId]);

  const disable = React.useCallback(async () => {
    // Local first: the switch responds instantly, and the intent is recorded
    // even if the network call fails.
    setEnabled(false);
    await SecureStore.setItemAsync(KEY_ENABLED, "false").catch(() => {});
    if (token) setSync(await unregisterPushToken(token));
  }, [token]);

  const setCategory = React.useCallback(
    async (category: PushCategory, value: boolean) => {
      const next = { ...preferences, [category]: value };
      await persistPreferences(next);
      if (token && enabled) setSync(await updatePushPreferences(token, next));
    },
    [preferences, persistPreferences, token, enabled],
  );

  const markExplainerSeen = React.useCallback(async () => {
    setExplainerSeen(true);
    await SecureStore.setItemAsync(KEY_EXPLAINER_SEEN, "true").catch(() => {});
  }, []);

  /**
   * Both halves fix a real CRM bug: the permission was read once at mount, so
   * after unblocking in Settings every screen still said "blocked" until a
   * restart; and even once refreshed, the user had to press the switch again.
   */
  const refreshPermission = React.useCallback(async () => {
    const next = await readOsPermission();
    setPermission(next);
    if (next === "granted" && awaitingPermission.current) {
      awaitingPermission.current = false;
      await enable();
    }
  }, [enable]);

  // App-wide: coming back from the Settings app must clear "blocked" on every
  // screen, not just the one that sent them there.
  useAppForeground(() => void refreshPermission());

  /**
   * Sign-out drops the token BEFORE the session goes, or the request 401s and
   * this phone keeps receiving the previous user's texts. Local settings are
   * left alone — signing out usually means signing back in; the ownership
   * guard handles a DIFFERENT person signing in.
   */
  const unregisterForSignOut = React.useCallback(async () => {
    if (token) {
      await unregisterPushToken(token).catch(() => {});
      setToken(null);
    }
    awaitingPermission.current = false;
  }, [token]);

  const value = React.useMemo<PushContextValue>(
    () => ({
      permission,
      enabled,
      preferences,
      token,
      sync,
      tokenUnavailable,
      explainerSeen,
      enable,
      disable,
      setCategory,
      markExplainerSeen,
      refreshPermission,
      unregisterForSignOut,
    }),
    [
      permission,
      enabled,
      preferences,
      token,
      sync,
      tokenUnavailable,
      explainerSeen,
      enable,
      disable,
      setCategory,
      markExplainerSeen,
      refreshPermission,
      unregisterForSignOut,
    ],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): PushContextValue {
  const context = React.useContext(PushContext);
  if (!context) throw new Error("usePush must be used inside <PushProvider>");
  return context;
}
