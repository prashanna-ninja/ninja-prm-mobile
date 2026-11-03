import * as React from "react";

import { useAppActive } from "@/hooks/use-app-active";
import {
  dismissThreadNotifications,
  setViewingThread,
  threadIdsFor,
} from "@/lib/push-dismiss";
import type { SmsThread } from "@/types/sms.types";

/**
 * While this thread is on screen with the app in front: clear its delivered
 * notifications and suppress banners for it (lib/push-dismiss.ts).
 *
 * Re-runs when the app comes back to the front (texts that arrived while it
 * was in the background) and when a new message lands (belt and braces, in
 * case one was presented before the screen registered itself).
 */
export function useThreadNotifications(
  routeId: string,
  thread: SmsThread | null | undefined,
  focused: boolean,
) {
  const appActive = useAppActive();
  const visible = focused && appActive;

  // A stable string key, so a poll returning an equal thread doesn't re-run.
  const ids = threadIdsFor(routeId, thread);
  const key = [...ids].sort().join("|");

  React.useEffect(() => {
    if (!visible || !key) return;
    const set = new Set(key.split("|"));
    setViewingThread(set);
    void dismissThreadNotifications(set);
    return () => setViewingThread(null);
  }, [visible, key, thread?.lastMessageAt]);
}
