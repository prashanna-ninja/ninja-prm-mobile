import { useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import {
  ContactForm,
  EMPTY_CONTACT_FORM,
  toCreateInput,
  type ContactFormValues,
} from "@/components/contacts/contact-form";
import { Screen } from "@/components/screen";
import { describeError } from "@/components/ui/states";
import { useCreateContact } from "@/api/contacts.api";
import { ArrowLeft } from "@/lib/icons";

export default function NewContactScreen() {
  const router = useRouter();
  const create = useCreateContact();
  const [values, setValues] = React.useState<ContactFormValues>(EMPTY_CONTACT_FORM);

  const canSave = values.name.trim().length > 0 && !create.isPending;

  const onSave = async () => {
    if (!canSave) return;
    try {
      const contact = await create.mutateAsync(toCreateInput(values));
      // replace, not push — backing out of a new contact should land on the
      // list, not on the empty form you just submitted.
      router.replace({ pathname: "/contacts/[id]", params: { id: contact.id } });
    } catch (err) {
      Alert.alert("Couldn't save contact", describeError(err));
    }
  };

  const onCancel = () => {
    const dirty =
      JSON.stringify(values) !== JSON.stringify(EMPTY_CONTACT_FORM);
    if (!dirty) return router.back();

    Alert.alert("Discard this contact?", "Your changes won't be saved.", [
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
          title="New contact"
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

        <ContactForm values={values} onChange={setValues} />

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
              {create.isPending ? "Saving…" : "Add contact"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
