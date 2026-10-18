import { Pressable, ScrollView, Text, View } from "react-native";

import type { SmsFilter, SmsLine } from "@/types/sms.types";

const FILTERS: { value: SmsFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "contacts", label: "Contacts" },
  { value: "unknown", label: "Unknown" },
];

/**
 * The web's All / Unread / Contacts / Unknown tabs and its "All my numbers"
 * dropdown, folded into one scrolling chip row like the Contacts and Tasks
 * filters. The number chips only appear when there's more than one line —
 * with a single number there's nothing to choose between.
 */
export function MessageFilters({
  filter,
  onFilterChange,
  lineKey,
  onLineChange,
  lines,
}: {
  filter: SmsFilter;
  onFilterChange: (next: SmsFilter) => void;
  lineKey: string | null;
  onLineChange: (next: string | null) => void;
  lines: SmsLine[];
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="items-center gap-2 pr-4"
      keyboardShouldPersistTaps="handled"
    >
      {FILTERS.map((f) => (
        <Chip
          key={f.value}
          label={f.label}
          active={filter === f.value}
          onPress={() => onFilterChange(f.value)}
        />
      ))}

      {lines.length > 1 ? (
        <>
          <View className="mx-1 h-5 w-px bg-border" />
          {lines.map((line) => (
            <Chip
              key={line.key}
              label={line.label}
              active={lineKey === line.key}
              // Tapping the active number goes back to "All my numbers".
              onPress={() => onLineChange(lineKey === line.key ? null : line.key)}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`h-9 flex-row items-center rounded-full border px-3.5 active:opacity-70 ${
        active ? "border-primary bg-primary" : "border-border bg-card"
      }`}
    >
      <Text
        numberOfLines={1}
        className={`font-sans-medium text-[13px] ${
          active ? "text-primary-foreground" : "text-card-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
