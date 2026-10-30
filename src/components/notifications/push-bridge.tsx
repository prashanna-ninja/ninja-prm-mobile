import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import * as React from "react";

import { useSmsUnreadTotal } from "@/api/sms.api";
import { openPushTarget, parsePushData } from "@/lib/push-links";
import { qk } from "@/lib/query-keys";
import { usePush } from "@/providers/push-provider";

/**
 * Connects OS notifications to the app: a tap opens what it's about, and the
 * app-icon badge tracks the real unread count. Renders nothing.
 *
 * Mounted in `(app)/_layout.tsx`, not the root, for the reason the CRM found:
 * there the user is guaranteed signed in (a tap can't land behind the auth
 * guard) and the tab navigator is guaranteed mounted (a cold-start tap has
 * somewhere to push to).
 *
 * Ported from Ninja CRM Mobile (`components/notifications/push-bridge.tsx`).
 */
export function PushBridge() {
  const { permission } = usePush();
  const unread = useSmsUnreadTotal();
  const queryClient = useQueryClient();

  /* --- Taps while the app is running -------------------------------------- */

  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = parsePushData(response.notification.request.content.data);
      if (!data) return;
      // The push was received while backgrounded, when no JS ran — so nothing
      // refreshed. Do it now, before the screen it opens reads the cache.
      if (data.type === "sms") void queryClient.invalidateQueries({ queryKey: qk.sms.all() });
      if (data.type === "tasks_due") void queryClient.invalidateQueries({ queryKey: qk.tasks.all() });
      openPushTarget(data);
    });
    return () => subscription.remove();
  }, [queryClient]);

  /* --- The tap that launched the app -------------------------------------- */

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (cancelled || !response) return;
      const data = parsePushData(response.notification.request.content.data);
      if (data) openPushTarget(data);
      // Without this the same response is returned on every later mount, and
      // the app yanks you back to an old text's thread.
      await Notifications.clearLastNotificationResponseAsync().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* --- Keep the app-icon badge honest ------------------------------------- */

  /**
   * The badge arrives with each push (unread conversations, server-side) but
   * nothing clears it when you read a thread IN the app — so the home screen
   * would show a stale red "3" forever. Follow the same number the Messages
   * tab badge shows.
   */
  React.useEffect(() => {
    if (permission !== "granted" || unread.data == null) return;
    Notifications.setBadgeCountAsync(unread.data).catch(() => {});
  }, [permission, unread.data]);

  return null;
}
