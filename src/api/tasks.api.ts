import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  CreateTaskInput,
  Task,
  TaskListParams,
  TaskListResponse,
  TaskStatus,
  UpdateTaskInput,
} from "@/types/task.types";

function buildQuery(params: TaskListParams) {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
    sortBy: params.sortBy ?? "dueAt",
    sortOrder: params.sortOrder ?? "asc",
  });
  const search = params.search?.trim();
  if (search) qs.set("search", search);
  // The server casts these straight into the Prisma where-clause, so an
  // invalid value would 500 — only ever send real enum values.
  if (params.status) qs.set("status", params.status);
  if (params.priority) qs.set("priority", params.priority);
  if (params.contactId) qs.set("contactId", params.contactId);
  return qs.toString();
}

export function getTasks(params: TaskListParams) {
  return apiFetch<TaskListResponse>(`/api/v1/tasks?${buildQuery(params)}`);
}

export function useInfiniteTasks(params: Omit<TaskListParams, "page">) {
  return useInfiniteQuery({
    queryKey: qk.tasks.list(params),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getTasks({ ...params, page: pageParam }),
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    // Keep the old list on screen while a filter change loads.
    placeholderData: (prev) => prev,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: qk.tasks.detail(id),
    queryFn: () => apiFetch<Task>(`/api/v1/tasks/${id}`),
    enabled: !!id,
  });
}

/**
 * Tasks show up on contacts too — the contact detail embeds its open tasks and
 * the list rows count them — so every task write refreshes both.
 */
function invalidateTaskViews(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: qk.tasks.all() });
  void qc.invalidateQueries({ queryKey: qk.contacts.all() });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch<Task>("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

/**
 * ⚠️ Send only what changed. `contactIds` replaces the whole set, and the
 * server deletes the old links before validating `dueAt` — see UpdateTaskInput.
 */
export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) =>
      apiFetch<Task>(`/api/v1/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (task) => {
      // Show the saved row straight away. PATCH's contacts lack email/phone,
      // which GET [id] adds — the refetch below fills those back in.
      if (task) qc.setQueryData<Task>(qk.tasks.detail(id), task);
      invalidateTaskViews(qc);
    },
  });
}

/**
 * Tick / untick. Optimistic, because a checkbox that waits a round-trip to
 * fill in feels broken. The row updates in every cached list and the detail
 * immediately; the refetch afterwards moves it to the right filter.
 */
export function useSetTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      apiFetch<Task>(`/api/v1/tasks/${id}`, {
        method: "PATCH",
        // Status alone — never contactIds — so the server bug can't bite.
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: qk.tasks.all() });
      qc.setQueriesData<InfiniteData<TaskListResponse>>(
        { queryKey: qk.tasks.lists() },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              tasks: page.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
            })),
          },
      );
      qc.setQueryData<Task>(qk.tasks.detail(id), (prev) =>
        prev ? { ...prev, status } : prev,
      );
    },
    // On failure the refetch below restores the server's truth.
    onSettled: () => invalidateTaskViews(qc),
  });
}

/** ⚠️ A hard delete on the server — there is no undo. Always confirm first. */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>(`/api/v1/tasks/${id}`, { method: "DELETE" }),
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: qk.tasks.detail(id) });
      invalidateTaskViews(qc);
    },
  });
}
