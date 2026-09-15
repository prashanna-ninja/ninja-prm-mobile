import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { normalizeListParams, qk } from "@/lib/query-keys";
import type {
  RecordingAudio,
  RecordingDetail,
  RecordingListParams,
  RecordingListResponse,
  RecordingSource,
  RecordingStats,
} from "@/types/recording.types";

function buildListQuery(params: RecordingListParams) {
  const p = normalizeListParams(params);
  const qs = new URLSearchParams({
    page: String(p.page),
    pageSize: String(p.pageSize),
    sortBy: p.sortBy,
    sortOrder: p.sortOrder,
    source: p.source,
  });
  if (p.search) qs.set("search", p.search);
  return qs.toString();
}

export function getRecordings(params: RecordingListParams) {
  return apiFetch<RecordingListResponse>(
    `/api/v1/recordings?${buildListQuery(params)}`,
  );
}

/**
 * A single page of recordings. Used where we want a fixed slice — the Home
 * screen's "recent" card — rather than an endless list.
 */
export function useRecordings(params: RecordingListParams) {
  return useQuery({
    queryKey: qk.recordings.list(params),
    queryFn: () => getRecordings(params),
  });
}

/**
 * The full list, paged as the user scrolls.
 *
 * ⚠️ The backend merges four tables in memory with MAX_FETCH = 500 per source,
 * so very deep pagination degrades and eventually truncates. Fine for a phone;
 * don't build a "jump to page 40" affordance on top of it.
 */
export function useInfiniteRecordings(
  params: Omit<RecordingListParams, "page">,
) {
  return useInfiniteQuery({
    queryKey: qk.recordings.list(params),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getRecordings({ ...params, page: pageParam }),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined,
    // Keep showing the previous result while a new filter loads, so changing
    // a chip doesn't flash a skeleton over content that's about to reappear.
    placeholderData: (prev) => prev,
  });
}

/** Home-screen counters. Cached longer — these move slowly. */
export function useRecordingStats() {
  return useQuery({
    queryKey: qk.recordings.stats(),
    queryFn: () => apiFetch<RecordingStats>("/api/v1/recordings/stats"),
    staleTime: 60_000,
  });
}

export function useRecording(source: RecordingSource, id: string) {
  return useQuery({
    queryKey: qk.recordings.detail(source, id),
    queryFn: () =>
      apiFetch<RecordingDetail>(`/api/v1/recordings/${source}/${id}`),
    enabled: !!source && !!id,
    staleTime: 5 * 60_000, // a finished recording barely changes
  });
}

/**
 * A playable audio URL.
 *
 * Cached BELOW its expiry so we never hand the player a dead URL: the server
 * signs for ~1h, we hold it for 50 minutes.
 */
export function useRecordingAudio(
  source: RecordingSource,
  id: string,
  enabled = true,
) {
  return useQuery({
    queryKey: qk.recordings.audio(source, id),
    queryFn: () =>
      apiFetch<RecordingAudio>(`/api/v1/recordings/${source}/${id}/audio`),
    enabled: enabled && !!source && !!id,
    staleTime: 50 * 60_000,
    gcTime: 60 * 60_000,
    retry: false, // 404 (no audio) and 409 (integration off) are final
  });
}
