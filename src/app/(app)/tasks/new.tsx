import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import {
  EMPTY_TASK_FORM,
  TaskForm,
  toCreateTaskInput,
  type TaskFormValues,
} from "@/components/tasks/task-form";
import { describeError } from "@/components/ui/states";
import { useCreateTask } from "@/api/tasks.api";
import { ArrowLeft } from "@/lib/icons";

/**
 * New task. Opened from the Tasks tab, or from a contact with
 * `contactId` + `contactName` so the task arrives already linked to them.
 */
export default function NewTaskScreen() {
  const router = useRouter();
  const { contactId, contactName } = useLocalSearchParams<{
    contactId?: string;
    contactName?: string;
  }>();
  const create = useCreateTask();

  const initial = React.useMemo<TaskFormValues>(
    () =>
      contactId
        ? {
            ...EMPTY_TASK_FORM,
            contacts: [{ id: contactId, name: contactName ?? "Contact", image: null }],
          }
        : EMPTY_TASK_FORM,
    [contactId, contactName],
  );
  const [values, setValues] = React.useState<TaskFormValues>(initial);

  const canSave = values.title.trim().length > 0 && !create.isPending;

  const onSave = async () => {
    if (!canSave) return;
    try {
      const task = await create.mutateAsync(toCreateTaskInput(values));
      // replace, not push — backing out of a new task should land where you
      // came from, not on the form you just submitted.
      router.replace({
        pathname: "/tasks/[id]",
        params: contactId ? { id: task.id, fromContact: contactId } : { id: task.id },
      });
    } catch (err) {
      Alert.alert("Couldn't save task", describeError(err));
    }
  };

  const onCancel = () => {
    const dirty = JSON.stringify(values) !== JSON.stringify(initial);
    if (!dirty) return router.back();

    Alert.alert("Discard this task?", "Your changes won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-4 pb-10 gap-6"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <AppHeader
          title="New task"
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onCancel}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <ArrowLeft size={18} color="#52525B" strokeWidth={2} />
            </Pressable>
          }
        />

        <TaskForm values={values} onChange={setValues} />

        <View className="flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            disabled={create.isPending}
            className="h-12 flex-1 items-center justify-center rounded-xl border border-border active:opacity-70"
          >
            <Text className="font-sans-medium text-[15px] text-foreground">
              Cancel
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave, busy: create.isPending }}
            onPress={onSave}
            disabled={!canSave}
            className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            {create.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : null}
            <Text className="font-sans-semibold text-[15px] text-primary-foreground">
              {create.isPending ? "Saving…" : "Add task"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
