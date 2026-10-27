import * as React from "react";
import { ActivityIndicator, Linking, Pressable, Switch, Text, View } from "react-native";

import { sendTestPush } from "@/api/push.api";
import { describeError } from "@/components/ui/states";
import { PUSH_CATEGORY_META } from "@/lib/push-categories";
import { usePush } from "@/providers/push-provider";

/**
 * Settings → Notifications: the master switch, one switch per category, and a
 * plain-English line for every way push can fail to work.
 *
 * Every failure gets its OWN message because they have different fixes: a
 * simulator can't receive push at all, "blocked" is fixed in the OS Settings
 * app, a missing token is a build problem, and "unavailable" means the server
 * routes haven't shipped. A switch that silently refuses to move explains none
 * of them.
 */
export function NotificationSettings() {
  const push = usePush();
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [testState, setTestState] = React.useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const on = push.enabled && push.permission === "granted";

  const toggle = async (next: boolean) => {
    setNotice(null);
    setBusy(true);
    try {
      if (!next) {
        await push.disable();
        return;
      }
      const outcome = await push.enable();
      if (outcome === "denied") setNotice("Notifications weren't allowed. Tap the switch to be asked again.");
      if (outcome === "failed") {
        setNotice("This build couldn't register for notifications. On Android it needs Firebase set up — see the release notes.");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!push.token) return;
    setTestState({ kind: "sending" });
    try {
      await sendTestPush(push.token);
      setTestState({ kind: "sent" });
    } catch (err) {
      setTestState({ kind: "error", message: describeError(err) });
    }
  };

  const status = statusLine(push);

  return (
    <View className="gap-2">
      <View className="overflow-hidden rounded-lg border border-border bg-card">
        <Row
          label="Push notifications"
          description={status}
          right={
            busy || push.permission === "loading" ? (
              <ActivityIndicator size="small" color="#FF8900" />
            ) : (
              <Switch
                value={on}
                onValueChange={(v) => void toggle(v)}
                disabled={push.permission === "unsupported"}
                trackColor={{ true: "#FF8900", false: undefined }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Push notifications"
              />
            )
          }
        />

        {push.permission === "blocked" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            className="border-t border-border px-4 py-3 active:opacity-70"
          >
            <Text className="font-sans-medium text-sm text-primary-strong">
              Open phone settings
            </Text>
          </Pressable>
        ) : null}

        {/* Categories are only meaningful while push is on. */}
        {on
          ? PUSH_CATEGORY_META.map((c) => (
              <View key={c.key} className="border-t border-border">
                <Row
                  label={c.label}
                  description={c.description}
                  right={
                    <Switch
                      value={push.preferences[c.key]}
                      onValueChange={(v) => void push.setCategory(c.key, v)}
                      trackColor={{ true: "#FF8900", false: undefined }}
                      thumbColor="#FFFFFF"
                      accessibilityLabel={c.label}
                    />
                  }
                />
              </View>
            ))
          : null}

        {on && push.token ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void sendTest()}
            disabled={testState.kind === "sending"}
            className="flex-row items-center justify-between border-t border-border px-4 py-3 active:opacity-70"
          >
            <Text className="font-sans-medium text-sm text-primary-strong">
              Send a test notification
            </Text>
            {testState.kind === "sending" ? (
              <ActivityIndicator size="small" color="#FF8900" />
            ) : testState.kind === "sent" ? (
              <Text className="font-sans text-xs text-muted-foreground">Sent — check your lock screen</Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {notice ? (
        <Text className="px-1 font-sans text-xs leading-[17px] text-muted-foreground">{notice}</Text>
      ) : null}
      {testState.kind === "error" ? (
        <Text className="px-1 font-sans text-xs leading-[17px] text-destructive">
          Test failed: {testState.message}
        </Text>
      ) : null}
    </View>
  );
}

function statusLine(push: ReturnType<typeof usePush>): string {
  switch (push.permission) {
    case "loading":
      return "Checking…";
    case "unsupported":
      return "Needs a real device — simulators can't receive push.";
    case "blocked":
      return "Blocked in your phone's settings. Allow notifications for Ninja PRM there.";
  }
  if (!push.enabled) return "Get a notification when someone texts you.";
  if (push.tokenUnavailable) {
    return "This build can't register for notifications (Android needs Firebase in the build).";
  }
  if (push.sync?.status === "unavailable") {
    return "On — but the server isn't ready for notifications yet.";
  }
  if (push.sync?.status === "error") return `On — couldn't reach the server: ${push.sync.message}`;
  return "On for this device.";
}

function Row({
  label,
  description,
  right,
}: {
  label: string;
  description?: string;
  right: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-sans text-[15px] text-card-foreground">{label}</Text>
        {description ? (
          <Text className="font-sans text-xs leading-[17px] text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
