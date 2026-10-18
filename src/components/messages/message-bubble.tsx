import { Pressable, Text, View } from "react-native";

import { CheckCheck, CircleAlert } from "@/lib/icons";
import { formatDayDivider, formatMessageTime, statusLabel } from "@/lib/sms";
import type { SmsMessage } from "@/types/sms.types";

/**
 * One text. Outbound is the brand orange — the web's blue primary is the one
 * token this app replaces (CLAUDE.md rule 2) — and inbound is a card.
 *
 * Footer mirrors the web: "8:39 am · Ben CLS LEGACY · ✓ Delivered".
 */
export function MessageBubble({
  message,
  lineName,
}: {
  message: SmsMessage;
  lineName: string | null;
}) {
  const outbound = message.direction === "OUTBOUND";
  const failed = message.status === "FAILED";
  const status = outbound ? statusLabel(message.status) : null;

  return (
    <View className={outbound ? "items-end" : "items-start"}>
      <View
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
          outbound
            ? failed
              ? "rounded-br-md border border-destructive bg-destructive-soft"
              : "rounded-br-md bg-primary"
            : "rounded-bl-md border border-border bg-card"
        }`}
      >
        {message.contentAvailable ? (
          <Text
            selectable
            className={`font-sans text-[15px] leading-[21px] ${
              outbound
                ? failed
                  ? "text-destructive"
                  : "text-primary-foreground"
                : "text-card-foreground"
            }`}
          >
            {message.body}
          </Text>
        ) : (
          // CrazyTel reported that a text happened but not what it said.
          <Text
            className={`font-sans text-[14px] italic ${
              outbound ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {outbound ? "Text sent — content not available" : "Text received — content not available"}
          </Text>
        )}
      </View>

      <View className="mt-1 flex-row items-center gap-1 px-1">
        <Text className="font-sans text-[11px] text-muted-foreground">
          {formatMessageTime(message.createdAt)}
          {lineName ? ` · ${lineName}` : ""}
          {status ? " · " : ""}
        </Text>
        {status ? (
          <View className="flex-row items-center gap-0.5">
            {failed ? (
              <CircleAlert size={11} color="#DC2626" strokeWidth={2.4} />
            ) : message.status === "DELIVERED" ? (
              <CheckCheck size={12} color="#16A34A" strokeWidth={2.4} />
            ) : null}
            <Text
              className="font-sans-medium text-[11px]"
              style={{
                color: failed ? "#DC2626" : message.status === "DELIVERED" ? "#16A34A" : "#71717A",
              }}
            >
              {status}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A bubble that exists only on the phone until the server confirms it. */
export function PendingBubble({
  body,
  failed,
  error,
  onRetry,
}: {
  body: string;
  failed: boolean;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <View className="items-end">
      <View
        className={`max-w-[82%] rounded-2xl rounded-br-md px-3.5 py-2.5 ${
          failed ? "border border-destructive bg-destructive-soft" : "bg-primary"
        }`}
        style={failed ? undefined : { opacity: 0.6 }}
      >
        <Text
          className={`font-sans text-[15px] leading-[21px] ${
            failed ? "text-destructive" : "text-primary-foreground"
          }`}
        >
          {body}
        </Text>
      </View>
      {failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry sending"
          onPress={onRetry}
          hitSlop={8}
          className="mt-1 flex-row items-center gap-1 px-1 active:opacity-60"
        >
          <CircleAlert size={11} color="#DC2626" strokeWidth={2.4} />
          <Text className="font-sans-medium text-[11px] text-destructive">
            Not sent · Tap to retry
          </Text>
        </Pressable>
      ) : (
        <Text className="mt-1 px-1 font-sans text-[11px] text-muted-foreground">
          Sending…
        </Text>
      )}
      {failed && error ? (
        <Text className="max-w-[82%] px-1 text-right font-sans text-[11px] text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function DayDivider({ iso }: { iso: string }) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-px flex-1 bg-border" />
      <Text className="font-sans-medium text-[11px] uppercase tracking-wide text-muted-foreground">
        {formatDayDivider(iso)}
      </Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}
