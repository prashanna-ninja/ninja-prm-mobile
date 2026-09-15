import { format, isThisYear, isToday, isYesterday, parseISO } from "date-fns";

/**
 * ⚠️ Use date-fns, never `Intl`. Hermes ships without full ICU on Android, so
 * Intl date/number formatting silently differs between platforms (and
 * sometimes between devices).
 */

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

/** List rows: "12 Sep 2026, 1:21 pm" — matching the web app's format. */
export function formatDateTime(value: string | Date): string {
  return format(toDate(value), "d MMM yyyy, h:mm a");
}

/** Detail header: "12 September 2026, 1:21 pm". */
export function formatDateTimeLong(value: string | Date): string {
  return format(toDate(value), "d MMMM yyyy, h:mm a");
}

/**
 * Compact, relative-ish stamp for dense lists:
 * "1:21 pm" today · "Yesterday" · "12 Sep" this year · "12 Sep 2025" beyond.
 */
export function formatDateCompact(value: string | Date): string {
  const date = toDate(value);
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return "Yesterday";
  if (isThisYear(date)) return format(date, "d MMM");
  return format(date, "d MMM yyyy");
}

/** "6m 52s" · "1h 04m" · "48s". Null in → null out (caller omits the field). */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;

  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/** "2:14" / "1:02:14" — for the audio player's elapsed / total readout. */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(secs).padStart(2, "0")}`
    : `${mm}:${String(secs).padStart(2, "0")}`;
}

/** "Jane Doe" → "JD". Falls back to "?" rather than rendering an empty circle. */
export function initialsFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "1 recording" / "137 recordings" — no Intl, no pluralisation library. */
export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** Total captured time for the Home footer: "51h 12m" · "48m". */
export function formatTotalDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m`;
}

/**
 * Week-over-week change as a whole percentage.
 * Returns null when there's no baseline — "+∞%" helps nobody.
 */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
