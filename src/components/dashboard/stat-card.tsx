import { Pressable, Text, View } from "react-native";

import { TrendingDown, TrendingUp } from "@/lib/icons";

/**
 * One big number with a label and an optional trend.
 *
 * Deliberately restrained: the number is the display face, everything else is
 * muted. Two of these sit side by side on Home, and if both shouted the eye
 * would have nowhere to land.
 */
export function StatCard({
  label,
  value,
  /** Percentage change vs. the previous period. Null hides the trend row. */
  trend,
  trendLabel,
  /** Shown instead of the trend when there's nothing to compare against. */
  hint,
  /** Orange number + tinted surface — for the one card that's actionable. */
  accent = false,
  onPress,
}: {
  label: string;
  value: string | number;
  trend?: number | null;
  trendLabel?: string;
  hint?: string;
  accent?: boolean;
  onPress?: () => void;
}) {
  const showTrend = typeof trend === "number" && Number.isFinite(trend);
  const isUp = showTrend && trend > 0;
  const isFlat = showTrend && trend === 0;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      disabled={!onPress}
      className={`flex-1 gap-1 rounded-lg border p-4 ${
        accent
          ? "border-primary/30 bg-primary-soft"
          : "border-border bg-card"
      } ${onPress ? "active:opacity-70" : ""}`}
    >
      <Text className="font-sans text-xs text-muted-foreground">{label}</Text>

      <Text
        className={`font-display text-[28px] ${
          accent ? "text-primary-strong" : "text-card-foreground"
        }`}
        style={{ letterSpacing: -0.6 }}
      >
        {value}
      </Text>

      {showTrend ? (
        <View className="flex-row items-center gap-1">
          {isFlat ? null : isUp ? (
            <TrendingUp size={13} color="#16A34A" strokeWidth={2.2} />
          ) : (
            <TrendingDown size={13} color="#DC2626" strokeWidth={2.2} />
          )}
          <Text
            className="font-sans text-xs"
            style={{ color: isFlat ? "#71717A" : isUp ? "#16A34A" : "#DC2626" }}
          >
            {isFlat ? "No change" : `${isUp ? "+" : ""}${trend}%`}
            {trendLabel ? ` ${trendLabel}` : ""}
          </Text>
        </View>
      ) : hint ? (
        <Text className="font-sans text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </Pressable>
  );
}
