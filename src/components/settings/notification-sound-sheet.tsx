import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { describeError } from "@/components/ui/states";
import { Check, Volume2, X } from "@/lib/icons";
import { PUSH_SOUND_CATEGORIES, PUSH_SOUNDS, type PushSound } from "@/lib/push-sounds";
import { usePush } from "@/providers/push-provider";

/**
 * Settings → Notifications → Sound. Tapping a sound plays it and makes it this
 * device's sound for every push. The sheet stays open, so people can try a few;
 * the tick shows only once the server has the choice.
 */
export function NotificationSoundSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const push = usePush();
  const player = useAudioPlayer(null);
  const [pending, setPending] = React.useState<string | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) {
      player.pause();
      setError(null);
      return;
    }
    // The preview should be heard even with the iPhone's silent switch on:
    // the person is choosing a sound on purpose.
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, [visible, player]);

  const preview = (sound: PushSound) => {
    try {
      player.replace(sound.asset);
      void player.seekTo(0);
      player.play();
    } catch {
      // A failed preview mustn't stop the choice from saving.
    }
  };

  const choose = async (id: string | null) => {
    const sound = PUSH_SOUNDS.find((s) => s.id === id);
    if (sound) preview(sound);
    else player.pause();
    if (pending !== undefined || id === push.sound) return;

    setError(null);
    setPending(id);
    try {
      const result = await push.setSound(id);
      if (result.status === "unavailable") setError("The server isn't ready for notification sounds yet.");
      if (result.status === "error") setError(`Couldn't save the sound: ${result.message}`);
    } catch (err) {
      setError(`Couldn't save the sound: ${describeError(err)}`);
    } finally {
      setPending(undefined);
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
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        {/* Swallow taps on the sheet itself so only the backdrop closes it. */}
        <Pressable
          className="max-h-[85%] gap-3 rounded-t-3xl bg-background px-5"
          style={{ paddingBottom: insets.bottom + 16 }}
          onPress={() => {}}
        >
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="flex-row items-center gap-3">
            <Text className="min-w-0 flex-1 font-display text-[22px] text-foreground">
              Notification sound
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

          {error ? (
            <Text className="font-sans text-xs leading-[17px] text-destructive">{error}</Text>
          ) : null}

          <ScrollView contentContainerClassName="gap-4 pb-2" showsVerticalScrollIndicator={false}>
            <SoundRow
              label="Phone default"
              description="Your phone's standard notification sound"
              active={push.sound === null}
              saving={pending === null}
              onPress={() => void choose(null)}
            />

            {PUSH_SOUND_CATEGORIES.map((category) => (
              <View key={category.key} className="gap-2">
                <Text className="font-sans-semibold text-xs uppercase tracking-wide text-muted-foreground">
                  {category.label}
                </Text>
                {PUSH_SOUNDS.filter((s) => s.category === category.key).map((s) => (
                  <SoundRow
                    key={s.id}
                    label={s.name}
                    active={push.sound === s.id}
                    saving={pending === s.id}
                    onPress={() => void choose(s.id)}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SoundRow({
  label,
  description,
  active,
  saving,
  onPress,
}: {
  label: string;
  description?: string;
  active: boolean;
  saving: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-lg border p-3.5 active:opacity-70 ${
        active ? "border-primary bg-primary-soft" : "border-border bg-card"
      }`}
    >
      <Volume2 size={16} color={active ? "#AD5100" : "#71717A"} strokeWidth={2} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-sans-medium text-[15px] text-card-foreground">
          {label}
        </Text>
        {description ? (
          <Text className="font-sans text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      {saving ? (
        <ActivityIndicator size="small" color="#FF8900" />
      ) : active ? (
        <Check size={18} color="#AD5100" strokeWidth={2.4} />
      ) : null}
    </Pressable>
  );
}
