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
  MAX_NOTE_LENGTH,
  MAX_RECIPIENTS,
  parseRecipients,
  useShareTranscript,
} from "@/api/share.api";
import { describeError } from "@/components/ui/states";
import { Mails, UserRoundPlus, X } from "@/lib/icons";
import { SOURCE_META } from "@/lib/recordings";
import { useSession } from "@/providers/session-provider";
import type { RecordingDetail } from "@/types/recording.types";

/**
 * Email a transcript — the mobile counterpart of the web's "Share transcript"
 * dialog, hitting the same endpoint so the email is byte-identical.
 *
 * A Modal rather than a pushed route: it's a short, cancellable side-errand
 * from reading a recording, and pushing would lose the scroll position on the
 * way back.
 */
export function ShareTranscriptSheet({
  recording,
  visible,
  onClose,
}: {
  recording: RecordingDetail;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { data: session } = useSession();
  const share = useShareTranscript();

  const [note, setNote] = React.useState("");
  const [recipients, setRecipients] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Reset on open, so a previous failure or half-typed draft doesn't reappear.
  React.useEffect(() => {
    if (!visible) return;
    setNote("");
    setRecipients("");
    setError(null);
    share.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const parsed = parseRecipients(recipients);
  const tooMany = parsed.length > MAX_RECIPIENTS;
  const noteTooLong = note.length > MAX_NOTE_LENGTH;
  const canSend =
    parsed.length > 0 && !tooMany && !noteTooLong && !share.isPending;

  const myEmail = session?.user?.email;
  const alreadyIncludedMe =
    !!myEmail && parsed.includes(myEmail.trim().toLowerCase());

  const addMyself = () => {
    if (!myEmail || alreadyIncludedMe) return;
    setRecipients((current) => {
      const trimmed = current.trim();
      return trimmed ? trimmed + ", " + myEmail : myEmail;
    });
  };

  const onSend = async () => {
    if (!canSend) return;
    setError(null);
    try {
      await share.mutateAsync({
        source: recording.source,
        id: recording.id,
        recipients,
        note,
      });
      onClose();
    } catch (err) {
      // The server's 400/429 messages are written for humans and are exact
      // ("You can send to up to 10 recipients at once.") — show them as-is.
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
          className="max-h-[92%] rounded-t-3xl bg-background"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {/* Grab handle — signals "dismissable" before you read a word. */}
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
                  Share transcript
                </Text>
                <Text className="font-sans text-[13px] leading-[19px] text-muted-foreground">
                  Email a copy of this transcript with your note. Recipients see
                  who shared it and your message at the top.
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

            {/* What you're about to send — the dialog's confirmation line. */}
            <View className="gap-0.5 rounded-xl border border-border bg-card p-3.5">
              <Text
                numberOfLines={2}
                className="font-sans-medium text-[15px] text-card-foreground"
              >
                {recording.title}
              </Text>
              <Text className="font-sans text-[13px] text-muted-foreground">
                {SOURCE_META[recording.source].label}
              </Text>
            </View>

            <Field label="Your message">
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Hey, can you call this person back?"
                placeholderTextColor="#A1A1AA"
                selectionColor="#FF8900"
                multiline
                textAlignVertical="top"
                className="min-h-[96px] rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] leading-[21px] text-foreground"
              />
              {noteTooLong ? (
                <Hint tone="error">
                  Message is too long ({note.length} of {MAX_NOTE_LENGTH}{" "}
                  characters).
                </Hint>
              ) : null}
            </Field>

            <Field
              label="Recipients"
              action={
                myEmail && !alreadyIncludedMe ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Add my own address, " + myEmail}
                    onPress={addMyself}
                    hitSlop={8}
                    className="flex-row items-center gap-1.5 active:opacity-60"
                  >
                    <UserRoundPlus size={15} color="#AD5100" strokeWidth={2.2} />
                    <Text className="font-sans-medium text-[13px] text-primary-strong">
                      Email me
                    </Text>
                  </Pressable>
                ) : null
              }
            >
              <TextInput
                value={recipients}
                onChangeText={setRecipients}
                placeholder="name@example.com, teammate@company.com"
                placeholderTextColor="#A1A1AA"
                selectionColor="#FF8900"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
              />
              {tooMany ? (
                <Hint tone="error">
                  You can send to up to {MAX_RECIPIENTS} recipients at once —
                  you have {parsed.length}.
                </Hint>
              ) : (
                <Hint>
                  Separate multiple emails with commas. Additional recipients
                  are CC&apos;d on the email.
                </Hint>
              )}
            </Field>

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

            <View className="flex-row gap-3 pt-0.5">
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                disabled={share.isPending}
                className="h-12 flex-1 items-center justify-center rounded-xl border border-border active:opacity-70"
              >
                <Text className="font-sans-medium text-[15px] text-foreground">
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !canSend,
                  busy: share.isPending,
                }}
                onPress={onSend}
                disabled={!canSend}
                className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
                style={{ opacity: canSend ? 1 : 0.5 }}
              >
                {share.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Mails size={17} color="#FFFFFF" strokeWidth={2.1} />
                )}
                <Text className="font-sans-semibold text-[15px] text-primary-foreground">
                  {share.isPending ? "Sending…" : "Send transcript"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-[13px] text-foreground">
          {label}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Hint({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "error";
  children: React.ReactNode;
}) {
  return (
    <Text
      className={
        "font-sans text-xs leading-[17px] " +
        (tone === "error" ? "text-destructive" : "text-muted-foreground")
      }
    >
      {children}
    </Text>
  );
}
