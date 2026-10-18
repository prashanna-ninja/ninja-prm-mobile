import { useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/app-header";
import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { Screen } from "@/components/screen";
import { describeError } from "@/components/ui/states";
import { useInfiniteContacts } from "@/api/contacts.api";
import { useSmsSetup, useStartSmsThread } from "@/api/sms.api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ArrowLeft, ChevronRight, MessagesSquare } from "@/lib/icons";
import { parseStringList } from "@/types/contact.types";

/**
 * Start a conversation: type a number, or pick one of a contact's.
 *
 * One field does both — digits are a number to text, anything else searches
 * contacts — because that's how you'd use a phone's own Messages app. The
 * server opens the EXISTING thread if there already is one with that number.
 */
export default function NewMessageScreen() {
  const router = useRouter();
  const setup = useSmsSetup();
  const start = useStartSmsThread();
  const lines = setup.data?.lines ?? [];

  const [input, setInput] = React.useState("");
  const [lineKey, setLineKey] = React.useState<string | null>(null);
  const debounced = useDebouncedValue(input);

  const effectiveLine =
    lineKey ?? lines.find((l) => l.isDefault)?.key ?? lines[0]?.key ?? null;

  // Looks like a phone number: digits, spaces, +, (, ), - and at least 6 digits.
  const digits = input.replace(/\D/g, "");
  const looksLikeNumber = /^[\d\s+()-]+$/.test(input.trim()) && digits.length >= 6;

  const contacts = useInfiniteContacts({ search: looksLikeNumber ? "" : debounced });
  // A contact's `phone` is a JSON-encoded list (or plain text on old rows) —
  // one row per number, so a contact with a mobile and a work line shows both.
  const rows = React.useMemo(
    () =>
      (contacts.data?.pages.flatMap((p) => p.contacts) ?? []).flatMap((c) =>
        parseStringList(c.phone).map((phone) => ({ contact: c, phone })),
      ),
    [contacts.data],
  );

  const open = async (to: string, title?: string) => {
    if (start.isPending) return;
    try {
      const { threadId } = await start.mutateAsync({
        to,
        lineKey: effectiveLine ?? undefined,
      });
      router.replace({
        pathname: "/messages/[threadId]",
        params: title ? { threadId, title } : { threadId },
      });
    } catch (err) {
      Alert.alert("Couldn't start the conversation", describeError(err));
    }
  };

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3">
        <AppHeader
          title="New message"
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <ArrowLeft size={18} color="#52525B" strokeWidth={2} />
            </Pressable>
          }
        />

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Name or mobile number"
          placeholderTextColor="#A1A1AA"
          selectionColor="#FF8900"
          autoFocus
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => looksLikeNumber && void open(input.trim())}
          className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
        />

        {lines.length > 1 ? (
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-sans text-xs text-muted-foreground">From</Text>
            {lines.map((line) => {
              const active = line.key === effectiveLine;
              return (
                <Pressable
                  key={line.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => setLineKey(line.key)}
                  className={`rounded-full border px-3 py-1.5 active:opacity-70 ${
                    active ? "border-primary bg-primary" : "border-border bg-card"
                  }`}
                >
                  <Text
                    className={`font-sans-medium text-xs ${
                      active ? "text-primary-foreground" : "text-card-foreground"
                    }`}
                  >
                    {line.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {looksLikeNumber ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Text ${input.trim()}`}
            onPress={() => void open(input.trim())}
            disabled={start.isPending}
            className="flex-row items-center gap-3 rounded-lg border border-primary bg-primary-soft p-3.5 active:opacity-70"
          >
            <MessagesSquare size={18} color="#AD5100" strokeWidth={2} />
            <Text className="min-w-0 flex-1 font-sans-medium text-[15px] text-primary-strong">
              Text {input.trim()}
            </Text>
            {start.isPending ? (
              <ActivityIndicator size="small" color="#FF8900" />
            ) : (
              <ChevronRight size={16} color="#AD5100" strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>

      {!looksLikeNumber ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => `${r.contact.id}-${r.phone}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="px-4 pb-8 gap-2"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (contacts.hasNextPage && !contacts.isFetchingNextPage) {
              void contacts.fetchNextPage();
            }
          }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Text ${item.contact.name} on ${item.phone}`}
              onPress={() => void open(item.phone, item.contact.name)}
              disabled={start.isPending}
              className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2.5 active:opacity-70"
            >
              <ContactAvatar name={item.contact.name} image={item.contact.image} size={36} />
              <View className="min-w-0 flex-1">
                <Text
                  numberOfLines={1}
                  className="font-sans-medium text-[15px] text-card-foreground"
                >
                  {item.contact.name}
                </Text>
                <Text numberOfLines={1} className="font-sans text-xs text-muted-foreground">
                  {item.phone}
                </Text>
              </View>
              <ChevronRight size={16} color="#A1A1AA" strokeWidth={2} />
            </Pressable>
          )}
          ListEmptyComponent={
            contacts.isPending ? (
              <ActivityIndicator color="#FF8900" />
            ) : (
              <Text className="py-10 text-center font-sans text-sm leading-5 text-muted-foreground">
                {debounced.trim()
                  ? "No contacts with a phone number match that.\nType a number to text it directly."
                  : "Type a name, or a number to text it directly."}
              </Text>
            )
          }
          ListHeaderComponent={
            rows.length > 0 ? (
              <Text className="pb-1 font-sans-semibold text-xs uppercase tracking-wide text-muted-foreground">
                Contacts
              </Text>
            ) : null
          }
        />
      ) : null}
    </Screen>
  );
}
