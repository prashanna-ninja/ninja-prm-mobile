import {
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import * as React from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from "react-native";

import { DayDivider, MessageBubble, PendingBubble } from "@/components/messages/message-bubble";
import { MessageComposer } from "@/components/messages/message-composer";
import { LinePickerSheet } from "@/components/messages/line-picker-sheet";
import { SaveContactSheet } from "@/components/messages/save-contact-sheet";
import { ThreadAvatar } from "@/components/messages/thread-avatar";
import { Screen } from "@/components/screen";
import { ErrorState, describeError } from "@/components/ui/states";
import {
  useMarkSmsThreadRead,
  useSendSms,
  useSmsSetup,
  useSmsThreadMessages,
} from "@/api/sms.api";
import { ArrowLeft, Phone, UserPlus } from "@/lib/icons";
import { lineLabel, newClientRequestId, startsNewDay, threadTitle } from "@/lib/sms";
import type { SmsMessage } from "@/types/sms.types";

/** A text that exists only on the phone until the server confirms it. */
type Pending = {
  tempId: string;
  /** Reused on retry, so CrazyTel never sends the same text twice. */
  clientRequestId: string;
  body: string;
  lineKey: string | undefined;
  createdAt: number;
  failed: boolean;
  error?: string;
};

type Row =
  | { kind: "message"; key: string; message: SmsMessage }
  | { kind: "divider"; key: string; iso: string }
  | { kind: "pending"; key: string; pending: Pending };

export default function ThreadScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    threadId?: string;
    title?: string;
    /** Set when opened from a contact, so Back returns there. */
    fromContact?: string;
  }>();
  const threadId = params.threadId ?? "";

  // A bottom-anchored composer has to own the bottom edge: with the tab bar
  // up, the keyboard maths counts the bar twice. Same as Ninja CRM Mobile.
  useFocusEffect(
    React.useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: "none" } });
      return () => parent?.setOptions({ tabBarStyle: undefined });
    }, [navigation]),
  );

  const setup = useSmsSetup();
  const lines = setup.data?.lines ?? [];
  // Polling stops while this screen is covered (e.g. you tapped through to
  // the contact) — see useSmsThreadMessages for why every poll is costly.
  const focused = useIsFocused();
  const query = useSmsThreadMessages(threadId, focused);

  // Coming BACK to the thread re-reads at once rather than waiting out an
  // idle interval. Skips the first focus — the query is loading then.
  const focusedBefore = React.useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      if (focusedBefore.current) void query.refetch();
      focusedBefore.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const thread = query.data?.thread;
  const messages = query.data?.messages;
  const markRead = useMarkSmsThreadRead();
  const send = useSendSms(threadId);

  const [pending, setPending] = React.useState<Pending[]>([]);
  const [chosenLine, setChosenLine] = React.useState<string | null>(null);
  const [linePickerOpen, setLinePickerOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);

  const title = thread ? threadTitle(thread) : (params.title ?? "Conversation");
  const lineKey = chosenLine ?? thread?.replyLineKey;

  const goBack = () =>
    params.fromContact
      ? router.replace({ pathname: "/contacts/[id]", params: { id: params.fromContact } })
      : router.replace("/messages");

  // Opening a thread reads it — and so does a new text arriving while it's
  // open. Keyed on the latest message so it fires once per change, not per poll.
  const lastSeen = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!thread || thread.unreadCount === 0) return;
    if (lastSeen.current === thread.lastMessageAt) return;
    lastSeen.current = thread.lastMessageAt;
    markRead.mutate(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.lastMessageAt, thread?.unreadCount, threadId]);

  // Drop an optimistic bubble once its real row arrives: same text, outbound,
  // created no earlier than a minute before we queued it (clock skew between
  // phone and server is real). Mirrors Ninja CRM Mobile and the web.
  React.useEffect(() => {
    if (!messages || pending.length === 0) return;
    setPending((prev) =>
      prev.filter(
        (p) =>
          p.failed ||
          !messages.some(
            (m) =>
              m.direction === "OUTBOUND" &&
              m.body === p.body &&
              new Date(m.createdAt).getTime() >= p.createdAt - 60_000,
          ),
      ),
    );
  }, [messages, pending.length]);

  const dispatch = (p: Pending) => {
    if (!thread) return;
    send.mutate(
      {
        to: thread.replyPhone,
        body: p.body,
        lineKey: p.lineKey,
        clientRequestId: p.clientRequestId,
      },
      {
        onSuccess: (res) => {
          // A first text can move the conversation onto a contact thread.
          if (res.threadId && res.threadId !== threadId) {
            router.setParams({ threadId: res.threadId });
          }
        },
        onError: (err) => {
          setPending((prev) =>
            prev.map((x) =>
              x.tempId === p.tempId ? { ...x, failed: true, error: describeError(err) } : x,
            ),
          );
        },
      },
    );
  };

  const onSend = (body: string) => {
    const p: Pending = {
      tempId: newClientRequestId(),
      clientRequestId: newClientRequestId(),
      body,
      lineKey: lineKey ?? undefined,
      createdAt: Date.now(),
      failed: false,
    };
    setPending((prev) => [...prev, p]);
    dispatch(p);
  };

  const retry = (p: Pending) => {
    const again = { ...p, failed: false, error: undefined };
    setPending((prev) => prev.map((x) => (x.tempId === p.tempId ? again : x)));
    dispatch(again);
  };

  // Chat order is newest-at-the-bottom; the list is INVERTED so it opens at
  // the latest text without a scroll-to-end dance, and only renders what's on
  // screen (a thread can hold 1,000 messages). So rows are built oldest-first
  // and reversed.
  const rows = React.useMemo<Row[]>(() => {
    const out: Row[] = [];
    (messages ?? []).forEach((m, i, all) => {
      if (startsNewDay(all[i - 1], m)) {
        out.push({ kind: "divider", key: `d-${m.id}`, iso: m.createdAt });
      }
      out.push({ kind: "message", key: m.id, message: m });
    });
    for (const p of pending) out.push({ kind: "pending", key: p.tempId, pending: p });
    return out.reverse();
  }, [messages, pending]);

  const subtitle = !thread
    ? ""
    : thread.contact
      ? thread.phones.map((p) => p.display).join(" · ")
      : thread.canReply
        ? "Not in your contacts"
        : "Sender name — can't reply";

  return (
    <Screen>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 pb-3 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          hitSlop={10}
          className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
        >
          <ArrowLeft size={18} color="#52525B" strokeWidth={2} />
        </Pressable>

        <Pressable
          accessibilityRole={thread?.contact ? "button" : undefined}
          accessibilityLabel={thread?.contact ? `Open ${title}` : title}
          disabled={!thread?.contact}
          onPress={() =>
            thread?.contact &&
            router.push({ pathname: "/contacts/[id]", params: { id: thread.contact.id } })
          }
          className="min-w-0 flex-1 flex-row items-center gap-2.5 active:opacity-70"
        >
          <ThreadAvatar contact={thread?.contact ?? null} size={38} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-sans-semibold text-[16px] text-foreground">
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} className="font-sans text-xs text-muted-foreground">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {thread?.canReply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${title}`}
            onPress={() => void Linking.openURL(`tel:${thread.replyPhone}`)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
          >
            <Phone size={17} color="#52525B" strokeWidth={2} />
          </Pressable>
        ) : null}
        {thread && !thread.contact && thread.canReply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save contact"
            onPress={() => setSaveOpen(true)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
          >
            <UserPlus size={17} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {/* Conversation */}
      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF8900" />
        </View>
      ) : query.isError ? (
        <View className="flex-1 px-4 pt-4">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </View>
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.key}
          className="flex-1"
          contentContainerClassName="gap-3 px-4 py-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          renderItem={({ item }) =>
            item.kind === "divider" ? (
              <DayDivider iso={item.iso} />
            ) : item.kind === "pending" ? (
              <PendingBubble
                body={item.pending.body}
                failed={item.pending.failed}
                error={item.pending.error}
                onRetry={() => retry(item.pending)}
              />
            ) : (
              <MessageBubble
                message={item.message}
                lineName={lineLabel(lines, item.message.lineKey)}
              />
            )
          }
          ListEmptyComponent={
            // Inverted lists flip their children too — un-flip the empty state.
            <View style={{ transform: [{ scaleY: -1 }] }} className="items-center gap-1 py-12">
              <Text className="font-sans-medium text-[15px] text-foreground">
                No messages yet
              </Text>
              <Text className="max-w-[260px] text-center font-sans text-[13px] text-muted-foreground">
                Send the first text below — replies show up here automatically.
              </Text>
            </View>
          }
        />
      )}

      {thread ? (
        <MessageComposer
          placeholder={`Text ${thread.contact?.name ?? thread.phones[0]?.display ?? ""}`}
          lineName={lineLabel(lines, lineKey)}
          onPickLine={lines.length > 1 ? () => setLinePickerOpen(true) : undefined}
          onSend={onSend}
          disabledNotice={
            thread.canReply
              ? undefined
              : `${title} is a sender name, not a number — carriers don't deliver replies to it.`
          }
        />
      ) : null}

      <LinePickerSheet
        visible={linePickerOpen}
        lines={lines}
        value={lineKey ?? null}
        onClose={() => setLinePickerOpen(false)}
        onSelect={(key) => {
          setChosenLine(key);
          setLinePickerOpen(false);
        }}
      />

      {thread && !thread.contact ? (
        <SaveContactSheet
          visible={saveOpen}
          threadId={threadId}
          numberLabel={thread.phones.map((p) => p.display).join(" · ")}
          onClose={() => setSaveOpen(false)}
          onLinked={(newThreadId) => {
            setSaveOpen(false);
            // The thread is now keyed by the contact (contact:<id>).
            router.replace({
              pathname: "/messages/[threadId]",
              params: { threadId: newThreadId },
            });
          }}
        />
      ) : null}
    </Screen>
  );
}
