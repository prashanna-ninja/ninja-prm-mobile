import * as React from "react";

import { authClient } from "@/lib/auth-client";

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

type SessionData = {
  user: SessionUser;
} | null;

type SessionState = {
  data: SessionData;
  isPending: boolean;
  error: unknown;
  /** Re-read the session from the server (after a deep-link sign-in). */
  refetch: () => Promise<void>;
  /** Sign out and clear local session state. */
  signOut: () => Promise<void>;
};

const SessionContext = React.createContext<SessionState | null>(null);

/**
 * The app's session, held in plain React state.
 *
 * ⚠️ DO NOT replace this with `authClient.useSession()`.
 *
 * Better Auth's React hook is built on `useStore`
 * (dist/client/react/index.mjs), which backs `useSyncExternalStore` with a
 * `getSnapshot` that reads a ref its own `subscribe` mutates:
 *
 *     let snapshotRef = useRef(store.get());
 *     let get = () => snapshotRef.current;
 *     return useSyncExternalStore(subscribe, get, get);
 *
 * When the session fetch resolves mid-render, that snapshot differs between
 * React's render-phase and commit-phase reads. React 19 treats it as tearing,
 * throws, and re-renders the whole root synchronously, logging:
 *
 *   "There was an error during concurrent rendering but React was able to
 *    recover by instead synchronously rendering the entire root."
 *
 * Driving the session from `useState` + an effect sidesteps the external-store
 * machinery completely — there is no snapshot for React to find inconsistent.
 * We only use the public `getSession()` / `signOut()` API, so this doesn't
 * depend on Better Auth's internal atom names either.
 *
 * The trade-off: the session no longer updates itself reactively. That's fine
 * because we own every transition — the deep-link return calls `refetch()`,
 * and sign-out goes through `signOut()` here.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<SessionData>(null);
  const [isPending, setIsPending] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  // Guards against a late response from a superseded request overwriting a
  // newer one (e.g. deep-link refetch landing before the initial load).
  const requestIdRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const result = await authClient.getSession();
      if (requestId !== requestIdRef.current) return;

      setData((result?.data as SessionData) ?? null);
      setError(result?.error ?? null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      // A network failure means "we don't know", not "signed out" — keep the
      // user out of the app but surface the error rather than pretending.
      setData(null);
      setError(err);
    } finally {
      if (requestId === requestIdRef.current) setIsPending(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const signOut = React.useCallback(async () => {
    // Optimistic: the guard should move immediately, and a failed sign-out
    // still means the local session is gone as far as this device cares.
    requestIdRef.current++;
    setData(null);
    setError(null);
    try {
      await authClient.signOut();
    } catch {
      // Already cleared locally; nothing useful to show the user.
    }
  }, []);

  const value = React.useMemo<SessionState>(
    () => ({ data, isPending, error, refetch: load, signOut }),
    [data, isPending, error, load, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** The app-wide session. Must be used under <SessionProvider>. */
export function useSession(): SessionState {
  const ctx = React.useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within <SessionProvider>");
  }
  return ctx;
}
