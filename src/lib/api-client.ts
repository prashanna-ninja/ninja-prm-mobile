import { API_BASE_URL } from "@/constants/env";
import { authClient } from "@/lib/auth-client";

/** Thrown for any non-2xx response, carrying the HTTP status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The single place all app → backend requests go through.
 * Base URL, JSON headers, auth and error handling live here once.
 *
 * ⚠️ Two non-obvious requirements, both learned the hard way on the sibling
 * Ninja CRM app — do not remove either:
 *
 * 1. We send the `Cookie` header OURSELVES. The Better Auth Expo client only
 *    attaches the session cookie to its own `authClient.*` calls; a plain
 *    `fetch` gets nothing and every authed endpoint 401s.
 *
 * 2. `credentials: "omit"` is REQUIRED. On iOS, NSURLSession keeps its own
 *    cookie jar and appends its copy ON TOP of our header, producing a
 *    duplicated `__Secure-…=a,__Secure-…=b` the server can't parse → 500s that
 *    look like "logged out". `omit` forces ONLY our explicit header. Android is
 *    unaffected either way.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const cookie = authClient.getCookie();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    // 401 = the session is invalid/expired. Clear it so the root guard sends
    // the user back to sign-in rather than stranding them in a logged-in UI
    // where every call fails.
    //
    // 403 means "not allowed", NOT "not authenticated" — deliberately does not
    // sign out.
    //
    // ⚠️ Note: the PRM's OLDER /api/v1/* routes (contacts, call-recordings, …)
    // return 500 rather than 401 when unauthenticated, because requireApiAuth()
    // throws instead of returning a response. Verified in production
    // 2026-09-15. The recordings routes we actually use map 401 correctly; if
    // we ever call an older route, an expired session will surface as a generic
    // error instead of a redirect to sign-in.
    if (res.status === 401) {
      authClient.signOut().catch(() => {});
    }

    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      // Response wasn't JSON — keep the status text.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;

  // Some endpoints reply 200 with an empty or non-JSON body; res.json() throws
  // on an empty body, which would silently reject the caller's request.
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}
