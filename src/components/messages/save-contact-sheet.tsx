import * as React from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useInfiniteContacts } from "@/api/contacts.api";
import { useLinkSmsThread } from "@/api/sms.api";
import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { SearchBar } from "@/components/ui/search-bar";
import { describeError } from "@/components/ui/states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { UserPlus, X } from "@/lib/icons";

/**
 * "Save contact" for a number that isn't one yet: create a new contact, or add
 * the number to someone who already exists (their other number, a new phone).
 *
 * The server adds the number to the contact's phones so future texts match,
 * and the thread id changes from conv:… to contact:… — `onLinked` gets the new
 * one and the screen navigates to it.
 *
 * Inputs sit at the TOP of the sheet on purpose: the keyboard then covers the
 * results list, never the field you're typing in (no KeyboardAvoidingView
 * under edge-to-edge — CLAUDE.md gotcha 6).
 */
export function SaveContactSheet({
  visible,
  threadId,
  numberLabel,
  onClose,
  onLinked,
}: {
  visible: boolean;
  threadId: string;
  numberLabel: string;
  onClose: () => void;
  onLinked: (newThreadId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const link = useLinkSmsThread(threadId);

  const [mode, setMode] = React.useState<"new" | "existing">("new");
  const [name, setName] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const debounced = useDebouncedValue(search);

  React.useEffect(() => {
    if (!visible) return;
    setMode("new");
    setName("");
    setSearch("");
    setError(null);
    link.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const contacts = useInfiniteContacts({ search: debounced });
  const items = React.useMemo(
    () => contacts.data?.pages.flatMap((p) => p.contacts) ?? [],
    [contacts.data],
  );

  const submit = async (input: { contactId: string } | { newContactName: string }) => {
    if (link.isPending) return;
    setError(null);
    try {
      const res = await link.mutateAsync(input);
      onLinked(res.threadId);
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
          className={`${mode === "existing" ? "h-[85%]" : ""} rounded-t-3xl bg-background`}
          // The name field autofocuses, so lift the sheet clear of the
          // keyboard (per-platform inset rule: hooks/use-keyboard-height.ts).
          style={{
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + (Platform.OS === "android" ? insets.bottom : 0) + 12
                : insets.bottom + 12,
          }}
        >
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="gap-4 px-5 pb-3 pt-1">
            <View className="flex-row items-start gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-display text-[22px] text-foreground">
                  Save contact
                </Text>
                <Text numberOfLines={1} className="font-sans text-[13px] text-muted-foreground">
                  {numberLabel}
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

            <View className="flex-row rounded-xl bg-muted p-1">
              {(["new", "existing"] as const).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  onPress={() => setMode(m)}
                  className={`h-9 flex-1 items-center justify-center rounded-lg ${
                    mode === m ? "bg-card" : ""
                  }`}
                >
                  <Text
                    className={`font-sans-medium text-[13px] ${
                      mode === m ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {m === "new" ? "New contact" : "Add to existing"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <View className="rounded-xl bg-destructive-soft px-3.5 py-3">
                <Text className="font-sans text-[13px] leading-[19px] text-destructive">
                  {error}
                </Text>
              </View>
            ) : null}

            {mode === "new" ? (
              <View className="gap-3">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Their name"
                  placeholderTextColor="#A1A1AA"
                  selectionColor="#FF8900"
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() =>
                    name.trim() && void submit({ newContactName: name.trim() })
                  }
                  className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !name.trim() || link.isPending }}
                  onPress={() => void submit({ newContactName: name.trim() })}
                  disabled={!name.trim() || link.isPending}
                  className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
                  style={{ opacity: name.trim() && !link.isPending ? 1 : 0.5 }}
                >
                  {link.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <UserPlus size={17} color="#FFFFFF" strokeWidth={2.2} />
                  )}
                  <Text className="font-sans-semibold text-[15px] text-primary-foreground">
                    {link.isPending ? "Saving…" : "Create contact"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Search contacts"
              />
            )}
          </View>

          {mode === "existing" ? (
            <FlatList
              data={items}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerClassName="px-5 pb-4 gap-2"
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                if (contacts.hasNextPage && !contacts.isFetchingNextPage) {
                  void contacts.fetchNextPage();
                }
              }}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add this number to ${item.name}`}
                  onPress={() => void submit({ contactId: item.id })}
                  disabled={link.isPending}
                  className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2.5 active:opacity-70"
                >
                  <ContactAvatar name={item.name} image={item.image} size={36} />
                  <View className="min-w-0 flex-1">
                    <Text
                      numberOfLines={1}
                      className="font-sans-medium text-[15px] text-card-foreground"
                    >
                      {item.name}
                    </Text>
                    {item.email ? (
                      <Text numberOfLines={1} className="font-sans text-xs text-muted-foreground">
                        {item.email}
                      </Text>
                    ) : null}
                  </View>
                  {link.isPending && link.variables && "contactId" in link.variables &&
                  link.variables.contactId === item.id ? (
                    <ActivityIndicator size="small" color="#FF8900" />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                contacts.isPending ? (
                  <ActivityIndicator color="#FF8900" />
                ) : (
                  <Text className="py-8 text-center font-sans text-sm text-muted-foreground">
                    {debounced.trim() ? "No contacts match that search." : "No contacts yet."}
                  </Text>
                )
              }
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
