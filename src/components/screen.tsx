import type * as React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

/**
 * App-wide page shell: safe-area insets + themed background.
 *
 * Only the top edge by default — the tab bar owns the bottom inset, and
 * claiming it here would double the padding above it.
 */
export function Screen({
  className,
  edges = ["top"],
  ...props
}: React.ComponentProps<typeof SafeAreaView>) {
  return (
    <SafeAreaView
      className={cn("flex-1 bg-background", className)}
      edges={edges}
      {...props}
    />
  );
}
