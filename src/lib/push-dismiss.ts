import * as Notifications from "expo-notifications";

import { parsePushData } from "@/lib/push-links";
import type { SmsThread } from "@/types/sms.types";

/**
 * Text notifications vs. the thread you're reading.
 *
 * - Opening a thread (or coming back to the app with one open) removes its
 *   notifications from the lock screen / notification centre, the way
 *   Messages and WhatsApp do. Works for remote pushes on iOS and Android; the
 *   push's `data.threadId` is the match, so no backend change.
 * - A text for the thread on screen doesn't show a banner at all
 *   (`isViewingThread`, read by the foreground handler in push-provider).
 *
 * ⚠️ A thread's id changes when its number is saved to a contact
 * (`conv:<id>` → `contact:<id>`), and a push carries whichever id was current
 * when it was sent. So match on every id the thread can have, not just the
 * route param.
 */

/** Every thread id a push about this conversation could carry. */
export function threadIdsFor(routeId: string, thread: SmsThread | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (routeId) ids.add(routeId);
  if (thread) {
    ids.add(thread.id);
    if (thread.contact) ids.add(`contact:${thread.contact.id}`);
    for (const p of thread.phones) ids.add(`conv:${p.conversationId}`);
  }
  return ids;
}

/** The thread on screen while the app is in front; empty otherwise. */
let viewing: ReadonlySet<string> = new Set();

export function setViewingThread(ids: ReadonlySet<string> | null) {
  viewing = ids ?? new Set();
}

export function isViewingThread(threadId: string): boolean {
  return viewing.has(threadId);
}

/** Remove delivered notifications for these thread ids. Never throws. */
export async function dismissThreadNotifications(ids: ReadonlySet<string>): Promise<void> {
  if (ids.size === 0) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => {
          const data = parsePushData(n.request.content.data);
          return data?.type === "sms" && ids.has(data.threadId);
        })
        .map((n) =>
          Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {}),
        ),
    );
  } catch {
    // Housekeeping only: a failure leaves a stale notification, nothing worse.
  }
}
