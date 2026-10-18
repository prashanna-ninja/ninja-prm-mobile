import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * The on-screen keyboard's height in px (0 when closed).
 *
 * **Why this exists instead of `KeyboardAvoidingView`.** `app.json` sets
 * `edgeToEdgeEnabled: true`, and under Android edge-to-edge the window no
 * longer resizes when the keyboard opens — so `KeyboardAvoidingView` computes
 * a padding of zero and a bottom-anchored composer stays hidden *behind* the
 * keyboard (CLAUDE.md gotcha 6). Measuring the keyboard ourselves works
 * the same way on both platforms, because neither actually resizes the window.
 *
 * Apply the value as `paddingBottom`/`marginBottom` on the bottom-anchored
 * element — but the safe-area inset is handled **differently per platform**:
 *
 * - **Android:** the keyboard is drawn *above* the navigation bar and the
 *   reported height excludes it, so you must **add `insets.bottom` back** or
 *   the element sits under the keyboard's edge.
 * - **iOS:** the keyboard already extends through the home-indicator strip, so
 *   adding the inset there leaves a visible gap. Use the raw height.
 *
 * See `components/messages/message-composer.tsx` for the reference usage.
 *
 * iOS uses the `Will` events so the movement animates in step with the
 * keyboard; Android only fires the `Did` events reliably.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) =>
      setHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
