import * as React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { ChipInput } from "@/components/contacts/chip-input";
import {
  RELATIONSHIP_LABELS,
  RELATIONSHIP_TYPES,
  type CreateContactInput,
  type RelationshipType,
} from "@/types/contact.types";

export type ContactFormValues = {
  name: string;
  relationshipType: RelationshipType;
  email: string;
  phone: string;
  location: string;
  about: string;
  likes: string[];
  dislikes: string[];
};

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  relationshipType: "FRIEND",
  email: "",
  phone: "",
  location: "",
  about: "",
  likes: [],
  dislikes: [],
};

/** Only send fields the user actually filled — PATCH treats "" as null. */
export function toCreateInput(v: ContactFormValues): CreateContactInput {
  const input: CreateContactInput = {
    name: v.name.trim(),
    relationshipType: v.relationshipType,
  };
  if (v.email.trim()) input.email = v.email.trim();
  if (v.phone.trim()) input.phone = v.phone.trim();
  if (v.location.trim()) input.location = v.location.trim();
  if (v.about.trim()) input.about = v.about.trim();
  if (v.likes.length) input.likes = v.likes;
  if (v.dislikes.length) input.dislikes = v.dislikes;
  return input;
}

/**
 * Create/edit fields for a contact.
 *
 * A trimmed-down version of the web form. Deliberately omitted for now:
 * profile photo upload, multiple phone numbers, important dates, notes
 * categories and company linking — each needs its own endpoint or picker, and
 * none of them is what you reach for when adding someone from a phone.
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
            className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
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
            className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
          />
        </Field>

        <Field label="Phone">
          <TextInput
            value={values.phone}
            onChangeText={(t) => set("phone", t)}
            placeholder="+61 400 000 000"
            placeholderTextColor="#A1A1AA"
            selectionColor="#FF8900"
            keyboardType="phone-pad"
            className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
          />
        </Field>

        <Field label="Location">
          <TextInput
            value={values.location}
            onChangeText={(t) => set("location", t)}
            placeholder="City, Country"
            placeholderTextColor="#A1A1AA"
            selectionColor="#FF8900"
            className="rounded-xl border border-input bg-card px-3.5 py-3 font-sans text-[15px] text-foreground"
          />
        </Field>
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
