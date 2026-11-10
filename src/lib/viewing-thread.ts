/**
 * Which text thread is on screen while the app is in front (empty otherwise).
 *
 * Set by `useThreadNotifications`. Read by the foreground notification handler
 * (no banner for the open thread) and by `openPushTarget` (a tap on that
 * thread's notification doesn't stack a second copy of it).
 *
 * Its own module, with no imports, so push-links and push-dismiss can both use
 * it without importing each other.
 */
let viewing: ReadonlySet<string> = new Set();

export function setViewingThread(ids: ReadonlySet<string> | null) {
  viewing = ids ?? new Set();
}

export function isViewingThread(threadId: string): boolean {
  return viewing.has(threadId);
}
