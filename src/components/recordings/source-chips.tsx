import { Pressable, ScrollView, Text } from "react-native";

import { SOURCE_META, SOURCE_ORDER } from "@/lib/recordings";
import type {
  RecordingSource,
  RecordingSourceFilter,
} from "@/types/recording.types";

/**
 * Source filter chips.
 *
 * Counts stay visible on every chip, including the inactive ones, so the user
 * can see what they're excluding rather than wondering where things went.
 */
export function SourceChips({
  value,
  onChange,
  counts,
  total,
}: {
  value: RecordingSourceFilter;
  onChange: (next: RecordingSourceFilter) => void;
  counts?: Record<RecordingSource, number>;
  total?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pr-4"
      keyboardShouldPersistTaps="handled"
    >
      <Chip
        label="All"
        count={total}
        active={value === "all"}
        onPress={() => onChange("all")}
      />
      {SOURCE_ORDER.map((source) => (
        <Chip
          key={source}
          label={SOURCE_META[source].label}
          count={counts?.[source]}
          active={value === source}
          onPress={() => onChange(source)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      onPress={onPress}
      className={`h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 active:opacity-70 ${
        active ? "border-primary bg-primary" : "border-border bg-card"
      }`}
    >
      <Text
        className={`font-sans-medium text-[13px] ${
          active ? "text-primary-foreground" : "text-card-foreground"
        }`}
      >
        {label}
      </Text>
      {count != null ? (
        <Text
          className={`font-sans text-[12px] ${
            active ? "text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
