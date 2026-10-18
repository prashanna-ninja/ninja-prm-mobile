import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Check, Phone, X } from "@/lib/icons";
import type { SmsLine } from "@/types/sms.types";

/** Which of my numbers a text goes out from — the web's "From Ben CLS LEGACY" chip. */
export function LinePickerSheet({
  visible,
  lines,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  lines: SmsLine[];
  value: string | null;
  onClose: () => void;
  onSelect: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        {/* Swallow taps on the sheet itself so only the backdrop closes it. */}
        <Pressable
          className="gap-3 rounded-t-3xl bg-background px-5"
          style={{ paddingBottom: insets.bottom + 16 }}
          onPress={() => {}}
        >
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="flex-row items-center gap-3">
            <Text className="min-w-0 flex-1 font-display text-[22px] text-foreground">
              Send from
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

          <View className="gap-2">
            {lines.map((line) => {
              const active = line.key === value;
              return (
                <Pressable
                  key={line.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => onSelect(line.key)}
                  className={`flex-row items-center gap-3 rounded-lg border p-3.5 active:opacity-70 ${
                    active ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
                >
                  <Phone size={16} color={active ? "#AD5100" : "#71717A"} strokeWidth={2} />
                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={1}
                      className="font-sans-medium text-[15px] text-card-foreground"
                    >
                      {line.label}
                    </Text>
                    <Text className="font-sans text-xs text-muted-foreground">
                      {line.display}
                      {line.isDefault ? " · Default" : ""}
                    </Text>
                  </View>
                  {active ? <Check size={18} color="#AD5100" strokeWidth={2.4} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
