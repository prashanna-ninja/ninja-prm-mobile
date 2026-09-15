/**
 * Recording shapes.
 *
 * Source of truth: the PRM backend's `GET /api/v1/recordings*` routes
 * (ref/prm/src/app/api/v1/recordings/**) which wrap the `getUnifiedRecordings`
 * server action in ref/prm/src/app/actions/recordings.ts.
 *
 * Everything nullable here is nullable on the server too — these rows are
 * synced from four different third parties and half the fields are routinely
 * absent. Treat every optional as genuinely missing, not as "shouldn't happen".
 */

export const RECORDING_SOURCES = ["call", "plaud", "granola", "fieldy"] as const;
export type RecordingSource = (typeof RECORDING_SOURCES)[number];

export const RECORDING_SOURCE_FILTERS = ["all", ...RECORDING_SOURCES] as const;
export type RecordingSourceFilter = (typeof RECORDING_SOURCE_FILTERS)[number];

export type RecordingSortBy = "date" | "title";
export type RecordingSortOrder = "asc" | "desc";

export type RecordingContact = {
  id: string;
  name: string;
  image: string | null;
};

export type RecordingCategory = {
  id: string;
  name: string;
  /** Hex, server-provided. Default on the backend is #6366f1. */
  color: string;
};

/** One row in the unified list. */
export type RecordingListItem = {
  id: string;
  source: RecordingSource;
  /** The server already applies per-source fallbacks ("Call recording", …). */
  title: string;
  /** ISO 8601 string — Dates don't survive JSON. */
  occurredAt: string;
  summary: string | null;
  durationSec: number | null;
  hasAudio: boolean;
  hasTranscript: boolean;
  /** Unarchived AND no contacts linked — the web app's "New" badge. */
  isNew: boolean;
  contacts: RecordingContact[];
  category: RecordingCategory | null;
};

export type RecordingListParams = {
  page?: number;
  pageSize?: number;
  sortBy?: RecordingSortBy;
  sortOrder?: RecordingSortOrder;
  search?: string;
  source?: RecordingSourceFilter;
};

export type RecordingListResponse = {
  items: RecordingListItem[];
  totalCount: number;
  countsBySource: Record<RecordingSource, number>;
  page: number;
  pageSize: number;
  sortBy: RecordingSortBy;
  sortOrder: RecordingSortOrder;
  /** Emitted as null rather than omitted, so the type stays stable. */
  search: string | null;
  source: RecordingSourceFilter;
};

export type RecordingStats = {
  total: number;
  bySource: Record<RecordingSource, number>;
  /** Week windows are computed in the USER'S timezone, not UTC. */
  thisWeek: number;
  lastWeek: number;
  /** Unarchived with zero linked contacts — the actionable number. */
  unassigned: number;
  totalDurationSec: number;
};

/* ---------- detail ---------- */

export type CallDetails = {
  callNumber: string | null;
  receiverNumber: string | null;
  sentiment: string | null;
  spam: boolean;
  noteCount: number;
};

export type PlaudDetails = { keyTopics: string[] };

export type GranolaDetails = {
  attendees: { name: string | null; email: string | null }[];
  ownerName: string | null;
  webUrl: string | null;
  calendarEventTitle: string | null;
};

export type FieldyDetails = {
  keywords: string[];
  speakers: string[];
  quotes: { text: string; context: string | null }[];
  fieldyTasks: unknown[];
  sharables: unknown[];
};

export type RecordingDetail = {
  id: string;
  source: RecordingSource;
  title: string;
  occurredAt: string;
  endAt: string | null;
  durationSec: number | null;
  summary: string | null;
  transcript: string | null;
  /** Server sanitises this to a real string[] — it's `Json?` in the DB. */
  actionItems: string[];
  archived: boolean;
  category: RecordingCategory | null;
  contacts: (RecordingContact & {
    email?: string | null;
    phone?: string | null;
  })[];
  hasAudio: boolean;
  details: Partial<CallDetails & PlaudDetails & GranolaDetails & FieldyDetails>;
};

export type RecordingAudio = {
  url: string;
  mimeType: string;
  /** Null when S3 presigning failed and the stored URL was used as a fallback. */
  expiresInSec: number | null;
};
