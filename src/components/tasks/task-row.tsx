import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { PriorityBadge } from "@/components/tasks/task-badges";
import { TaskCheck } from "@/components/tasks/task-check";
import { CalendarDays, Repeat, Users } from "@/lib/icons";
import { DUE_COLORS, dueState, formatDueDay } from "@/lib/tasks";
import type { Task, TaskStatus } from "@/types/task.types";

export function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: string, next: TaskStatus) => void;
}) {
  const router = useRouter();
  const closed = task.status !== "OPEN";
  const state = dueState(task);
  const dueColor = state ? DUE_COLORS[state] : undefined;

  const names = task.contacts.map((c) => c.contact.name);
  const people =
    names.length === 0
      ? null
      : names.length === 1
        ? names[0]
        : `${names[0]} +${names.length - 1}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={task.title}
      onPress={() =>
        router.push({ pathname: "/tasks/[id]", params: { id: task.id } })
      }
      className="flex-row items-start gap-3 rounded-lg border border-border bg-card p-3 active:opacity-70"
    >
      <View className="pt-0.5">
        <TaskCheck
          status={task.status}
          onToggle={(next) => onToggle(task.id, next)}
        />
      </View>

      <View className="min-w-0 flex-1 gap-1">
        <Text
          numberOfLines={2}
          className={`font-sans-medium text-[15px] leading-[20px] ${
            closed ? "text-muted-foreground" : "text-card-foreground"
          }`}
          style={closed ? { textDecorationLine: "line-through" } : undefined}
        >
          {task.title}
        </Text>

        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          {task.dueAt ? (
            <View className="flex-row items-center gap-1">
              <CalendarDays size={12} color={dueColor} strokeWidth={2} />
              <Text
                className="font-sans-medium text-xs"
                style={{ color: dueColor }}
              >
                {state === "overdue" ? "Overdue · " : ""}
                {formatDueDay(task.dueAt)}
              </Text>
            </View>
          ) : null}

          {task.repeatInterval ? (
            <Repeat size={12} color="#A1A1AA" strokeWidth={2} />
          ) : null}

          {people ? (
            <View className="min-w-0 shrink flex-row items-center gap-1">
              <Users size={12} color="#A1A1AA" strokeWidth={2} />
              <Text
                numberOfLines={1}
                className="shrink font-sans text-xs text-muted-foreground"
              >
                {people}
              </Text>
            </View>
          ) : null}

          {/* Normal is the default for almost everything — only flag the
              exceptions, or every row carries the same grey pill. */}
          {task.priority !== "NORMAL" && !closed ? (
            <PriorityBadge priority={task.priority} size="sm" />
          ) : null}
        </View>

        {task.sourceLabel ? (
          <Text
            numberOfLines={1}
            className="font-sans text-xs text-muted-foreground"
          >
            From {task.sourceLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
