import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";

export const INTERACTION_TYPES = [
  "CALL",
  "MEETING",
  "EMAIL",
  "MESSAGE",
  "COFFEE",
  "NOTE",
  "OTHER",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  EMAIL: "Email",
  MESSAGE: "Message",
  COFFEE: "Coffee",
  NOTE: "Note",
  OTHER: "Other",
};

export type Interaction = {
  id: string;
  type: InteractionType;
  occurredAt: string;
  summary: string | null;
  createdAt: string;
};

/** `GET /contacts/[id]/call-recordings` — note the skip/take envelope. */
export type ContactCallRecording = {
  id: string;
  title: string | null;
  callNumber: string | null;
  receiverNumber: string | null;
  occurredAt: string;
  sentiment: string | null;
  summary: string | null;
  durationSec: number | null;
  createdAt: string;
};

export function useContactInteractions(contactId: string) {
  return useQuery({
    queryKey: qk.contacts.interactions(contactId),
    queryFn: () =>
      apiFetch<{ interactions: Interaction[]; totalCount?: number }>(
        `/api/v1/contacts/${contactId}/interactions?take=20`,
      ),
    enabled: !!contactId,
  });
}

/**
 * Log an interaction.
 *
 * ⚠️ `type` and `occurredAt` are both REQUIRED — the server 400s without
 * them, and rejects a type outside the enum.
 */
export function useLogInteraction(contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: InteractionType;
      occurredAt: string;
      summary?: string;
    }) =>
      apiFetch<Interaction>(`/api/v1/contacts/${contactId}/interactions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contacts.interactions(contactId) });
      // The contact's _count.interactions feeds the Overview card.
      void qc.invalidateQueries({ queryKey: qk.contacts.detail(contactId) });
    },
  });
}

/**
 * A contact's call recordings.
 *
 * Only calls — there is no `fieldy-conversations` endpoint, and Plaud/Granola
 * live on their own routes. Calls are the dominant source, so this covers the
 * common case without three round-trips per contact.
 */
export function useContactRecordings(contactId: string) {
  return useQuery({
    queryKey: qk.contacts.recordings(contactId),
    queryFn: () =>
      apiFetch<{
        recordings: ContactCallRecording[];
        hasMore: boolean;
        totalCount: number;
      }>(`/api/v1/contacts/${contactId}/call-recordings?take=5`),
    enabled: !!contactId,
  });
}
