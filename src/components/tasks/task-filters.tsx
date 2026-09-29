import { Pressable, ScrollView, Text, View } from "react-native";

import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskPriority,
} from "@/types/task.types";

/** "Open" is the default view — it's the to-do list; the rest is history. */
export type TaskView = "OPEN" | "DONE" | "ALL";

const VIEWS: { value: TaskView; label: string }[] = [
  { value: "OPEN", label: "To do" },
  { value: "DONE", label: "Done" },
  { value: "ALL", label: "All" },
];

/**
 * View + priority chips in one scrolling row, like the contacts filter.
 * The views are exclusive; priority is a separate toggle, and tapping the
 * active priority clears it.
 */
export function TaskFilters({
  view,
  onViewChange,
  priority,
  onPriorityChange,
  total,
}: {
  view: TaskView;
  onViewChange: (next: TaskView) => void;
  priority: TaskPriority | null;
  onPriorityChange: (next: TaskPriority | null) => void;
  total?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="items-center gap-2 pr-4"
      keyboardShouldPersistTaps="handled"
    >
      {VIEWS.map((v) => (
        <Chip
          key={v.value}
          label={v.label}
          count={view === v.value ? total : undefined}
          active={view === v.value}
          onPress={() => onViewChange(v.value)}
        />
      ))}

      <View className="mx-1 h-5 w-px bg-border" />

      {[...TASK_PRIORITIES].reverse().map((p) => (
        <Chip
          key={p}
          label={TASK_PRIORITY_LABELS[p]}
          active={priority === p}
          onPress={() => onPriorityChange(priority === p ? null : p)}
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
