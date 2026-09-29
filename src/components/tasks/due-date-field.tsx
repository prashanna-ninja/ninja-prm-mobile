import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import * as React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "@/lib/icons";
import { quickDueDays } from "@/lib/tasks";

/**
 * Due-date picker: quick picks for the common case, a month grid for the rest.
 *
 * The grid is plain JS rather than @react-native-community/datetimepicker on
 * purpose — that's a native module, so it would need a new native build and
 * behaves differently per platform, and a due date is date-only anyway.
 */
export function DueDateField({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (next: Date | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const quick = quickDueDays();
  const isQuick = value ? quick.some((q) => isSameDay(q.day, value)) : false;
  const custom = value && !isQuick ? value : null;

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        <Option label="No date" active={value === null} onPress={() => onChange(null)} />
        {quick.map((q) => (
          <Option
            key={q.label}
            label={q.label}
            active={!!value && isSameDay(q.day, value)}
            onPress={() => onChange(q.day)}
          />
        ))}
        <Option
          label={custom ? format(custom, "EEE d MMM yyyy") : "Pick a date"}
          icon
          active={!!custom}
          onPress={() => setPickerOpen(true)}
        />
      </View>

      <CalendarSheet
        visible={pickerOpen}
        value={value}
        onClose={() => setPickerOpen(false)}
        onSelect={(day) => {
          onChange(day);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

function Option({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 active:opacity-70 ${
        active ? "border-primary bg-primary" : "border-border bg-card"
      }`}
    >
      {icon ? (
        <CalendarDays
          size={14}
          color={active ? "#FFFFFF" : "#71717A"}
          strokeWidth={2}
        />
      ) : null}
      <Text
        className={`font-sans-medium text-[13px] ${
          active ? "text-primary-foreground" : "text-card-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function CalendarSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onSelect: (day: Date) => void;
}) {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = React.useState(() => startOfMonth(value ?? new Date()));

  React.useEffect(() => {
    if (visible) setMonth(startOfMonth(value ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Always six rows, Monday-first, so the sheet doesn't jump height between
  // months.
  const gridStart = startOfWeek(month, { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = startOfDay(new Date());

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl bg-background px-5"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="flex-row items-center gap-3 pb-4 pt-1">
            <Text className="min-w-0 flex-1 font-display text-[22px] text-foreground">
              Due date
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={12}
              className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
            >
              <X size={18} color="#71717A" strokeWidth={2.2} />
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between pb-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => setMonth((m) => addMonths(m, -1))}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <ChevronLeft size={18} color="#52525B" strokeWidth={2} />
            </Pressable>
            <Text className="font-sans-semibold text-[15px] text-foreground">
              {format(month, "MMMM yyyy")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => setMonth((m) => addMonths(m, 1))}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <ChevronRight size={18} color="#52525B" strokeWidth={2} />
            </Pressable>
          </View>

          <View className="flex-row">
            {WEEKDAYS.map((d, i) => (
              <Text
                key={i}
                className="flex-1 pb-2 text-center font-sans-medium text-xs text-muted-foreground"
              >
                {d}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {days.map((day) => {
              const selected = !!value && isSameDay(day, value);
              const inMonth = isSameMonth(day, month);
              const isToday = isSameDay(day, today);
              return (
                <View key={day.toISOString()} style={{ width: `${100 / 7}%` }} className="items-center py-1">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={format(day, "EEEE d MMMM yyyy")}
                    accessibilityState={{ selected }}
                    onPress={() => onSelect(day)}
                    className={`h-10 w-10 items-center justify-center rounded-full active:opacity-60 ${
                      selected ? "bg-primary" : isToday ? "border border-primary" : ""
                    }`}
                  >
                    <Text
                      className={`font-sans-medium text-[15px] ${
                        selected
                          ? "text-primary-foreground"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                      style={!selected && !inMonth ? { opacity: 0.5 } : undefined}
                    >
                      {format(day, "d")}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
