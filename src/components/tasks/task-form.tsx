import { isSameDay } from "date-fns";
import * as React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { ContactPickerSheet } from "@/components/tasks/contact-picker-sheet";
import { DueDateField } from "@/components/tasks/due-date-field";
import { Plus, X } from "@/lib/icons";
import { dueAtForDay, dueDay, htmlToText, textToHtml } from "@/lib/tasks";
import {
  REPEAT_INTERVALS,
  REPEAT_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type CreateTaskInput,
  type RepeatInterval,
  type Task,
  type TaskContactRef,
  type TaskPriority,
  type TaskStatus,
  type UpdateTaskInput,
} from "@/types/task.types";

export type TaskFormValues = {
  title: string;
  /** Plain text. Converted to/from the server's HTML at the edges. */
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: Date | null;
  repeat: RepeatInterval | null;
  contacts: TaskContactRef[];
};

export const EMPTY_TASK_FORM: TaskFormValues = {
  title: "",
  description: "",
  status: "OPEN",
  priority: "NORMAL",
  due: null,
  repeat: null,
  contacts: [],
};

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: htmlToText(task.description),
    status: task.status,
    priority: task.priority,
    due: task.dueAt ? dueDay(task.dueAt) : null,
    // Free text server-side; anything the web form wouldn't write shows as
    // "None" and — because it's unchanged — is never sent back.
    repeat: REPEAT_INTERVALS.includes(task.repeatInterval as RepeatInterval)
      ? (task.repeatInterval as RepeatInterval)
      : null,
    contacts: task.contacts.map((c) => c.contact),
  };
}

export function toCreateTaskInput(v: TaskFormValues): CreateTaskInput {
  const input: CreateTaskInput = {
    title: v.title.trim(),
    priority: v.priority,
  };
  if (v.description.trim()) input.description = textToHtml(v.description);
  if (v.due) input.dueAt = dueAtForDay(v.due);
  if (v.repeat) input.repeatInterval = v.repeat;
  if (v.contacts.length) input.contactIds = v.contacts.map((c) => c.id);
  return input;
}

/**
 * Only the fields that CHANGED.
 *
 * This matters twice over: an untouched description keeps the web's rich-text
 * formatting instead of being flattened to paragraphs, and `contactIds` is
 * only sent when the set really changed — it triggers the server's
 * delete-then-recreate (see UpdateTaskInput).
 */
export function toUpdateTaskInput(
  initial: TaskFormValues,
  v: TaskFormValues,
): UpdateTaskInput {
  const input: UpdateTaskInput = {};
  if (v.title.trim() !== initial.title) input.title = v.title.trim();
  if (v.description.trim() !== initial.description.trim()) {
    input.description = v.description.trim() ? textToHtml(v.description) : "";
  }
  if (v.status !== initial.status) input.status = v.status;
  if (v.priority !== initial.priority) input.priority = v.priority;

  const dueChanged =
    (v.due === null) !== (initial.due === null) ||
    (v.due && initial.due && !isSameDay(v.due, initial.due));
  if (dueChanged) input.dueAt = v.due ? dueAtForDay(v.due) : null;

  if (v.repeat !== initial.repeat) input.repeatInterval = v.repeat;

  const ids = (list: TaskContactRef[]) => list.map((c) => c.id).sort().join(",");
  if (ids(v.contacts) !== ids(initial.contacts)) {
    input.contactIds = v.contacts.map((c) => c.id);
  }
  return input;
}

/**
 * Create/edit fields for a task.
 *
 * Deliberately omitted vs. the web form: rich text (RN has no editor; notes
 * are plain text, see toUpdateTaskInput), tags and opportunities.
 */
export function TaskForm({
  values,
  onChange,
  showStatus,
}: {
  values: TaskFormValues;
  onChange: (next: TaskFormValues) => void;
  /** Edit only — a new task is always open. */
  showStatus?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <View className="gap-6">
      <Field label="Title" required>
        <TextInput
          value={values.title}
          onChangeText={(t) => set("title", t)}
          placeholder="Call Sarah about the renewal"
          placeholderTextColor="#A1A1AA"
          selectionColor="#FF8900"
          autoCapitalize="sentences"
          className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
        />
      </Field>

      <Field label="Due">
        <DueDateField value={values.due} onChange={(d) => set("due", d)} />
      </Field>

      <Field label="Priority">
        <Choices
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
          value={values.priority}
          onChange={(p) => set("priority", p)}
        />
      </Field>

      {showStatus ? (
        <Field label="Status">
          <Choices
            options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
            value={values.status}
            onChange={(s) => set("status", s)}
          />
        </Field>
      ) : null}

      <Field label="Related contacts">
        <View className="gap-2">
          {values.contacts.map((c) => (
            <View
              key={c.id}
              className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2.5"
            >
              <ContactAvatar name={c.name} image={c.image} size={32} />
              <Text
                numberOfLines={1}
                className="min-w-0 flex-1 font-sans-medium text-[15px] text-card-foreground"
              >
                {c.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c.name}`}
                onPress={() =>
                  set("contacts", values.contacts.filter((x) => x.id !== c.id))
                }
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
              >
                <X size={16} color="#71717A" strokeWidth={2.2} />
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setPickerOpen(true)}
            className="h-11 flex-row items-center justify-center gap-1.5 rounded-lg border border-dashed border-border active:opacity-70"
          >
            <Plus size={16} color="#AD5100" strokeWidth={2.4} />
            <Text className="font-sans-medium text-[14px] text-primary-strong">
              {values.contacts.length ? "Add or remove contacts" : "Link a contact"}
            </Text>
          </Pressable>
        </View>
      </Field>

      <Field label="Repeat">
        <Choices
          options={[
            { value: null, label: "None" },
            ...REPEAT_INTERVALS.map((r) => ({ value: r, label: REPEAT_LABELS[r] })),
          ]}
          value={values.repeat}
          onChange={(r) => set("repeat", r)}
        />
      </Field>

      <Field label="Notes">
        <TextInput
          value={values.description}
          onChangeText={(t) => set("description", t)}
          placeholder="Anything you'll need when you get to it"
          placeholderTextColor="#A1A1AA"
          selectionColor="#FF8900"
          multiline
          textAlignVertical="top"
          className="min-h-[110px] rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] leading-[21px] text-foreground"
        />
      </Field>

      <ContactPickerSheet
        visible={pickerOpen}
        value={values.contacts}
        onClose={() => setPickerOpen(false)}
        onDone={(next) => {
          set("contacts", next);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

function Choices<T extends string | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            className={`rounded-full border px-3.5 py-2 active:opacity-70 ${
              active ? "border-primary bg-primary" : "border-border bg-card"
            }`}
          >
            <Text
              className={`font-sans-medium text-[13px] ${
                active ? "text-primary-foreground" : "text-card-foreground"
              }`}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="font-sans-medium text-[13px] text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}
