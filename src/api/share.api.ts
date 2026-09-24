import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import type { RecordingSource } from "@/types/recording.types";

/** Caps enforced by the server — mirrored here so the UI can warn first. */
export const MAX_RECIPIENTS = 10;
export const MAX_NOTE_LENGTH = 4000;

export type ShareTranscriptInput = {
  source: RecordingSource;
  id: string;
  /** Comma / semicolon / newline separated. The server parses and dedupes. */
  recipients: string;
  note?: string;
};

/**
 * Email a transcript.
 *
 * `POST /api/v1/recordings/:source/:id/share` — a thin wrapper over the same
 * action the web "Share transcript" dialog uses, so the email is identical.
 *
 * Statuses worth knowing: 400 validation (message is user-facing and exact),
 * 404 no transcript, 429 rate-limited (10/hour), 502 the mail provider failed.
 */
export function useShareTranscript() {
  return useMutation({
    mutationFn: ({ source, id, recipients, note }: ShareTranscriptInput) =>
      apiFetch<{ success: true }>(`/api/v1/recordings/${source}/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ recipients, note: note ?? "" }),
      }),
  });
}

/** Split the way the server does, so our count matches its limit. */
export function parseRecipients(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,;\n]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}
