import * as React from "react";
import { Animated, Easing, type ViewProps } from "react-native";

/**
 * A small entrance animation: fade + rise.
 *
 * Uses React Native's built-in Animated (not Reanimated) on purpose — this needs
 * no Babel plugin and no worklets, so it can't break a build. `useNativeDriver`
 * keeps it off the JS thread, which is all a fade/translate needs.
 *
 * Stagger a group by passing an increasing `delay` (60–70ms reads well).
 */
export function FadeIn({
  delay = 0,
  distance = 10,
  duration = 420,
  style,
  children,
  ...props
}: ViewProps & { delay?: number; distance?: number; duration?: number }) {
  // useRef so the value survives re-renders and the animation isn't restarted.
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}
