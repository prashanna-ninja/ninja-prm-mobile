import * as React from "react";
import { Animated, Easing, View } from "react-native";

import { cn } from "@/lib/utils";

/** A pulsing placeholder block. Give it the same geometry as the real content. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: object;
}) {
  const pulse = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[{ opacity: pulse }, style]}>
      <View className={cn("rounded-md bg-muted", className)} />
    </Animated.View>
  );
}

/** A list of recording-row-shaped skeletons. */
export function RecordingRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className="flex-row gap-3 rounded-lg border border-border bg-card p-3"
        >
          <Skeleton className="h-10 w-10 rounded-md" />
          <View className="flex-1 gap-2 py-0.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/5" />
          </View>
        </View>
      ))}
    </View>
  );
}
