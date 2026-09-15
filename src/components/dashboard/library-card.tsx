import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ChevronRight } from "@/lib/icons";
import { formatTotalDuration, pluralize } from "@/lib/format";
import { SOURCE_META, SOURCE_ORDER } from "@/lib/recordings";
import type { RecordingStats } from "@/types/recording.types";

/**
 * The four sources with their counts, each a shortcut into the Recordings tab
 * pre-filtered. Four numbers that are genuinely informative (is Granola even
 * syncing?) doubling as navigation.
 */
export function LibraryCard({ stats }: { stats: RecordingStats }) {
  const router = useRouter();

  return (
    <View className="overflow-hidden rounded-lg border border-border bg-card">
      {SOURCE_ORDER.map((source, index) => {
        const meta = SOURCE_META[source];
        const Icon = meta.icon;
        const count = stats.bySource?.[source] ?? 0;

        return (
          <Pressable
            key={source}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label}: ${pluralize(count, "recording")}`}
            onPress={() =>
              router.push({ pathname: "/recordings", params: { source } })
            }
            className={`flex-row items-center gap-3 px-4 py-3 active:opacity-70 ${
              index > 0 ? "border-t border-border" : ""
            }`}
          >
            <View className="h-8 w-8 items-center justify-center rounded-md bg-primary-soft">
              <Icon size={16} color="#FF8900" strokeWidth={2} />
            </View>

            <Text className="flex-1 font-sans text-sm text-card-foreground">
              {meta.label}
            </Text>

            {/* Zero is information too — it usually means a broken sync. */}
            <Text
              className={`font-sans-medium text-sm ${
                count === 0 ? "text-muted-foreground" : "text-card-foreground"
              }`}
            >
              {count}
            </Text>
            <ChevronRight size={15} color="#A1A1AA" strokeWidth={2} />
          </Pressable>
        );
      })}

      <View className="border-t border-border bg-muted/40 px-4 py-2.5">
        <Text className="font-sans text-xs text-muted-foreground">
          {pluralize(stats.total ?? 0, "recording")}
          {stats.totalDurationSec
            ? ` · ${formatTotalDuration(stats.totalDurationSec)} captured`
            : ""}
        </Text>
      </View>
    </View>
  );
}
