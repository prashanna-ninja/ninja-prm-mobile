import * as React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { useCreateTag, useTags } from "@/api/tags.api";
import { ChipInput } from "@/components/contacts/chip-input";
import { describeError } from "@/components/ui/states";
import { Plus, X } from "@/lib/icons";
import {
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  parseStringList,
  type ContactDetail,
  type CreateContactInput,
  type RelationshipType,
  type UpdateContactInput,
} from "@/types/contact.types";

export type ContactFormValues = {
  name: string;
  relationshipType: RelationshipType;
  email: string;
  /** One box per number. The PRM stores every number a contact has. */
  phones: string[];
  location: string;
  about: string;
  likes: string[];
  dislikes: string[];
  tagIds: string[];
};

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  relationshipType: "FRIEND",
  email: "",
  phones: [""],
  location: "",
  about: "",
  likes: [],
  dislikes: [],
  tagIds: [],
};

/** Trimmed, non-empty numbers, in order. */
function cleanPhones(phones: string[]): string[] {
  return phones.map((p) => p.trim()).filter(Boolean);
}

/** Only send fields the user actually filled. */
export function toCreateInput(v: ContactFormValues): CreateContactInput {
  const input: CreateContactInput = {
    name: v.name.trim(),
    relationshipType: v.relationshipType,
  };
  const phones = cleanPhones(v.phones);
  if (v.email.trim()) input.email = v.email.trim();
  if (phones.length) input.phone = phones;
  if (v.location.trim()) input.location = v.location.trim();
  if (v.about.trim()) input.about = v.about.trim();
  if (v.likes.length) input.likes = v.likes;
  if (v.dislikes.length) input.dislikes = v.dislikes;
  if (v.tagIds.length) input.tagIds = v.tagIds;
  return input;
}

