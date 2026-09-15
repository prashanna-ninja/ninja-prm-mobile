import type {
  RecordingListParams,
  RecordingSource,
} from "@/types/recording.types";

/**
 * Every query key in the app comes from here.
 *
 * Keys are hierarchical so a prefix invalidates everything beneath it:
 * `invalidateQueries({ queryKey: qk.recordings.all() })` clears every list,
 * detail and stats entry. That only works if they all start with "recordings",
 * which is exactly why keys aren't written inline at call sites.
 */
export const qk = {
  me: () => ["me"] as const,

  recordings: {
    all: () => ["recordings"] as const,
    stats: () => ["recordings", "stats"] as const,
    list: (params: RecordingListParams) =>
      ["recordings", "list", normalizeListParams(params)] as const,
    detail: (source: RecordingSource, id: string) =>
      ["recordings", "detail", source, id] as const,
    audio: (source: RecordingSource, id: string) =>
      ["recordings", "audio", source, id] as const,
  },
} as const;

/**
 * Collapse equivalent param objects onto the same key.
 *
 * Without this, `{}` and `{ search: "" }` are different cache entries for
 * identical data — you'd silently double the cache and refetch on every
 * keystroke that clears the box.
 */
export function normalizeListParams(params: RecordingListParams) {
  const search = params.search?.trim();
  return {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    sortBy: params.sortBy ?? "date",
    sortOrder: params.sortOrder ?? "desc",
    source: params.source ?? "all",
    search: search ? search : undefined,
  };
}
