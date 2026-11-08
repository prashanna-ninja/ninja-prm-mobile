import { File, Paths } from "expo-file-system";
import * as React from "react";
import { AppState } from "react-native";

/**
 * Unsent text drafts, one per thread, kept on the device.
 *
 * Type something, go back, come back later (even after the app was killed)
 * and it's still in the box, like Messages/WhatsApp. Local only; the PRM
 * has no drafts.
 *
 * - In memory for instant reads; written to one small JSON file in the app's
 *   documents folder, debounced, and flushed when the app goes to background.
 * - Keyed by the thread's CURRENT id (`thread.id` from the server), so the
 *   inbox row and the thread screen agree.
 * - Cleared on sign-out (`clearAllSmsDrafts`), so the next person to sign in
 *   on this phone doesn't see someone else's half-written texts.
 * - Drafts untouched for 30 days are dropped on load.
 */

type Draft = { text: string; at: number };

const FILE_NAME = "sms-drafts.json";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const WRITE_DELAY_MS = 400;

let drafts: Map<string, Draft> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function file() {
  return new File(Paths.document, FILE_NAME);
}

function load(): Map<string, Draft> {
  if (drafts) return drafts;
  drafts = new Map();
  try {
    const f = file();
    if (f.exists) {
      const parsed = JSON.parse(f.textSync()) as Record<string, Draft>;
      const cutoff = Date.now() - MAX_AGE_MS;
      for (const [id, d] of Object.entries(parsed)) {
        if (d && typeof d.text === "string" && d.text && d.at > cutoff) drafts.set(id, d);
      }
    }
  } catch {
    // Unreadable file: start empty. Losing a draft beats crashing the thread.
  }
  return drafts;
}

function flush() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (!drafts) return;
  try {
    const f = file();
    if (drafts.size === 0) {
      if (f.exists) f.delete();
      return;
    }
    if (!f.exists) f.create();
    f.write(JSON.stringify(Object.fromEntries(drafts)));
  } catch {
    // Disk write failed: the draft still lives in memory for this session.
  }
}

function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, WRITE_DELAY_MS);
}

function emit() {
  for (const l of listeners) l();
}

// Don't lose the last keystrokes if the app is backgrounded (and then killed)
// inside the debounce window.
AppState.addEventListener("change", (state) => {
  if (state !== "active" && writeTimer) flush();
});

export function getSmsDraft(threadId: string): string {
  return load().get(threadId)?.text ?? "";
}

/** Save (or, with blank text, remove) a thread's draft. */
export function setSmsDraft(threadId: string, text: string) {
  const map = load();
  const had = map.has(threadId);
  if (text.trim()) {
    map.set(threadId, { text, at: Date.now() });
  } else if (had) {
    map.delete(threadId);
  } else {
    return;
  }
  scheduleWrite();
  emit();
}

export function clearSmsDraft(threadId: string) {
  setSmsDraft(threadId, "");
}

/** Sign-out: forget every draft, on disk too. */
export function clearAllSmsDrafts() {
  drafts = new Map();
  flush();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A thread's draft, re-rendering when it changes (for the inbox row). */
export function useSmsDraft(threadId: string): string {
  return React.useSyncExternalStore(subscribe, () => getSmsDraft(threadId));
}
