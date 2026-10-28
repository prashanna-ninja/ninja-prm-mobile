import * as React from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useInfiniteContacts } from "@/api/contacts.api";
import { TagBadges } from "@/components/contacts/tag-badges";
import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { SearchBar } from "@/components/ui/search-bar";
import { ErrorState } from "@/components/ui/states";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Check, X } from "@/lib/icons";
import type { TaskContactRef } from "@/types/task.types";

/**
 * Pick the contacts a task is about. Multi-select, searchable, paged — the
 * same list query as the Contacts tab, so results are usually already cached.
 *
 * Works on a DRAFT and only hands it back on Done, so closing the sheet is a
 * real cancel.
 */
export function ContactPickerSheet({
  visible,
  value,
  onClose,
  onDone,
}: {
  visible: boolean;
  value: TaskContactRef[];
  onClose: () => void;
  onDone: (next: TaskContactRef[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = React.useState<TaskContactRef[]>(value);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search);

  React.useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const query = useInfiniteContacts({ search: debounced });
  const items = React.useMemo(
    () => query.data?.pages.flatMap((p) => p.contacts) ?? [],
    [query.data],
  );

  const selectedIds = new Set(draft.map((c) => c.id));
  const toggle = (c: TaskContactRef) =>
    setDraft((prev) =>
      prev.some((p) => p.id === c.id)
        ? prev.filter((p) => p.id !== c.id)
        : [...prev, c],
    );

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
          className="h-[85%] rounded-t-3xl bg-background"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="items-center pb-1 pt-2.5">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          <View className="gap-3 px-5 pb-3 pt-1">
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-display text-[22px] text-foreground">
                  Related contacts
                </Text>
                <Text className="font-sans text-[13px] text-muted-foreground">
                  {draft.length === 0
                    ? "None selected"
                    : `${draft.length} selected`}
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

            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search contacts"
            />
          </View>

          {query.isPending ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#FF8900" />
            </View>
          ) : query.isError ? (
            <View className="px-5">
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerClassName="px-5 pb-4 gap-2"
              onEndReachedThreshold={0.4}
              onEndReached={() => {
                if (query.hasNextPage && !query.isFetchingNextPage) {
                  void query.fetchNextPage();
                }
              }}
              renderItem={({ item }) => {
                const selected = selectedIds.has(item.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={item.name}
                    onPress={() =>
                      toggle({ id: item.id, name: item.name, image: item.image })
                    }
                    className={`flex-row items-center gap-3 rounded-lg border p-2.5 active:opacity-70 ${
                      selected ? "border-primary bg-primary-soft" : "border-border bg-card"
                    }`}
                  >
                    <ContactAvatar name={item.name} image={item.image} size={36} />
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text
                        numberOfLines={1}
                        className="font-sans-medium text-[15px] text-card-foreground"
                      >
                        {item.name}
                      </Text>
                      {item.email || item.phone ? (
                        <Text
                          numberOfLines={1}
                          className="font-sans text-xs text-muted-foreground"
                        >
                          {item.email || item.phone}
                        </Text>
                      ) : null}
                      <TagBadges tags={item.tags} />
                    </View>
                    <View
                      className={`h-6 w-6 items-center justify-center rounded-full border ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {selected ? (
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text className="py-10 text-center font-sans text-sm text-muted-foreground">
                  {debounced.trim() ? "No contacts match that search." : "No contacts yet."}
                </Text>
              }
              ListFooterComponent={
                query.isFetchingNextPage ? (
                  <View className="py-4">
                    <ActivityIndicator color="#FF8900" />
                  </View>
                ) : null
              }
            />
          )}

          <View className="flex-row gap-3 px-5 pt-3">
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="h-12 flex-1 items-center justify-center rounded-xl border border-border active:opacity-70"
            >
              <Text className="font-sans-medium text-[15px] text-foreground">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onDone(draft)}
              className="h-12 flex-[1.4] items-center justify-center rounded-xl bg-primary active:opacity-80"
            >
              <Text className="font-sans-semibold text-[15px] text-primary-foreground">
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
