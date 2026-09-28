import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type {
  ContactDetail,
  ContactListParams,
  ContactListResponse,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contact.types";

function buildQuery(params: ContactListParams) {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
    sortBy: params.sortBy ?? "name",
    sortOrder: params.sortOrder ?? "asc",
    archived: String(params.archived ?? false),
  });
  const search = params.search?.trim();
  if (search) qs.set("search", search);
  // Only ever send a real enum value — an invalid one 500s server-side.
  if (params.relationshipType) {
    qs.set("relationshipType", params.relationshipType);
  }
  return qs.toString();
}

export function getContacts(params: ContactListParams) {
  return apiFetch<ContactListResponse>(`/api/v1/contacts?${buildQuery(params)}`);
}

export function useInfiniteContacts(params: Omit<ContactListParams, "page">) {
  return useInfiniteQuery({
    queryKey: qk.contacts.list(params),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getContacts({ ...params, page: pageParam }),
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
    // Keep the old list on screen while a filter change loads.
    placeholderData: (prev) => prev,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: qk.contacts.detail(id),
    queryFn: () => apiFetch<ContactDetail>(`/api/v1/contacts/${id}`),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) =>
      apiFetch<ContactDetail>("/api/v1/contacts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contacts.all() });
    },
  });
}

export function useUpdateContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateContactInput) =>
      apiFetch<ContactDetail>(`/api/v1/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contacts.all() });
    },
  });
}

export function useArchiveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      apiFetch<ContactDetail>(
        `/api/v1/contacts/${id}/${archived ? "archive" : "unarchive"}`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contacts.all() });
    },
  });
}

/** ⚠️ A hard delete on the server — there is no undo. Always confirm first. */
export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: true }>(`/api/v1/contacts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.contacts.all() });
    },
  });
}
