import * as React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  INTERACTION_LABELS,
  INTERACTION_TYPES,
  useLogInteraction,
  type InteractionType,
} from "@/api/interactions.api";
import { describeError } from "@/components/ui/states";
import { X } from "@/lib/icons";

/**
 * Log that you spoke to someone.
 *
 * `occurredAt` defaults to now and isn't editable here — on a phone you log
 * an interaction right after it happens, and a date picker for "now" is three
 * taps of friction for the common case. Backdating can come later if anyone
 * actually wants it.
 */
export function LogInteractionSheet({
  contactId,
  contactName,
  visible,
  onClose,
}: {
  contactId: string;
  contactName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const log = useLogInteraction(contactId);

  const [type, setType] = React.useState<InteractionType>("CALL");
  const [summary, setSummary] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;
    setType("CALL");
    setSummary("");
    setError(null);
    log.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const onSave = async () => {
    if (log.isPending) return;
    setError(null);
    try {
      await log.mutateAsync({
        type,
        // Required by the server. Full ISO with offset so the server's
        // timezone conversion lands on the right day.
        occurredAt: new Date().toISOString(),
        summary: summary.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  };

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
          className="max-h-[90%] rounded-t-3xl bg-background"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerClassName="px-5 pb-4 gap-5"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-start gap-3 pt-1">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-display text-[22px] text-foreground">
                  Log interaction
                </Text>
                <Text
                  numberOfLines={1}
                  className="font-sans text-[13px] text-muted-foreground"
                >
                  With {contactName}
                </Text>
              </View>
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
              <Text className="font-sans-semibold text-[13px] text-foreground">
                Type
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {INTERACTION_TYPES.map((t) => {
                  const active = type === t;
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setType(t)}
                      className={`rounded-full border px-3.5 py-2 active:opacity-70 ${
                        active
                          ? "border-primary bg-primary"
                          : "border-border bg-card"
                      }`}
                    >
                      <Text
                        className={`font-sans-medium text-[13px] ${
                          active
                            ? "text-primary-foreground"
                            : "text-card-foreground"
                        }`}
                      >
                        {INTERACTION_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <Text className="font-sans-semibold text-[13px] text-foreground">
                What happened?
              </Text>
              <TextInput
                value={summary}
                onChangeText={setSummary}
                placeholder="Optional — a line you'll thank yourself for later"
                placeholderTextColor="#A1A1AA"
                selectionColor="#FF8900"
                multiline
                textAlignVertical="top"
                className="min-h-[88px] rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] leading-[21px] text-foreground"
              />
              <Text className="font-sans text-xs text-muted-foreground">
                Logged as happening now.
              </Text>
            </View>

            {error ? (
              <View
                accessibilityLiveRegion="polite"
                className="rounded-xl bg-destructive-soft px-3.5 py-3"
              >
                <Text className="font-sans text-[13px] leading-[19px] text-destructive">
                  {error}
                </Text>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                disabled={log.isPending}
                className="h-12 flex-1 items-center justify-center rounded-xl border border-border active:opacity-70"
              >
                <Text className="font-sans-medium text-[15px] text-foreground">
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: log.isPending }}
                onPress={onSave}
                disabled={log.isPending}
                className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
                style={{ opacity: log.isPending ? 0.6 : 1 }}
              >
                {log.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : null}
                <Text className="font-sans-semibold text-[15px] text-primary-foreground">
                  {log.isPending ? "Saving…" : "Log it"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
