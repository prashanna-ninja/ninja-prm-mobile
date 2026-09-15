import { AudioLines, Mic, NotebookPen, Phone } from "@/lib/icons";
import type { RecordingSource } from "@/types/recording.types";

type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

/**
 * Per-source label + icon.
 *
 * Matches the web app exactly (recordings-page-client.tsx). Note there is no
 * per-source COLOUR: every source tile uses the same brand tint and the icon
 * does the differentiating. A rainbow of source colours was considered and
 * rejected — it fights the single orange accent.
 */
export const SOURCE_META: Record<
  RecordingSource,
  { label: string; icon: IconComponent }
> = {
  call: { label: "Call", icon: Phone },
  plaud: { label: "Plaud", icon: AudioLines },
  granola: { label: "Granola", icon: NotebookPen },
  fieldy: { label: "Fieldy", icon: Mic },
};

/** Order used for the source filter chips and the Home breakdown card. */
export const SOURCE_ORDER: RecordingSource[] = [
  "call",
  "plaud",
  "granola",
  "fieldy",
];

/** Only calls and Plaud recordings ever have audio. */
export function sourceHasAudio(source: RecordingSource): boolean {
  return source === "call" || source === "plaud";
}
