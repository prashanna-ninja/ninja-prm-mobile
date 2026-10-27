/**
 * Push categories — the switches in Settings → Notifications.
 *
 * ⚠️ CONTRACT with the backend (docs/prompts/BACKEND-PUSH.md). The server
 * stores one boolean column per category on each device's PushToken row
 * (`prefSms`, `prefTasks`) and skips a device whose category is off. The keys
 * here, the column defaults there, and `preferenceColumns()` there must agree —
 * if they don't, a payload missing a key silently re-enables a category the
 * user turned off.
 *
 * Ported from Ninja CRM Mobile (`src/lib/push-categories.ts`). The PRM has no
 * notification centre, so unlike the CRM these aren't derived from notification
 * types — each one IS an event the server sends a push for.
 */

export type PushCategory = "sms" | "tasks";

export type PushPreferences = Record<PushCategory, boolean>;

/** Settings rows, in the order they're shown. */
export const PUSH_CATEGORY_META: {
  key: PushCategory;
  label: string;
  description: string;
}[] = [
  {
    key: "sms",
    label: "Texts",
    description: "Someone texts one of your CrazyTel numbers",
  },
  {
    key: "tasks",
    label: "Tasks due today",
    description: "One morning summary of what's due and overdue",
  },
];

/**
 * Texts on, the morning summary off — the CRM's reasoning, unchanged.
 *
 * A text is aimed at you and someone may be waiting on the reply; missing one
 * has a cost. The tasks summary fires every morning for anyone with anything
 * due — a predictable buzz about work you already know about is exactly what
 * teaches people to swipe notifications away unread, which then costs the text
 * that mattered. Opt-in, one tap away.
 *
 * ⚠️ Must match the backend's column defaults (`prefSms @default(true)`,
 * `prefTasks @default(false)`).
 */
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  sms: true,
  tasks: false,
};

/** Merge stored preferences over the defaults, ignoring unknown keys. */
export function normalisePushPreferences(
  stored: Partial<Record<string, unknown>> | null | undefined,
): PushPreferences {
  const result = { ...DEFAULT_PUSH_PREFERENCES };
  if (!stored) return result;
  for (const { key } of PUSH_CATEGORY_META) {
    if (typeof stored[key] === "boolean") result[key] = stored[key];
  }
  return result;
}
