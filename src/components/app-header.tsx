import type * as React from "react";
import { Text, View } from "react-native";

/**
 * The app-wide screen header. Put it at the top of every (app) screen so the
 * title typography and spacing are identical everywhere.
 */
export function AppHeader({
  title,
  subtitle,
  left,
  right,
  /** Raise for a title that intentionally wraps (e.g. the Home greeting). */
  titleLines = 1,
}: {
  title: string;
  subtitle?: string;
  /** Leading action — a back arrow on pushed screens. */
  left?: React.ReactNode;
  /** Trailing action, aligned to the first line of the title. */
  right?: React.ReactNode;
  titleLines?: number;
}) {
  return (
    <View className="gap-1 pb-2 pt-1">
      <View className="flex-row items-start gap-3">
        {left}

        <Text
          numberOfLines={titleLines}
          className="min-w-0 flex-1 font-display text-[28px] text-foreground"
          style={{ letterSpacing: -0.7, lineHeight: 34 }}
        >
          {title}
        </Text>

        {right}
      </View>

      {subtitle ? (
        <Text
          className="font-sans text-sm text-muted-foreground"
          // Keep the subtitle aligned under the TITLE, not under the back
          // arrow, so the header reads as one column of text.
          style={left ? { paddingLeft: 52 } : undefined}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
