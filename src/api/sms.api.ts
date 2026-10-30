import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAppActive } from "@/hooks/use-app-active";
import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  LinkThreadInput,
  SendSmsInput,
  SendSmsResponse,
  SmsSetup,
  SmsThreadListParams,
  SmsThreadListResponse,
  SmsThreadMessagesResponse,
} from "@/types/sms.types";

/**
 * Messages — CrazyTel SMS.
 *
 * Routes: ../ninja_prm src/app/api/v1/sms/** (feat/sms-api, 2026-10-18).
 * A failed send stores NOTHING server-side (502), so the failed bubble lives
 * only on the phone — and its retry must reuse the clientRequestId, which the
 * route forwards to CrazyTel as the Idempotency-Key.
 *
 * There is no websocket. Incoming texts reach the server by CrazyTel webhook,
 * and the app learns about them three ways, fastest first:
 *
 * 1. **A push** while the app is open invalidates `qk.sms.all()`
 *    (push-provider), as does tapping one (push-bridge).
 * 2. **Returning to the app** refetches — SMS queries are `staleTime: 0`, and
 *    query-provider maps AppState onto Query's focus.
 * 3. **Polling**, the backstop: an open thread every 10s while live, the inbox
 *    every 30s while it's on screen.
 *
 * None of these show a spinner — only a pull does (`usePullRefresh`).
 * `POST /sms/check` — CrazyTel's own change check — only on a pull.
 */
export const SMS_POLL_MS = 10_000;
const UNREAD_POLL_MS = 60_000;
const INBOX_POLL_MS = 30_000;

/** threadIds contain a colon ("contact:abc") — always encode in a path. */
const threadPath = (threadId: string) =>
  `/api/v1/sms/threads/${encodeURIComponent(threadId)}`;

export function useSmsSetup() {
  return useQuery({
    queryKey: qk.sms.setup(),
    queryFn: () => apiFetch<SmsSetup>("/api/v1/sms/setup"),
    // Lines change only when someone edits CrazyTel settings on the web.
    staleTime: 5 * 60_000,
  });
}

function buildQuery(params: SmsThreadListParams) {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 30),
  });
  const search = params.search?.trim();
  // The server ignores searches under 2 characters; so do we.
  if (search && search.length >= 2) qs.set("search", search);
  if (params.filter && params.filter !== "all") qs.set("filter", params.filter);
  if (params.lineKey) qs.set("lineKey", params.lineKey);
  return qs.toString();
}

/**
 * The inbox. Polled slowly, and only while it's on screen (`focused`) with the
 * app in the foreground — refetching an infinite query refetches every loaded
 * page, so scrolling deep makes each poll heavier. Also refreshes on focus,
 * on return to the app, on a push, and after any write.
 */
export function useInfiniteSmsThreads(
  params: Omit<SmsThreadListParams, "page">,
  enabled = true,
  focused = false,
) {
  const active = useAppActive();
  return useInfiniteQuery({
    queryKey: qk.sms.threads(params),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiFetch<SmsThreadListResponse>(
        `/api/v1/sms/threads?${buildQuery({ ...params, page: pageParam })}`,
      ),
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    placeholderData: (prev) => prev,
    enabled,
    staleTime: 0,
    refetchInterval: active && focused ? INBOX_POLL_MS : false,
  });
}

/**
 * The tab badge. A one-row list request, polled slowly and only while the app
 * is in the foreground. Off entirely when SMS isn't set up.
 */
export function useSmsUnreadTotal() {
  const active = useAppActive();
  const setup = useSmsSetup();
  return useQuery({
    queryKey: qk.sms.unread(),
    queryFn: () =>
      apiFetch<SmsThreadListResponse>("/api/v1/sms/threads?page=1&pageSize=1"),
    select: (data) => data.unreadTotal,
    enabled: setup.data?.configured === true,
    staleTime: 0,
    refetchInterval: active ? UNREAD_POLL_MS : false,
  });
}