/** The edit form's starting values, from GET /contacts/:id. */
export function contactToForm(c: ContactDetail): ContactFormValues {
  const phones = parseStringList(c.phone);
  return {
    name: c.name,
    relationshipType: c.relationshipType,
    email: c.email ?? "",
    phones: phones.length ? phones : [""],
    location: c.location ?? "",
    about: c.about ?? "",
    likes: parseStringList(c.likes),
    dislikes: parseStringList(c.dislikes),
    tagIds: (c.tags ?? []).map((t) => t.id),
  };
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * PATCH body: ONLY the fields that changed. The server leaves every key we
 * don't send alone, so anything this form doesn't show (photo, notes,
 * company, date of birth, timezone) is never touched. `""` / `[]` clears.
 */
export function toUpdateInput(
  initial: ContactFormValues,
  v: ContactFormValues,
): UpdateContactInput {
  const input: UpdateContactInput = {};
  for (const k of ["name", "email", "location", "about"] as const) {
    if (v[k].trim() !== initial[k].trim()) input[k] = v[k].trim();
  }
  if (v.relationshipType !== initial.relationshipType) {
    input.relationshipType = v.relationshipType;
  }
  const phones = cleanPhones(v.phones);
  if (!sameList(phones, cleanPhones(initial.phones))) input.phone = phones;
  if (!sameList(v.likes, initial.likes)) input.likes = v.likes;
  if (!sameList(v.dislikes, initial.dislikes)) input.dislikes = v.dislikes;
  if (!sameSet(v.tagIds, initial.tagIds)) input.tagIds = v.tagIds;
  return input;
}

const INPUT_CLASS =
  "rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground";

/**
 * Create/edit fields for a contact.
 *
 * A trimmed-down version of the web form. Deliberately omitted for now:
 * profile photo upload, important dates, notes categories and company
 * linking. Each needs its own endpoint or picker, and none of them is what
 * you reach for on a phone.
 */
export function ContactForm({
  values,
  onChange,
}: {
  values: ContactFormValues;
  onChange: (next: ContactFormValues) => void;
}) {
  const set = <K extends keyof ContactFormValues>(
    key: K,
    value: ContactFormValues[K],
  ) => onChange({ ...values, [key]: value });

  return (
    <View className="gap-6">
      <Section title="Basic information">
        <Field label="Name" required>
          <TextInput
            value={values.name}
            onChangeText={(t) => set("name", t)}
            placeholder="John Doe"
            placeholderTextColor="#A1A1AA"
            selectionColor="#FF8900"
            autoCapitalize="words"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Relationship type" required>
          <View className="flex-row flex-wrap gap-2">
            {RELATIONSHIP_TYPES.map((type) => {
              const active = values.relationshipType === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => set("relationshipType", type)}
                  className={`rounded-full border px-3.5 py-2 active:opacity-70 ${
                    active ? "border-primary bg-primary" : "border-border bg-card"
                  }`}
                >
                  <Text
                    className={`font-sans-medium text-[13px] ${
                      active ? "text-primary-foreground" : "text-card-foreground"
                    }`}
                  >
                    {RELATIONSHIP_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </Section>

      <Section title="Contact information">
        <Field label="Email">
          <TextInput
            value={values.email}
            onChangeText={(t) => set("email", t)}
            placeholder="john@example.com"
            placeholderTextColor="#A1A1AA"
            selectionColor="#FF8900"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label={values.phones.length > 1 ? "Phone numbers" : "Phone"}>
          <PhoneList phones={values.phones} onChange={(next) => set("phones", next)} />
        </Field>

        <Field label="Location">
          <TextInput
            value={values.location}
            onChangeText={(t) => set("location", t)}
            placeholder="City, Country"
            placeholderTextColor="#A1A1AA"
            selectionColor="#FF8900"
            className={INPUT_CLASS}
          />
        </Field>
      </Section>

      <Section title="Tags" hint="Tap a tag to add or remove it.">
        <TagPicker selected={values.tagIds} onChange={(next) => set("tagIds", next)} />
      </Section>

      <Section
        title="Personal preferences"
        hint="Things they like or dislike, so you remember what matters to them."
      >
        <Field label="Likes">
          <ChipInput
            value={values.likes}
            onChange={(next) => set("likes", next)}
            placeholder="Add something they like"
          />
        </Field>

        <Field label="Dislikes">
          <ChipInput
            value={values.dislikes}
            onChange={(next) => set("dislikes", next)}
            placeholder="Add something they dislike"
            accent="#9F1239"
            accentBg="#FFE4E6"
          />
        </Field>
      </Section>

      <Section title="About">
        <Field label="Notes">
          <TextInput
            value={values.about}
            onChangeText={(t) => set("about", t)}
            placeholder="Anything worth remembering"
            placeholderTextColor="#A1A1AA"
            selectionColor="#FF8900"
            multiline
            textAlignVertical="top"
            className="min-h-[88px] rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] leading-[21px] text-foreground"
          />
        </Field>
      </Section>
    </View>
  );
}

/**
 * One box per number, with a remove button each and "Add number".
 * ⚠️ Messages links threads to contacts by these numbers, so never squash
 * them into one box. Saving would drop the others.
 */
function PhoneList({
  phones,
  onChange,
}: {
  phones: string[];
  onChange: (next: string[]) => void;
}) {
  const update = (i: number, text: string) =>
    onChange(phones.map((p, j) => (j === i ? text : p)));
  const remove = (i: number) => {
    const next = phones.filter((_, j) => j !== i);
    onChange(next.length ? next : [""]);
  };

  return (
    <View className="gap-2">
      {phones.map((phone, i) => (
        <View key={i} className="flex-row items-center gap-2">
          <TextInput
            value={phone}
            onChangeText={(t) => update(i, t)}
            placeholder="+61 400 000 000"
            placeholderTextColor="#A1A1AA"
            selectionColor="#FF8900"
            keyboardType="phone-pad"
            className={`flex-1 ${INPUT_CLASS}`}
          />
          {phones.length > 1 || phone.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${phone.trim() || "number"}`}
              onPress={() => remove(i)}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <X size={16} color="#71717A" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange([...phones, ""])}
        hitSlop={6}
        className="flex-row items-center gap-1 self-start py-1 active:opacity-70"
      >
        <Plus size={14} color="#AD5100" strokeWidth={2.4} />
        <Text className="font-sans-medium text-[13px] text-primary-strong">Add number</Text>
      </Pressable>
    </View>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;
const tagColor = (c: string) => (HEX.test(c) ? c : "#71717A");

/**
 * Pick the contact's tags from the user's own, or make a new one.
 * Same colours as TagBadges; a selected tag is filled.
 */
function TagPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const tags = useTags();
  const create = useCreateTag();
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);

  const add = async () => {
    const name = draft.trim();
    if (!name || create.isPending) return;
    setError(null);
    // The server 409s on a duplicate name, so reuse an existing tag instead.
    const existing = tags.data?.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selected.includes(existing.id)) onChange([...selected, existing.id]);
      setDraft("");
      return;
    }
    try {
      const tag = await create.mutateAsync({ name });
      onChange([...selected, tag.id]);
      setDraft("");
    } catch (err) {
      setError(describeError(err));
    }
  };

  const disabled = !draft.trim() || create.isPending;

  return (
    <View className="gap-3">
      {tags.isPending ? (
        <ActivityIndicator size="small" color="#FF8900" style={{ alignSelf: "flex-start" }} />
      ) : tags.isError ? (
        <Pressable onPress={() => void tags.refetch()} className="active:opacity-70">
          <Text className="font-sans text-[13px] text-destructive">
            Couldn&apos;t load your tags. Tap to retry.
          </Text>
        </Pressable>
      ) : tags.data.length === 0 ? (
        <Text className="font-sans text-[13px] text-muted-foreground">
          No tags yet. Make your first one below.
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {tags.data.map((tag) => {
            const on = selected.includes(tag.id);
            const color = tagColor(tag.color);
            return (
              <Pressable
                key={tag.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={tag.name}
                onPress={() => toggle(tag.id)}
                className="active:opacity-70"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  backgroundColor: on ? color : `${color}14`,
                  borderColor: on ? color : `${color}40`,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: on ? "#FFFFFF" : color,
                  }}
                />
                <Text
                  className="font-sans-medium text-[13px]"
                  style={{ color: on ? "#FFFFFF" : color }}
                >
                  {tag.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View className="flex-row items-center gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void add()}
          placeholder="New tag"
          placeholderTextColor="#A1A1AA"
          selectionColor="#FF8900"
          returnKeyType="done"
          className={`flex-1 ${INPUT_CLASS}`}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add tag"
          onPress={() => void add()}
          disabled={disabled}
          className="h-11 flex-row items-center justify-center gap-1 rounded-xl border border-border px-3.5 active:opacity-70"
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          {create.isPending ? (
            <ActivityIndicator size="small" color="#AD5100" />
          ) : (
            <Plus size={14} color="#AD5100" strokeWidth={2.4} />
          )}
          <Text className="font-sans-medium text-[13px] text-primary-strong">Add</Text>
        </Pressable>
      </View>
      {error ? <Text className="font-sans text-[13px] text-destructive">{error}</Text> : null}
    </View>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        {hint ? (
          <Text className="font-sans text-[13px] leading-[18px] text-muted-foreground">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
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
