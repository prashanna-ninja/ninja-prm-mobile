import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import {
  TaskForm,
  taskToFormValues,
  toUpdateTaskInput,
  type TaskFormValues,
} from "@/components/tasks/task-form";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, describeError } from "@/components/ui/states";
import { useTask, useUpdateTask } from "@/api/tasks.api";
import { ArrowLeft } from "@/lib/icons";
import type { Task } from "@/types/task.types";

export default function EditTaskScreen() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const query = useTask(id);

  return (
    <Screen>
      {query.data ? (
        // Keyed so the form's initial values are taken once, from loaded data,
        // and a background refetch doesn't reset what the user is typing.
        <EditTaskForm key={query.data.id} task={query.data} />
      ) : (
        <View className="gap-6 px-4">
          <AppHeader title="Edit task" left={<BackButton />} />
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : (
            <View className="gap-3">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

function EditTaskForm({ task }: { task: Task }) {
  const router = useRouter();
  const update = useUpdateTask(task.id);

  const [initial] = React.useState<TaskFormValues>(() => taskToFormValues(task));
  const [values, setValues] = React.useState<TaskFormValues>(initial);

  const changes = toUpdateTaskInput(initial, values);
  const dirty = Object.keys(changes).length > 0;
  const canSave = values.title.trim().length > 0 && dirty && !update.isPending;

  const onSave = async () => {
    if (!canSave) return;
    try {
      await update.mutateAsync(changes);
      router.back();
    } catch (err) {
      Alert.alert("Couldn't save task", describeError(err));
    }
  };

  const onCancel = () => {
    if (!dirty) return router.back();
    Alert.alert("Discard your changes?", "Your edits won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView
      contentContainerClassName="px-4 pb-10 gap-6"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <AppHeader title="Edit task" left={<BackButton onPress={onCancel} />} />

      <TaskForm values={values} onChange={setValues} showStatus />

      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          disabled={update.isPending}
          className="h-12 flex-1 items-center justify-center rounded-xl border border-border active:opacity-70"
        >
          <Text className="font-sans-medium text-[15px] text-foreground">
            Cancel
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: update.isPending }}
          onPress={onSave}
          disabled={!canSave}
          className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
          style={{ opacity: canSave ? 1 : 0.5 }}
        >
          {update.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : null}
          <Text className="font-sans-semibold text-[15px] text-primary-foreground">
            {update.isPending ? "Saving…" : "Save changes"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress ?? (() => router.back())}
      hitSlop={10}
      className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
    >
      <ArrowLeft size={18} color="#52525B" strokeWidth={2} />
    </Pressable>
  );
}
