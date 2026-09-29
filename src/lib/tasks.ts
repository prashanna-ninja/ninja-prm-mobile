import {
  addDays,
  addHours,
  differenceInCalendarDays,
  format,
  isThisYear,
  parseISO,
  setHours,
  startOfDay,
} from "date-fns";

import type { Task } from "@/types/task.types";

/**
 * Due dates are DATE-ONLY, and the server owns the timezone.
 *
 * On write, the server takes whatever instant we send, reads its calendar day
 * in the user's PROFILE timezone, and stores the start of that day as UTC
 * (`ref/prm/src/app/api/v1/tasks/route.ts`). On read we get that instant back.
 *
 * The phone's timezone is usually the profile's, but not always (travel, or a
 * profile never set). We have no tz database — Hermes' Intl isn't reliable on
 * Android — so both directions are made robust to a mismatch instead:
 *
 * - WRITE local NOON of the chosen day. Noon stays on the same calendar day
 *   anywhere within ±12h, so the server lands on the day the user tapped.
 * - READ by rounding to the NEAREST local midnight. The stored instant is some
 *   timezone's midnight; the nearest local midnight is that same day for any
 *   offset difference under 12h.
 */
export function dueAtForDay(day: Date): string {
  return setHours(startOfDay(day), 12).toISOString();
}

/** The calendar day a task is due, in the phone's local time. */
export function dueDay(dueAt: string): Date {
  return startOfDay(addHours(parseISO(dueAt), 12));
}

export type DueState = "overdue" | "today" | "soon" | "later";

/** Only OPEN tasks can be overdue — a done task due last week is just done. */
export function dueState(task: Pick<Task, "dueAt" | "status">): DueState | null {
  if (!task.dueAt) return null;
  const diff = differenceInCalendarDays(dueDay(task.dueAt), new Date());
  if (diff < 0) return task.status === "OPEN" ? "overdue" : "later";
  if (diff === 0) return "today";
  if (diff <= 7) return "soon";
  return "later";
}

/** "Today" · "Tomorrow" · "Yesterday" · "Fri" (this week) · "12 Oct" · "12 Oct 2027". */
export function formatDueDay(dueAt: string): string {
  const day = dueDay(dueAt);
  const diff = differenceInCalendarDays(day, new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(day, "EEE");
  return format(day, isThisYear(day) ? "d MMM" : "d MMM yyyy");
}

/** Colours for the due label. Literal hexes, per docs/03 (no alpha on tokens). */
export const DUE_COLORS: Record<DueState, string> = {
  overdue: "#DC2626",
  today: "#C2410C",
  soon: "#52525B",
  later: "#71717A",
};

/**
 * Group headings for the Open list, which is sorted `dueAt asc`. Postgres puts
 * NULLs last on an ascending sort, so the groups arrive in this order and can
 * be derived row by row, across pages, without re-sorting.
 */
export type DueGroup = "Overdue" | "Today" | "This week" | "Later" | "No due date";

export function dueGroup(task: Pick<Task, "dueAt" | "status">): DueGroup {
  const state = dueState(task);
  if (state === null) return "No due date";
  if (state === "overdue") return "Overdue";
  if (state === "today") return "Today";
  if (state === "soon") return "This week";
  return "Later";
}

/** Quick picks for the due-date field. */
export function quickDueDays(now = new Date()) {
  const today = startOfDay(now);
  // "Next week" = the coming Monday, which is what people mean by it.
  const daysToMonday = ((8 - today.getDay()) % 7) || 7;
  return [
    { label: "Today", day: today },
    { label: "Tomorrow", day: addDays(today, 1) },
    { label: "Next week", day: addDays(today, daysToMonday) },
  ];
}

/* ------------------------------------------------------------------ */
/* Descriptions are HTML                                               */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

/**
 * The web's rich-text editor stores HTML. RN has no HTML renderer and a
 * WebView per task would be absurd, so read it as text: block tags become
 * line breaks, list items become bullets, everything else is dropped.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The reverse, for what the phone writes. The web renders descriptions with
 * `dangerouslySetInnerHTML`, where bare newlines collapse into one line — so
 * each line goes out as its own paragraph.
 */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}
