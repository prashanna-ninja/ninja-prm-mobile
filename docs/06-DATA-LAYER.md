# 06 — Data Layer (TanStack Query)

**TanStack Query is the only cache in this app.** Server data lives there and nowhere else — not
in `useState`, not in a context, not in a global store. This doc is the contract for how we use
it, so caching behaviour is predictable instead of per-screen improvisation.

---

## 1. The three layers

```
screen  ──calls──►  src/api/<domain>.api.ts  ──calls──►  src/lib/api-client.ts  ──►  backend
 (UI)               (query/mutation hooks)               (apiFetch: URL, cookie,
                                                          JSON, ApiError)
```

**A screen never imports `apiFetch`, and never calls `fetch`.** If a screen needs data, there is a
hook for it; if there isn't, you add one to the right `*.api.ts` file.

### `lib/api-client.ts`

One function, ported from `ref/ninja-crm-mobile/src/lib/api-client.ts`:

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError"; }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cookie = authClient.getCookie();          // the Expo client won't do this for a plain fetch

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "omit",                          // ⚠️ REQUIRED on iOS — see 05 §4
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) authClient.signOut().catch(() => {});   // guard routes to sign-in
    let message = res.statusText || `Request failed (${res.status})`;
    try { const body = await res.json(); if (body?.error) message = body.error; } catch {}
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();                  // some endpoints 200 with an empty body
  if (!text) return undefined as T;
  try { return JSON.parse(text) as T; } catch { return undefined as T; }
}
```

**Only 401 signs out.** 403 means "not allowed", not "not logged in" — showing the sign-in screen
there strands the user.

---

## 2. Query keys

Keys come from **one factory**, never inlined. Ad-hoc keys are how invalidation quietly stops
working.

```ts
// src/lib/query-keys.ts
export const qk = {
  me: () => ["me"] as const,

  recordings: {
    all:    ()                          => ["recordings"] as const,
    stats:  ()                          => ["recordings", "stats"] as const,
    list:   (params: RecordingListParams) => ["recordings", "list", params] as const,
    detail: (source: RecordingSource, id: string) => ["recordings", "detail", source, id] as const,
    audio:  (source: RecordingSource, id: string) => ["recordings", "audio", source, id] as const,
  },

  recordingCategories: () => ["recording-categories"] as const,
  contacts: { list: (search: string) => ["contacts", "list", search] as const },
} as const;
```

Rules:

- **Hierarchical and prefix-invalidatable.** `invalidateQueries({ queryKey: qk.recordings.all() })`
  must clear every recordings list and detail. That only works if every recordings key starts with
  `"recordings"`.
- **The whole params object goes in the list key.** Search, source, sort and page all change the
  key structurally, so changing a filter is a cache miss → refetch, and going back is a cache hit
  → instant. No manual refetch plumbing.
- **Normalise params before they hit the key.** Trim the search string, apply defaults. `{search: ""}`
  and `{}` must produce the same key or you double the cache for nothing.

---

## 3. Client config

```ts
// src/lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,            // 30s — don't refetch on every remount
      gcTime: 5 * 60_000,           // keep unmounted data 5 min for instant back-navigation
      refetchOnWindowFocus: false,  // meaningless on native
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});
```

**Never retry on 4xx.** `retry: 1` retries once on anything; tighten it where it matters:

```ts
retry: (failureCount, error) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500 ? false : failureCount < 1,
```

---

## 4. Per-query caching policy

Stale times are a product decision, not a default. For v1:

| Data | `staleTime` | Why |
| ---- | ----------- | --- |
| Recordings **stats** (Home) | `60s` | Counts move slowly. Home is the landing screen on every cold start — a stale-but-instant number beats a spinner. |
| Recordings **list** | `30s` | New recordings arrive by webhook/sync; the user pulls to refresh when they want *now*. |
| Recording **detail** | `5 min` | A finished recording barely changes. Summaries/transcripts backfill occasionally. |
| Recording **audio URL** | `50 min`, `gcTime` 1h | Presigned URLs expire (~1h). Cache *below* the expiry so we never hand the player a dead URL. Set both from `expiresInSec` when the API returns it. |
| Categories | `10 min` | Rarely change. |
| `me` | `5 min` | Name/email/avatar for the settings screen. |
| Contacts (picker) | `2 min` | Only fetched when a picker opens. |

---

## 5. Patterns

### List screen

```ts
const [search, setSearch] = useState("");
const debouncedSearch = useDebouncedValue(search, 300);   // 300ms — same as the web feel
const [source, setSource] = useState<RecordingSourceFilter>("all");
const [sort, setSort] = useState<RecordingSort>({ sortBy: "date", sortOrder: "desc" });

