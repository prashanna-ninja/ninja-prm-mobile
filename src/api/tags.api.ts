import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { qk } from "@/lib/query-keys";
import type { Tag, TagWithCount } from "@/types/contact.types";

/**
 * The user's tags (`ref/prm/src/app/api/v1/tags/route.ts`). Tags belong to
 * the user, not to a contact; a contact's set is changed by sending `tagIds`
 * with the contact's PATCH/POST.
 */
export function useTags() {
  return useQuery({
    queryKey: qk.tags.all(),
    queryFn: () => apiFetch<{ tags: TagWithCount[] }>("/api/v1/tags"),
    select: (d) => d.tags,
    staleTime: 5 * 60_000,
  });
}

/**
 * Create a tag. The server answers 409 if the user already has one with this
 * exact name. Callers should match an existing tag by name first.
 */
export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) =>
      apiFetch<Tag>("/api/v1/tags", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.tags.all() });
    },
  });
}
