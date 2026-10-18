import * as React from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { ChevronRight, Send } from "@/lib/icons";
import { countSmsSegments } from "@/lib/sms-segments";

/** CrazyTel's cap, same as Ninja CRM Mobile's composer. */
const CHAR_LIMIT = 1600;

/**
 * The bottom-anchored composer: text, "From <line>", send.
 *
 * Owns the draft and the keyboard; the screen owns sending (and the optimistic
 * bubble), so `onSend` is fire-and-forget from here — the draft clears at once,
 * the way every messaging app behaves.
 *
 * Keyboard: measured, not KeyboardAvoidingView (CLAUDE.md gotcha 6), and the
 * safe-area inset is handled per platform — see hooks/use-keyboard-height.ts.
 * The screen hides the tab bar so this owns the bottom edge.
 */
export function MessageComposer({
  placeholder,
  lineName,
  onPickLine,
  onSend,
  disabledNotice,
}: {
  placeholder: string;
  lineName: string | null;
  /** Omitted when there's only one line — nothing to pick. */
  onPickLine?: () => void;
  onSend: (body: string) => void;
  /** Shown INSTEAD of the composer (e.g. a sender-name thread can't take replies). */
  disabledNotice?: string;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [body, setBody] = React.useState("");

  // Real segments, not length/160 — one emoji drops a segment from 160 to 70
  // characters, and each segment is billed. See lib/sms-segments.ts.
  const sms = React.useMemo(() => countSmsSegments(body), [body]);
  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= CHAR_LIMIT;

  const paddingBottom =
    keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === "android" ? insets.bottom : 0) + 8
      : insets.bottom + 8;

  if (disabledNotice) {
    return (
      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Text className="text-center font-sans text-[13px] leading-[19px] text-muted-foreground">
          {disabledNotice}
        </Text>
      </View>
    );
  }

  const send = () => {
    if (!canSend) return;
    onSend(trimmed);
    setBody("");
  };

  return (
    <View
      className="gap-2 border-t border-border bg-background px-4 pt-2.5"
      style={{ paddingBottom }}
    >
      <View className="flex-row items-end gap-2">
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={placeholder}
          placeholderTextColor="#A1A1AA"
          selectionColor="#FF8900"
          multiline
          maxLength={CHAR_LIMIT}
          className="flex-1 rounded-2xl border border-input bg-card px-4 py-2.5 font-sans text-[15px] leading-[20px] text-foreground"
          style={{ minHeight: 44, maxHeight: 128 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
          onPress={send}
          disabled={!canSend}
          // Solid orange when it'll do something, flat muted when it won't —
          // a faded orange reads as a rendering glitch, not "disabled".
          className={`h-11 w-11 items-center justify-center rounded-full ${
            canSend ? "bg-primary active:opacity-80" : "bg-muted"
          }`}
        >
          <Send size={18} color={canSend ? "#FFFFFF" : "#A1A1AA"} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View className="flex-row items-center gap-2">
        {lineName ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sending from ${lineName}${onPickLine ? ", change" : ""}`}
            onPress={onPickLine}
            disabled={!onPickLine}
            hitSlop={6}
            className="flex-row items-center gap-1 rounded-md bg-muted px-2 py-1 active:opacity-70"
          >
            <Text className="font-sans text-xs text-muted-foreground">
              From{" "}
              <Text className="font-sans-semibold text-foreground">{lineName}</Text>
            </Text>
            {onPickLine ? (
              <ChevronRight size={12} color="#71717A" strokeWidth={2.2} />
            ) : null}
          </Pressable>
        ) : null}

        <View className="flex-1" />

        {/* Always visible: length is a real, billed constraint you compose
            against, and "Unicode" explains an otherwise baffling jump. */}
        <Text
          className={`font-sans text-[11px] ${
            body.length > CHAR_LIMIT - 200 ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {body.length > 0
            ? `${body.length}/${CHAR_LIMIT}${sms.segments > 1 ? ` · ${sms.segments} texts` : ""}${
                sms.encoding === "UCS-2" ? " · Unicode" : ""
              }`
            : ""}
        </Text>
      </View>
    </View>
  );
}
