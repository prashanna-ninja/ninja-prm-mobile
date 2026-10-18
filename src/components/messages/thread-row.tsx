import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ThreadAvatar } from "@/components/messages/thread-avatar";
import { formatThreadTime, lineLabel, threadTitle } from "@/lib/sms";
import type { SmsLine, SmsThread } from "@/types/sms.types";

export function ThreadRow({
  thread,
  lines,
}: {
  thread: SmsThread;
  lines: SmsLine[] | undefined;
}) {
  const router = useRouter();
  const title = threadTitle(thread);
  const unread = thread.unreadCount > 0;

  const preview = thread.lastMessagePreview
    ? `${thread.lastDirection === "OUTBOUND" ? "You: " : ""}${thread.lastMessagePreview}`
    : "No messages yet";

  // Which of my numbers this person has texted — the web's grey footer line.
  const viaLines = thread.lineKeys
    .map((k) => lineLabel(lines, k))
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${unread ? `, ${thread.unreadCount} unread` : ""}`}
      onPress={() =>
        router.push({
          pathname: "/messages/[threadId]",
          // The title rides along so the header paints before the fetch lands.
          params: { threadId: thread.id, title },
        })
      }
      className="flex-row items-start gap-3 rounded-lg border border-border bg-card p-3 active:opacity-70"
    >
      <ThreadAvatar contact={thread.contact} />

      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={`min-w-0 flex-1 text-[15px] text-card-foreground ${
              unread ? "font-sans-semibold" : "font-sans-medium"
            }`}
          >
            {title}
          </Text>
          <Text
            className={`font-sans text-xs ${
              unread ? "text-primary-strong" : "text-muted-foreground"
            }`}
          >
            {formatThreadTime(thread.lastMessageAt)}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className={`min-w-0 flex-1 text-[13px] ${
              unread
                ? "font-sans-medium text-card-foreground"
                : "font-sans text-muted-foreground"
            }`}
          >
            {preview}
          </Text>
          {unread ? (
            <View className="h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5">
              <Text className="font-sans-semibold text-[11px] text-primary-foreground">
                {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>

        {viaLines ? (
          <Text numberOfLines={1} className="font-sans text-xs text-muted-foreground">
            {viaLines}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
