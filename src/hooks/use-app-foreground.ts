/** Copied from ref: ../ninja_crm_mobile/src/hooks/use-app-foreground.ts. */
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Run a callback each time the app returns to the foreground.
 *
 * **Why this exists.** `refetchInterval` only ticks while the app is actually
 * running: lock the phone or switch apps and React Native suspends the JS
 * timers. Come back and the screen is showing whatever it had when you left.
 * The web sidesteps this with `refetchOnWindowFocus`, which the query client
 * disables here because a native app has no window to focus
 * (`lib/query-client.ts`). This is the native equivalent, opted into per
 * query rather than switched on globally.
 *
 * **The transition check is the whole trick.** `AppState` also emits
 * `"inactive"` for things that are not really backgrounding — pulling down
 * Control Centre, an incoming call banner, the iOS app switcher. Firing on
 * every event would refetch several times for one glance at a notification
 * shade, so we only fire on a genuine background → active edge.
 *
 * The callback is held in a ref so that passing an inline arrow function
 * doesn't tear down and re-add the listener on every render.
 */
export function useAppForeground(onForeground: () => void): void {
  const callback = useRef(onForeground);
  callback.current = onForeground;

  useEffect(() => {
    let previous: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener("change", (next) => {
      if (/inactive|background/.test(previous) && next === "active") {
        callback.current();
      }
      previous = next;
    });

    return () => subscription.remove();
  }, []);
}
