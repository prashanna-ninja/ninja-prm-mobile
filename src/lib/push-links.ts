import { router } from "expo-router";

/**
 * ⚠️ CONTRACT — the `data` object the backend puts on every Expo message
 * (docs/prompts/BACKEND-PUSH.md, "Payload contract"). Read when a
 * notification is tapped.
 *
 * Unlike the CRM there's no notification row to mirror, so the payload names
 * its destination directly: a thread id is the whole address of a
 * conversation, and nothing has to be parsed back out of the title.
 */
export type PushData =
  | { type: "sms"; threadId: string }
  | { type: "tasks_due" }
  | { type: "test" };

/** Untrusted input — validate rather than cast. */
export function parsePushData(raw: unknown): PushData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  switch (data.type) {
    case "sms":
      return typeof data.threadId === "string" && data.threadId.trim()
        ? { type: "sms", threadId: data.threadId }
        : null;
    case "tasks_due":
      return { type: "tasks_due" };
    case "test":
      return { type: "test" };
    default:
      return null;
  }
}

/** Where a tapped notification leads. A test push just opens the app. */
export function openPushTarget(data: PushData) {
  switch (data.type) {
    case "sms":
      router.push({ pathname: "/messages/[threadId]", params: { threadId: data.threadId } });
      return;
    case "tasks_due":
      router.push("/tasks");
      return;
    case "test":
      return;
  }
}
