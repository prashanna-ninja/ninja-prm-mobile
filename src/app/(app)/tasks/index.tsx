import { useRouter } from "expo-router";
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
import { Screen } from "@/components/screen";
import { TaskFilters, type TaskView } from "@/components/tasks/task-filters";
import { TaskRow } from "@/components/tasks/task-row";
import { SearchBar } from "@/components/ui/search-bar";
import { RecordingRowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, describeError } from "@/components/ui/states";
import { useInfiniteTasks, useSetTaskStatus } from "@/api/tasks.api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { pluralize } from "@/lib/format";
import { ListTodo, Plus } from "@/lib/icons";
import { dueGroup, type DueGroup } from "@/lib/tasks";
import type { Task, TaskPriority, TaskStatus } from "@/types/task.types";

type Row =
  | { kind: "header"; key: string; label: DueGroup }
  | { kind: "task"; key: string; task: Task };

export default function TasksScreen() {
  const router = useRouter();

  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<TaskView>("OPEN");
  const [priority, setPriority] = React.useState<TaskPriority | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  // The to-do list reads soonest-first (overdue at the top, undated last);
  // finished work reads most-recent-first.
  const isOpen = view === "OPEN";
  const query = useInfiniteTasks({
    search: debouncedSearch,
    status: view === "ALL" ? undefined : view,
    priority: priority ?? undefined,
    sortBy: isOpen ? "dueAt" : "updatedAt",
    sortOrder: isOpen ? "asc" : "desc",
  });

  const setStatus = useSetTaskStatus();
  const onToggle = (id: string, status: TaskStatus) => {
    setStatus.mutate(
      { id, status },
      {
        onError: (err) => Alert.alert("Couldn't update task", describeError(err)),
      },
    );
  };

  // Group headings only on the to-do view. The list arrives sorted by dueAt,
  // so a heading is emitted whenever the group changes — across page
  // boundaries too, which is why this runs over the flattened pages.
  const rows = React.useMemo<Row[]>(() => {
    const tasks = query.data?.pages.flatMap((p) => p.tasks) ?? [];
    if (!isOpen) return tasks.map((task) => ({ kind: "task", key: task.id, task }));
    const out: Row[] = [];
    let current: DueGroup | null = null;
    for (const task of tasks) {
      // Grouped as if OPEN: a row just ticked off (optimistically) must stay
      // under its heading until the refetch removes it, or a past-due done
      // task would open a stray second "Later" group mid-list.
      const group = dueGroup({ dueAt: task.dueAt, status: "OPEN" });
      if (group !== current) {
        out.push({ kind: "header", key: `h-${group}`, label: group });
        current = group;
      }
      out.push({ kind: "task", key: task.id, task });
    }
    return out;
  }, [query.data, isOpen]);

  const first = query.data?.pages[0];
  const hasFilters = debouncedSearch.trim().length > 0 || priority !== null;
  const noun = view === "OPEN" ? "to do" : view === "DONE" ? "done" : null;

  return (
    <Screen>
      <View className="gap-3 px-4 pb-3">
        <AppHeader
          title="Tasks"
          subtitle={
            first
              ? noun
                ? `${first.totalCount} ${noun}`
                : pluralize(first.totalCount, "task")
              : "Loading…"
          }
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add task"
              onPress={() => router.push("/tasks/new")}
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
          placeholder="Search tasks"
        />

        <TaskFilters
          view={view}
          onViewChange={setView}
          priority={priority}
          onPriorityChange={setPriority}
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
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) =>
            item.kind === "header" ? (
              <Text
                className={`pt-2 font-sans-semibold text-xs uppercase tracking-wide ${
                  item.label === "Overdue" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Text>
            ) : (
              <TaskRow task={item.task} onToggle={onToggle} />
            )
          }
          contentContainerClassName="px-4 pb-8 gap-2.5"
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
                icon={<ListTodo size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="No tasks found"
                message="Try adjusting your search or filters."
                action={{
                  label: "Clear filters",
                  onPress: () => {
                    setSearch("");
                    setPriority(null);
                  },
                }}
              />
            ) : view === "OPEN" ? (
              <EmptyState
                icon={<ListTodo size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title="Nothing to do"
                message="Action items from your recordings land here automatically, or add one yourself."
                action={{
                  label: "Add task",
                  onPress: () => router.push("/tasks/new"),
                }}
              />
            ) : (
              <EmptyState
                icon={<ListTodo size={32} color="#D4D4D8" strokeWidth={1.6} />}
                title={view === "DONE" ? "Nothing done yet" : "No tasks yet"}
              />
            )
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-5">
                <ActivityIndicator color="#FF8900" />
              </View>
            ) : rows.length > 0 && !query.hasNextPage ? (
              <Text className="py-5 text-center font-sans text-xs text-muted-foreground">
                All tasks loaded
              </Text>
            ) : null
          }
        />
      )}
    </Screen>
  );
}
