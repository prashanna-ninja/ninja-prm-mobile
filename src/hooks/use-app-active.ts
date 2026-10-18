import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Whether the app is in the foreground.
 *
 * TanStack Query's `refetchInterval` keeps firing while a screen is mounted —
 * including, on Android, for a while after the app is backgrounded. Polling
 * hooks gate their interval on this so a phone in a pocket isn't hitting the
 * server every 15 seconds.
 */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => sub.remove();
  }, []);

  return active;
}