const params = { search: debouncedSearch.trim(), source, ...sort };
const { data, isPending, isError, error, refetch, isRefetching } = useRecordings(params);
```

- `placeholderData: keepPreviousData` on the list so changing a filter doesn't flash a skeleton
  over content that's about to be replaced.
- Pull-to-refresh wires `refreshing={isRefetching}` / `onRefresh={refetch}`.
- **Four states, always:** `isPending` → skeleton · `isError` → message + Retry · empty array →
  empty state · otherwise the list.

### Pagination

The backend paginates with `page` / `pageSize` and returns `totalCount`. On a phone, use
`useInfiniteQuery` and an "end reached" trigger rather than page buttons:

```ts
useInfiniteQuery({
  queryKey: qk.recordings.list(params),
  queryFn: ({ pageParam = 1 }) => getRecordings({ ...params, page: pageParam }),
  getNextPageParam: (last) =>
    last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined,
  initialPageParam: 1,
});
```

⚠️ The server action merges four tables in memory and slices (`MAX_FETCH = 500`). Deep pagination
degrades and eventually truncates. Don't build "load more" past a few pages without checking with
the backend — noted in [BACKEND-CHANGES](implementation/BACKEND-CHANGES.md).

### Dashboard screen — independent queries, one refresh

Home runs **two separate queries** (`useRecordingStats()` and `useRecordings({ pageSize: 5 })`).
Do **not** merge them into one hook: if stats fail, the recent list should still render.

```ts
const stats  = useRecordingStats();
const recent = useRecordings({ pageSize: 5 });

const onRefresh = () => Promise.all([stats.refetch(), recent.refetch()]);
const refreshing = stats.isRefetching || recent.isRefetching;
```

Each block owns its own loading/error UI. Pull-to-refresh refetches both.

> `useRecordings({ pageSize: 5 })` and the list's `useRecordings({ pageSize: 20, … })` are
> different keys, so Home and the list each keep their own cache entry. That's intended — Home
> stays instant and the list keeps its scroll position.

### Detail screen — seed from the list

Going list → detail should render instantly, not flash a spinner for data we already have:

```ts
const qc = useQueryClient();
useRecording(source, id, {
  placeholderData: () => findInCachedLists(qc, source, id),   // title, date, summary, contacts
});
```

Show the seeded fields immediately, and let transcript / action items / audio fill in.

### Mutations (when we add writes)

```ts
const qc = useQueryClient();
useMutation({
  mutationFn: (id: string) => apiFetch(`/api/v1/recordings/${source}/${id}/archive`, { method: "POST" }),
  onSuccess: (_d, id) => {
    qc.invalidateQueries({ queryKey: qk.recordings.all() });     // lists + counts
    qc.invalidateQueries({ queryKey: qk.recordings.detail(source, id) });
  },
});
```

Optimistic updates only where the action is instant and obviously reversible (archive, category).
Never optimistic on anything that sends an email or costs money.

---

## 6. Offline & connectivity

v1 is **online-only**, deliberately. But:

- TanStack Query's cache means a screen you visited a minute ago still renders from memory.
- Add `onlineManager` wiring via `expo-network` so queries pause rather than fail in a tunnel.
- Never persist the query cache to disk in v1 — recordings contain call transcripts, i.e.
  sensitive client conversation content. Writing them to unencrypted `AsyncStorage` is not
  something to do casually. If we want offline transcripts later, that's a scoped piece of work
  with encryption, not a one-line persister.

---

## 7. Anti-patterns (rejected in review)

- ❌ `useState` holding server data, synced by `useEffect`.
- ❌ `fetch` inside a component.
- ❌ Inline query keys (`["recordings", search, source, page]` written out at each call site).
- ❌ `refetch()` called from an effect to "make it update" — fix the key or invalidate instead.
- ❌ `staleTime: Infinity` to stop a refetch loop; find the unstable key (usually a fresh object
  literal in the key).
- ❌ One giant `useRecordings()` that also fetches categories and contacts. One hook, one resource.
