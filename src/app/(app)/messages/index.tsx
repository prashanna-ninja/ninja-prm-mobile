import { useFocusEffect, useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/app-header";
import { MessageFilters } from "@/components/messages/message-filters";
import { PushPromptCard } from "@/components/notifications/push-prompt-card";
import { ThreadRow } from "@/components/messages/thread-row";
import { Screen } from "@/components/screen";
import { SearchBar } from "@/components/ui/search-bar";
import { RecordingRowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, describeError } from "@/components/ui/states";
import {
  useCheckForNewTexts,
  useInfiniteSmsThreads,
  useSmsSetup,
  useSyncSmsHistory,
} from "@/api/sms.api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MessagesSquare, Plus, RefreshCw } from "@/lib/icons";
import type { SmsFilter } from "@/types/sms.types";

export default function MessagesScreen() {
  const router = useRouter();
  const setup = useSmsSetup();
  const configured = setup.data?.configured === true;
  const lines = setup.data?.lines ?? [];

  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<SmsFilter>("all");
  const [lineKey, setLineKey] = React.useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const query = useInfiniteSmsThreads(
    { search: debouncedSearch, filter, lineKey: lineKey ?? undefined },
    configured,
  );
  const check = useCheckForNewTexts();
  const sync = useSyncSmsHistory();

  // The inbox isn't polled (see sms.api.ts), so re-read it whenever you come
  // back to it — from a thread, or from another tab. Skip the first focus:
  // the query is already loading then.
  const focusedOnce = React.useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      if (focusedOnce.current && configured) void query.refetch();
      focusedOnce.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configured]),
  );

  const threads = React.useMemo(
    () => query.data?.pages.flatMap((p) => p.threads) ?? [],
    [query.data],
  );
  const first = query.data?.pages[0];
  const hasFilters = debouncedSearch.trim().length >= 2 || filter !== "all" || lineKey !== null;

  const onRefresh = () => {
    // CrazyTel's cheap change check, then a re-read (check invalidates on settle).
    check.mutate(undefined, { onError: () => void query.refetch() });
  };

  const onSync = () => {
    sync.mutate(undefined, {
      onSuccess: (res) => {
        if (res.alreadyRunning) {
          Alert.alert("Already syncing", "A sync with CrazyTel is already running.");
        } else if (res.backfillPending) {
          Alert.alert(
            "Still importing",
            `Imported ${res.imported ?? 0} so far. Older history keeps importing in the background.`,
          );
        }
      },
      onError: (err) => Alert.alert("Couldn't sync with CrazyTel", describeError(err)),
    });
  };

  const subtitle = !configured
    ? "Two-way SMS through CrazyTel"
    : first
      ? first.unreadTotal > 0
        ? `${first.unreadTotal} unread ${first.unreadTotal === 1 ? "conversation" : "conversations"}`
        : "All caught up"
      : "Loading…";

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3">
        <AppHeader
          title="Messages"
          subtitle={subtitle}
          right={
            configured ? (
              <View className="flex-row gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sync with CrazyTel"
                  onPress={onSync}
                  disabled={sync.isPending}
                  hitSlop={8}
                  className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
                >
                  {sync.isPending ? (
                    <ActivityIndicator size="small" color="#FF8900" />
                  ) : (
                    <RefreshCw size={17} color="#52525B" strokeWidth={2} />
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="New message"
                  onPress={() => router.push("/messages/new")}
                  hitSlop={8}
                  className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
                >
                  <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
                </Pressable>
              </View>
            ) : null
          }
        />

        {configured ? (
          <>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search names, numbers or messages"
            />
            <MessageFilters
              filter={filter}
              onFilterChange={setFilter}
              lineKey={lineKey}
              onLineChange={setLineKey}
              lines={lines}
            />
            <PushPromptCard />
          </>
        ) : null}
      </View>

      {setup.isPending ? (
        <View className="px-4">
          <RecordingRowSkeleton count={7} />
        </View>
      ) : setup.isError ? (
        <View className="px-4">
          <ErrorState error={setup.error} onRetry={() => void setup.refetch()} />
        </View>
      ) : !configured ? (
        <View className="px-4">
          <EmptyState
            icon={<MessagesSquare size={32} color="#D4D4D8" strokeWidth={1.6} />}
            title="SMS isn't set up"
            message="Connect your CrazyTel account under Integrations in Ninja PRM on the web. Your texts will show up here once it's connected."
          />
        </View>
      ) : query.isPending ? (
        <View className="px-4">
          <RecordingRowSkeleton count={7} />
        </View>
      ) : query.isError ? (
        <View className="px-4">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <ThreadRow thread={item} lines={lines} />}
          contentContainerClassName="px-4 pb-8 gap-2.5"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={check.isPending || (query.isRefetching && !query.isFetchingNextPage)}
              onRefresh={onRefresh}
              tintColor="#FF8900"
              colors={["#FF8900"]}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            hasFilters ? (
              <EmptyState
                icon={<MessagesSquare size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="No conversations found"
                message="Try adjusting your search or filters."
                action={{
                  label: "Clear filters",
                  onPress: () => {
                    setSearch("");
                    setFilter("all");
                    setLineKey(null);
                  },
                }}
              />
            ) : (
              <EmptyState
                icon={<MessagesSquare size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="No messages yet"
                message="Texts to and from your CrazyTel numbers will appear here."
                action={{
                  label: "New message",
                  onPress: () => router.push("/messages/new"),
                }}
              />
            )
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-5">
                <ActivityIndicator color="#FF8900" />
              </View>
            ) : threads.length > 0 && !query.hasNextPage ? (
              <Text className="py-5 text-center font-sans text-xs text-muted-foreground">
                All conversations loaded
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}
