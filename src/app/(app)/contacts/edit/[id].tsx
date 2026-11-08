import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import {
  ContactForm,
  contactToForm,
  toUpdateInput,
  type ContactFormValues,
} from "@/components/contacts/contact-form";
import { Screen } from "@/components/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, describeError } from "@/components/ui/states";
import { useContact, useUpdateContact } from "@/api/contacts.api";
import { ArrowLeft } from "@/lib/icons";

/**
 * Edit a contact. Same form as "New contact", filled from GET /contacts/:id.
 * Saves with PATCH, sending only the fields that changed (`toUpdateInput`).
 */
export default function EditContactScreen() {
  const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const query = useContact(id);
  const update = useUpdateContact(id);

  // Snapshot the contact ONCE. A background refetch mustn't wipe what
  // you're typing, and the diff is always against what you started from.
  const [initial, setInitial] = React.useState<ContactFormValues | null>(null);
  const [values, setValues] = React.useState<ContactFormValues | null>(null);
  // Start once nothing is loading. A cached copy within the 30s staleTime
  // won't refetch, so use it. A stale one refetches on mount, so wait for
  // that, rather than diff against old data.
  // ⚠️ Don't wait for `isFetchedAfterMount`: coming from the detail screen
  // the copy is fresh, no fetch ever runs, and the form shimmers forever
  // (2026-11-08 bug).
  React.useEffect(() => {
    if (query.data && !query.isFetching && !initial) {
      const v = contactToForm(query.data);
      setInitial(v);
      setValues(v);
    }
  }, [query.data, query.isFetching, initial]);

  const changes = initial && values ? toUpdateInput(initial, values) : {};
  const dirty = Object.keys(changes).length > 0;
  const canSave = !!values && values.name.trim().length > 0 && dirty && !update.isPending;

  const onSave = async () => {
    if (!canSave) return;
    try {
      await update.mutateAsync(changes);
      router.back();
    } catch (err) {
      Alert.alert("Couldn't save changes", describeError(err));
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
    <Screen>
      <ScrollView
        contentContainerClassName="px-4 pb-10 gap-6"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <AppHeader
          title="Edit contact"
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

        {values ? (
          <>
            <ContactForm values={values} onChange={setValues} />

            <View className="flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                disabled={update.isPending}
                className="h-12 flex-1 items-center justify-center rounded-xl border border-border active:opacity-70"
              >
                <Text className="font-sans-medium text-[15px] text-foreground">Cancel</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave, busy: update.isPending }}
                onPress={onSave}
                disabled={!canSave}
                className="h-12 flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
                style={{ opacity: canSave ? 1 : 0.5 }}
              >
                {update.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text className="font-sans-semibold text-[15px] text-primary-foreground">
                  {update.isPending ? "Saving…" : "Save changes"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <View className="gap-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
