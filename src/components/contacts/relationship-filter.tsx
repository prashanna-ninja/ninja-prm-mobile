import { Pressable, ScrollView, Text } from "react-native";

import {
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from "@/types/contact.types";

/**
 * Relationship-type filter chips.
 *
 * Chips rather than the web's Filters dialog: there are only eight values and
 * one filter, so a dialog would be two extra taps for something a horizontal
 * scroll shows outright.
 */
export function RelationshipFilter({
  value,
  onChange,
  total,
}: {
  value: RelationshipType | null;
  onChange: (next: RelationshipType | null) => void;
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
        active={value === null}
        onPress={() => onChange(null)}
      />
      {RELATIONSHIP_TYPES.map((type) => (
        <Chip
          key={type}
          label={RELATIONSHIP_LABELS[type]}
          active={value === type}
          // Tapping the active chip clears it — otherwise there's no way back
          // to "All" without scrolling the row back to the start.
          onPress={() => onChange(value === type ? null : type)}
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
