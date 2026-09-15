import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/app-header";
import { RecordingRow } from "@/components/recordings/recording-row";
import { SourceChips } from "@/components/recordings/source-chips";
import { Screen } from "@/components/screen";
import { SearchBar } from "@/components/ui/search-bar";
import { RecordingRowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useInfiniteRecordings } from "@/api/recordings.api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ArrowUpDown, Library } from "@/lib/icons";
import { pluralize } from "@/lib/format";
import {
  RECORDING_SOURCE_FILTERS,
  type RecordingSortOrder,
  type RecordingSourceFilter,
} from "@/types/recording.types";

export default function RecordingsScreen() {
  // Home hands the source over as a route param (tapping a library row).
  const params = useLocalSearchParams<{ source?: string }>();
  const initialSource = RECORDING_SOURCE_FILTERS.includes(
    params.source as RecordingSourceFilter,
  )
    ? (params.source as RecordingSourceFilter)
    : "all";

  const [search, setSearch] = React.useState("");
  const [source, setSource] = React.useState<RecordingSourceFilter>(initialSource);
  const [sortOrder, setSortOrder] = React.useState<RecordingSortOrder>("desc");

  // Re-apply if the user taps a different source on Home while this tab is
  // already mounted (the tab isn't unmounted between visits).
  React.useEffect(() => {
    setSource(initialSource);
  }, [initialSource]);

  const debouncedSearch = useDebouncedValue(search);

  const query = useInfiniteRecordings({
    search: debouncedSearch,
    source,
    sortBy: "date",
    sortOrder,
  });

  const items = React.useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );
  const first = query.data?.pages[0];
  const hasFilters = debouncedSearch.trim().length > 0 || source !== "all";

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3">
        <AppHeader
          title="Recordings"
          subtitle={
            first ? pluralize(first.totalCount, "recording") : "Loading…"
          }
        />

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search titles, summaries, transcripts"
        />

        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <SourceChips
              value={source}
              onChange={setSource}
              counts={first?.countsBySource}
              total={first?.totalCount}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              sortOrder === "desc"
                ? "Sorted newest first. Switch to oldest first."
                : "Sorted oldest first. Switch to newest first."
            }
            onPress={() =>
              setSortOrder((o) => (o === "desc" ? "asc" : "desc"))
            }
            className="h-9 flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 active:opacity-70"
          >
            <ArrowUpDown size={14} color="#52525B" strokeWidth={2} />
            <Text className="font-sans-medium text-[12px] text-card-foreground">
              {sortOrder === "desc" ? "Newest" : "Oldest"}
            </Text>
          </Pressable>
        </View>
      </View>

      {query.isPending ? (
        <View className="px-4">
          <RecordingRowSkeleton count={6} />
        </View>
      ) : query.isError ? (
        <View className="px-4">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </View>
      ) : (
        <FlatList
          data={items}
          // ids are only unique per source table, so both are needed.
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item }) => <RecordingRow item={item} />}
          contentContainerClassName="px-4 pb-8 gap-3"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={() => void query.refetch()}
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
                icon={<Library size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="No recordings match your filters"
                action={{
                  label: "Clear filters",
                  onPress: () => {
                    setSearch("");
                    setSource("all");
                  },
                }}
              />
            ) : (
              <EmptyState
                icon={<Library size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="No recordings yet"
                message="Calls, Plaud, Granola and Fieldy recordings will all appear here."
              />
            )
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-5">
                <ActivityIndicator color="#FF8900" />
              </View>
            ) : items.length > 0 && !query.hasNextPage ? (
              <Text className="py-5 text-center font-sans text-xs text-muted-foreground">
                That&apos;s everything
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}
