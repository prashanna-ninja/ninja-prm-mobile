import { useRouter } from "expo-router";
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
import { ContactRow } from "@/components/contacts/contact-row";
import { RelationshipFilter } from "@/components/contacts/relationship-filter";
import { Screen } from "@/components/screen";
import { SearchBar } from "@/components/ui/search-bar";
import { RecordingRowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useInfiniteContacts } from "@/api/contacts.api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { pluralize } from "@/lib/format";
import { Plus, Users } from "@/lib/icons";
import type { RelationshipType } from "@/types/contact.types";

export default function ContactsScreen() {
  const router = useRouter();

  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState<RelationshipType | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const query = useInfiniteContacts({
    search: debouncedSearch,
    relationshipType: type ?? undefined,
  });
  const pull = usePullRefresh(() => query.refetch());

  const items = React.useMemo(
    () => query.data?.pages.flatMap((p) => p.contacts) ?? [],
    [query.data],
  );
  const first = query.data?.pages[0];
  const hasFilters = debouncedSearch.trim().length > 0 || type !== null;

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3">
        <AppHeader
          title="Contacts"
          subtitle={first ? pluralize(first.totalCount, "contact") : "Loading…"}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add contact"
              onPress={() => router.push("/contacts/new")}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
            >
              <Plus size={20} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
          }
        />

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, email or phone"
        />

        <RelationshipFilter
          value={type}
          onChange={setType}
          total={first?.totalCount}
        />
      </View>

      {query.isPending ? (
        <View className="px-4">
          <RecordingRowSkeleton count={7} />
        </View>
      ) : query.isError ? (
        <View className="px-4">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ContactRow contact={item} />}
          contentContainerClassName="px-4 pb-8 gap-2.5"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
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
                icon={<Users size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="No contacts found"
                message="Try adjusting your search or filters."
                action={{
                  label: "Clear filters",
                  onPress: () => {
                    setSearch("");
                    setType(null);
                  },
                }}
              />
            ) : (
              <EmptyState
                icon={<Users size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="No contacts yet"
                message="Add your first contact to start tracking conversations and follow-ups."
                action={{
                  label: "Add contact",
                  onPress: () => router.push("/contacts/new"),
                }}
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
                All contacts loaded
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}
