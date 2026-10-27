import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { BellRing, X } from "@/lib/icons";
import { usePush } from "@/providers/push-provider";

/**
 * The one-time "turn on notifications" card at the top of Messages.
 *
 * Why ask in-app before the OS does: iOS shows its permission dialog exactly
 * ONCE, with Apple's wording and none of ours. This card is the only place to
 * say why — and it fires the real prompt only when someone has already said
 * yes to the idea. Shown on Messages because a text is what push is for.
 *
 * Shows once per install: "Not now" (or turning push on anywhere) retires it.
 * Never shown on a simulator or when the OS has already blocked push.
 */
export function PushPromptCard() {
  const push = usePush();
  const [busy, setBusy] = React.useState(false);

  const show =
    !push.explainerSeen &&
    !push.enabled &&
    (push.permission === "undetermined" || push.permission === "granted");
  if (!show) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      await push.enable();
    } finally {
      setBusy(false);
      // Whatever the OS answered, the pitch has had its shot.
      void push.markExplainerSeen();
    }
  };

  return (
    <View className="flex-row gap-3 rounded-lg border border-primary bg-primary-soft p-3.5">
      <BellRing size={18} color="#AD5100" strokeWidth={2} style={{ marginTop: 1 }} />
      <View className="min-w-0 flex-1 gap-2.5">
        <View className="gap-0.5">
          <Text className="font-sans-semibold text-sm text-foreground">
            Know the moment someone texts
          </Text>
          <Text className="font-sans text-[13px] leading-[18px] text-muted-foreground">
            Get a notification for new texts, even when the app is closed.
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => void turnOn()}
            disabled={busy}
            className="h-9 flex-row items-center gap-2 rounded-lg bg-primary px-3.5 active:opacity-80"
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text className="font-sans-semibold text-[13px] text-primary-foreground">
              Turn on
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void push.markExplainerSeen()}
            disabled={busy}
            className="h-9 items-center justify-center rounded-lg px-3 active:opacity-70"
          >
            <Text className="font-sans-medium text-[13px] text-muted-foreground">Not now</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => void push.markExplainerSeen()}
        hitSlop={10}
        className="h-6 w-6 items-center justify-center active:opacity-60"
      >
        <X size={15} color="#71717A" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}
