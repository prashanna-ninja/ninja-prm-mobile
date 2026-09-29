import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/app-header";
import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { Screen } from "@/components/screen";
import { PriorityBadge, StatusBadge } from "@/components/tasks/task-badges";
import { TaskCheck } from "@/components/tasks/task-check";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, describeError } from "@/components/ui/states";
import { useDeleteTask, useSetTaskStatus, useTask } from "@/api/tasks.api";
import { formatDateTime } from "@/lib/format";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleX,
  Library,
  Pencil,
  Repeat,
  RotateCcw,
  Trash,
} from "@/lib/icons";
import { DUE_COLORS, dueDay, dueState, htmlToText } from "@/lib/tasks";
import { REPEAT_LABELS, type RepeatInterval, type TaskStatus } from "@/types/task.types";

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id = "", fromContact } = useLocalSearchParams<{
    id?: string;
    /** Set when opened from a contact, so Back returns there. */
    fromContact?: string;
  }>();

  const query = useTask(id);
  const setStatus = useSetTaskStatus();
  const remove = useDeleteTask();

  const goBack = () =>
    fromContact
      ? router.replace({ pathname: "/contacts/[id]", params: { id: fromContact } })
      : router.replace("/tasks");

  const task = query.data;

  const changeStatus = (status: TaskStatus) =>
    setStatus.mutate(
      { id, status },
      { onError: (err) => Alert.alert("Couldn't update task", describeError(err)) },
    );

  const onDelete = () => {
    Alert.alert(
      "Delete this task?",
      "This permanently removes it and can't be undone. Cancelling a task keeps it on record instead.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await remove.mutateAsync(id);
              goBack();
            } catch (err) {
              Alert.alert("Couldn't delete task", describeError(err));
            }
          },
        },
      ],
    );
  };

  const state = task ? dueState(task) : null;
  const notes = htmlToText(task?.description);
  const busy = setStatus.isPending || remove.isPending;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-4 pb-10 gap-6"
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor="#FF8900"
            colors={["#FF8900"]}
          />
        }
      >
        <AppHeader
          title="Task"
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <ArrowLeft size={18} color="#52525B" strokeWidth={2} />
            </Pressable>
          }
          right={
            task ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit task"
                onPress={() =>
                  router.push({ pathname: "/tasks/[id]/edit", params: { id } })
                }
                hitSlop={10}
                className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
              >
                <Pencil size={17} color="#52525B" strokeWidth={2} />
              </Pressable>
            ) : null
          }
        />

        {query.isPending ? (
          <View className="gap-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !task ? (
          <EmptyState
            title="Task not found"
            action={{ label: "Back", onPress: goBack }}
          />
        ) : (
          <>
            <View className="flex-row items-start gap-3">
              <View className="pt-1">
                <TaskCheck
                  status={task.status}
                  onToggle={changeStatus}
                  size={28}
                  disabled={busy}
                />
              </View>
              <View className="min-w-0 flex-1 gap-2">
                <Text
                  className={`font-display text-[22px] leading-[28px] ${
                    task.status === "OPEN" ? "text-foreground" : "text-muted-foreground"
                  }`}
                  style={
                    task.status === "DONE"
                      ? { textDecorationLine: "line-through" }
                      : undefined
                  }
                >
                  {task.title}
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </View>
              </View>
            </View>

            <View className="gap-2">
              <InfoRow
                icon={
                  <CalendarDays
                    size={16}
                    color={state ? DUE_COLORS[state] : "#71717A"}
                    strokeWidth={2}
                  />
                }
                label={
                  task.dueAt
                    ? format(dueDay(task.dueAt), "EEEE d MMMM yyyy")
                    : "No due date"
                }
                note={
                  state === "overdue" ? "Overdue" : state === "today" ? "Today" : undefined
                }
                noteColor={state ? DUE_COLORS[state] : undefined}
              />
              {task.repeatInterval ? (
                <InfoRow
                  icon={<Repeat size={16} color="#71717A" strokeWidth={2} />}
                  label={`Repeats ${(
                    REPEAT_LABELS[task.repeatInterval as RepeatInterval] ??
                    task.repeatInterval
                  ).toLowerCase()}`}
                />
              ) : null}
            </View>

            {notes ? (
              <Block title="Notes">
                <Text
                  selectable
                  className="font-sans text-sm leading-[21px] text-card-foreground"
                >
                  {notes}
                </Text>
              </Block>
            ) : null}

            {task.contacts.length > 0 ? (
              <Block title={`Related contacts (${task.contacts.length})`}>
                {task.contacts.map(({ contact }) => (
                  <Pressable
                    key={contact.id}
                    accessibilityRole="button"
                    accessibilityLabel={contact.name}
                    onPress={() =>
                      router.push({
                        pathname: "/contacts/[id]",
                        params: { id: contact.id },
                      })
                    }
                    className="flex-row items-center gap-3 active:opacity-70"
                  >
                    <ContactAvatar name={contact.name} image={contact.image} size={36} />
                    <View className="min-w-0 flex-1">
                      <Text
                        numberOfLines={1}
                        className="font-sans-medium text-[15px] text-card-foreground"
                      >
                        {contact.name}
                      </Text>
                      {contact.email || contact.phone ? (
                        <Text
                          numberOfLines={1}
                          className="font-sans text-xs text-muted-foreground"
                        >
                          {contact.email || contact.phone}
                        </Text>
                      ) : null}
                    </View>
                    <ChevronRight size={16} color="#A1A1AA" strokeWidth={2} />
                  </Pressable>
                ))}
              </Block>
            ) : null}

            {/* Tasks generated from a recording's action items carry where
                they came from — worth one tap back to the context. */}
            {task.sourceType && task.sourceId ? (
              <Block title="From recording">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={task.sourceLabel ?? "Open recording"}
                  onPress={() =>
                    router.push({
                      pathname: "/recordings/[source]/[id]",
                      params: { source: task.sourceType!, id: task.sourceId! },
                    })
                  }
                  className="flex-row items-center gap-3 active:opacity-70"
                >
                  <Library size={16} color="#AD5100" strokeWidth={2} />
                  <Text
                    numberOfLines={2}
                    className="min-w-0 flex-1 font-sans-medium text-sm text-primary-strong"
                  >
                    {task.sourceLabel || "Open recording"}
                  </Text>
                  <ChevronRight size={16} color="#A1A1AA" strokeWidth={2} />
                </Pressable>
              </Block>
            ) : null}

            <Text className="font-sans text-xs text-muted-foreground">
              Created {formatDateTime(task.createdAt)} · Updated{" "}
              {formatDateTime(task.updatedAt)}
            </Text>

            <View className="flex-row gap-2">
              {task.status === "OPEN" ? (
                <ActionButton
                  icon={<CircleX size={16} color="#52525B" strokeWidth={2} />}
                  label="Cancel task"
                  onPress={() => changeStatus("CANCELLED")}
                  disabled={busy}
                />
              ) : (
                <ActionButton
                  icon={<RotateCcw size={16} color="#52525B" strokeWidth={2} />}
                  label="Reopen"
                  onPress={() => changeStatus("OPEN")}
                  disabled={busy}
                />
              )}
              <ActionButton
                icon={
                  remove.isPending ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Trash size={16} color="#DC2626" strokeWidth={2} />
                  )
                }
                label="Delete"
                tone="destructive"
                onPress={onDelete}
                disabled={busy}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  note,
  noteColor,
}: {
  icon: React.ReactNode;
  label: string;
  note?: string;
  noteColor?: string;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3">
      {icon}
      <Text numberOfLines={1} className="min-w-0 flex-1 font-sans text-sm text-card-foreground">
        {label}
      </Text>
      {note ? (
        <Text className="font-sans-semibold text-xs" style={{ color: noteColor }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  tone = "neutral",
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "neutral" | "destructive";
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border active:opacity-70"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {icon}
      <Text
        className={`font-sans-medium text-[13px] ${
          tone === "destructive" ? "text-destructive" : "text-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      <View className="gap-3 rounded-lg border border-border bg-card p-4">
        {children}
      </View>
    </View>
  );
}
