import { format, isSameDay, isThisYear, isToday, isYesterday, parseISO } from "date-fns";

import type { SmsLine, SmsMessage, SmsThread } from "@/types/sms.types";

/** What a thread is called: the contact, else its number or sender name. */
export function threadTitle(thread: Pick<SmsThread, "contact" | "phones" | "replyPhone">) {
  return thread.contact?.name ?? thread.phones[0]?.display ?? thread.replyPhone;
}

/** "Ben CLS LEGACY" for a line key, falling back to the key itself. */
export function lineLabel(lines: SmsLine[] | undefined, key: string | null | undefined) {
  if (!key) return null;
  return lines?.find((l) => l.key === key)?.label ?? key;
}

/** Inbox row stamp, matching the web: "8:39 am" · "Yesterday" · "12 Sep" · "12 Sep 2025". */
export function formatThreadTime(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, isThisYear(d) ? "d MMM" : "d MMM yyyy");
}

/** Bubble footer time: "8:39 am". */
export function formatMessageTime(iso: string) {
  return format(parseISO(iso), "h:mm a");
}

/** Day divider between bubbles: "Today" · "Yesterday" · "Mon 12 Oct" · "12 Oct 2025". */
export function formatDayDivider(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, isThisYear(d) ? "EEE d MMM" : "d MMM yyyy");
}

export function startsNewDay(prev: SmsMessage | undefined, next: SmsMessage) {
  return !prev || !isSameDay(parseISO(prev.createdAt), parseISO(next.createdAt));
}

/** Outbound status as the web shows it under the bubble. */
export function statusLabel(status: string): string | null {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "SENT":
      return "Sent";
    case "DELIVERED":
      return "Delivered";
    case "FAILED":
      return "Failed";
    default:
      return null;
  }
}

/**
 * A per-message idempotency key. No crypto module is installed and this
 * doesn't need to be unguessable — only unique per send attempt.
 */
export function newClientRequestId() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