/** A conversation is "live" for this long after its latest text. */
const LIVE_WINDOW_MS = 2 * 60_000;
/** How often a quiet conversation is re-read. */
const IDLE_POLL_MS = 60_000;

/**
 * One conversation, polled — but as little as the conversation allows.
 *
 * ⚠️ Every request is EXPENSIVE server-side: the route loads the user's whole
 * inbox (`getSmsThreads()`) just to return this thread's own row. There's no
 * messages-only endpoint, so the app can't skip that; it can only ask less:
 *
 * - **Only while the screen is focused** (`focused`) and the app is in the
 *   foreground. A thread left open under a pushed contact screen stops.
 * - **10s while the conversation is live** (a text in the last 2 minutes, either
 *   way — a send lands here too, via invalidation), **60s once it's quiet.**
 *   Polling is the backstop; a push or returning to the app refetches at once.
 *
 * The real fix is server-side: look up only this thread's row. See
 * docs/implementation/BACKEND-CHANGES.md §11.
 */
export function useSmsThreadMessages(threadId: string, focused: boolean) {
  const active = useAppActive();
  return useQuery({
    queryKey: qk.sms.messages(threadId),
    queryFn: () =>
      apiFetch<SmsThreadMessagesResponse>(`${threadPath(threadId)}/messages`),
    enabled: !!threadId,
    staleTime: 0,
    refetchInterval: (query) => {
      if (!active || !focused) return false;
      const latest = query.state.data?.messages.at(-1)?.createdAt;
      const live = latest != null && Date.now() - new Date(latest).getTime() < LIVE_WINDOW_MS;
      return live ? SMS_POLL_MS : IDLE_POLL_MS;
    },
  });
}

export function useMarkSmsThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) =>
      apiFetch<{ success: true }>(`${threadPath(threadId)}/read`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sms.threadLists() });
      void qc.invalidateQueries({ queryKey: qk.sms.unread() });
    },
  });
}

/**
 * Send. Callers own the optimistic bubble (see MessageComposer) — this only
 * refreshes the thread and inbox afterwards. On SETTLED, not success: a failed
 * send may still have written a FAILED row worth showing.
 */
export function useSendSms(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendSmsInput) =>
      apiFetch<SendSmsResponse>("/api/v1/sms/send", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.sms.messages(threadId) });
      // The inbox orders by last message, so a send reorders it.
      void qc.invalidateQueries({ queryKey: qk.sms.threadLists() });
    },
  });
}

/** Open (or create) the thread for a number — "New message" and a contact's "Text". */
export function useStartSmsThread() {
  return useMutation({
    mutationFn: (input: { to: string; lineKey?: string }) =>
      apiFetch<{ threadId: string }>("/api/v1/sms/threads", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

/**
 * "Save contact" on an unknown number. ⚠️ The thread id CHANGES (conv:… →
 * contact:…), so callers must navigate to the returned id.
 */
export function useLinkSmsThread(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkThreadInput) =>
      apiFetch<{ success: true; threadId: string }>(
        `${threadPath(threadId)}/link-contact`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.sms.all() });
      // A new contact may have been created, or a number added to one.
      void qc.invalidateQueries({ queryKey: qk.contacts.all() });
    },
  });
}

/**
 * CrazyTel's cheap change check (texts sent from other devices, delivery
 * updates). Self-throttled server-side to once per ~2 minutes, so calling it
 * on every pull-to-refresh is fine.
 */
export function useCheckForNewTexts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ checked: boolean; imported: number }>("/api/v1/sms/check", {
        method: "POST",
      }),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.sms.all() }),
  });
}

/** The heavy full sync — up to 50 CrazyTel requests. Only on an explicit tap. */
export function useSyncSmsHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{
        success: true;
        imported?: number;
        alreadyRunning?: boolean;
        backfillPending?: boolean;
      }>("/api/v1/sms/sync", { method: "POST" }),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.sms.all() }),
  });
}
