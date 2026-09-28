import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/app-header";
import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { RelationshipBadge } from "@/components/contacts/relationship-badge";
import { Screen } from "@/components/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, describeError } from "@/components/ui/states";
import {
  useArchiveContact,
  useContact,
  useDeleteContact,
} from "@/api/contacts.api";
import { formatDateCompact } from "@/lib/format";
import {
  Archive,
  ArrowLeft,
  Building,
  CalendarDays,
  CircleCheck,
  Heart,
  Mail,
  MapPin,
  Phone,
  Trash,
} from "@/lib/icons";
import { parseStringList } from "@/types/contact.types";

export default function ContactDetailScreen() {
  const router = useRouter();
  const { id = "" } = useLocalSearchParams<{ id?: string }>();

  const query = useContact(id);
  const archive = useArchiveContact();
  const remove = useDeleteContact();

  const goBack = () => router.replace("/contacts");
  const data = query.data;

  const onToggleArchive = async () => {
    if (!data) return;
    try {
      await archive.mutateAsync({ id, archived: !data.archived });
      void query.refetch();
    } catch (err) {
      Alert.alert("Couldn't update contact", describeError(err));
    }
  };

  const onDelete = () => {
    // The API hard-deletes — there is no undo, so make that explicit.
    Alert.alert(
      "Delete this contact?",
      "This permanently removes the contact and can't be undone. Archiving hides them instead.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await remove.mutateAsync(id);
              goBack();
            } catch (err) {
              Alert.alert("Couldn't delete contact", describeError(err));
            }
          },
        },
      ],
    );
  };

  const likes = parseStringList(data?.likes);
  const dislikes = parseStringList(data?.dislikes);
  const openTasks = (data?.tasks ?? []).filter((t) => t.status === "OPEN");

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
          title={data?.name ?? "Contact"}
          titleLines={2}
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to contacts"
              onPress={goBack}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <ArrowLeft size={18} color="#52525B" strokeWidth={2} />
            </Pressable>
          }
        />

        {query.isPending ? (
          <View className="gap-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !data ? (
          <EmptyState
            title="Contact not found"
            action={{ label: "Back to contacts", onPress: goBack }}
          />
        ) : (
          <>
            <View className="flex-row items-center gap-3">
              <ContactAvatar name={data.name} image={data.image} size={56} />
              <View className="min-w-0 flex-1 gap-1.5">
                <RelationshipBadge type={data.relationshipType} />
                {data.archived ? (
                  <Text className="font-sans text-xs text-muted-foreground">
                    Archived
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Tapping a phone or email should DO the thing — that's most of
                why you open a contact on a phone at all. */}
            <View className="gap-2">
              {data.phone ? (
                <ContactAction
                  icon={<Phone size={16} color="#AD5100" strokeWidth={2} />}
                  label={data.phone}
                  onPress={() => Linking.openURL(`tel:${data.phone}`)}
                />
              ) : null}
              {data.email ? (
                <ContactAction
                  icon={<Mail size={16} color="#AD5100" strokeWidth={2} />}
                  label={data.email}
                  onPress={() => Linking.openURL(`mailto:${data.email}`)}
                />
              ) : null}
              {data.location ? (
                <ContactAction
                  icon={<MapPin size={16} color="#71717A" strokeWidth={2} />}
                  label={data.location}
                />
              ) : null}
              {data.company?.name ? (
                <ContactAction
                  icon={<Building size={16} color="#71717A" strokeWidth={2} />}
                  label={data.company.name}
                />
              ) : null}
              {data.dateOfBirth ? (
                <ContactAction
                  icon={<CalendarDays size={16} color="#71717A" strokeWidth={2} />}
                  label={formatDateCompact(data.dateOfBirth)}
                />
              ) : null}
            </View>

            {data.about ? (
              <Block title="About">
                <Text className="font-sans text-sm leading-[21px] text-card-foreground">
                  {data.about}
                </Text>
              </Block>
            ) : null}

            {likes.length > 0 || dislikes.length > 0 ? (
              <Block title="Preferences">
                {likes.length > 0 ? (
                  <PreferenceRow label="Likes" items={likes} tint="#FFF2E0" fg="#AD5100" />
                ) : null}
                {dislikes.length > 0 ? (
                  <PreferenceRow label="Dislikes" items={dislikes} tint="#FFE4E6" fg="#9F1239" />
                ) : null}
              </Block>
            ) : null}

            {openTasks.length > 0 ? (
              <Block title={`Open tasks (${openTasks.length})`}>
                {openTasks.map((task) => (
                  <View key={task.id} className="flex-row items-start gap-2.5">
                    <CircleCheck
                      size={15}
                      color="#A1A1AA"
                      strokeWidth={2}
                      style={{ marginTop: 2 }}
                    />
                    <View className="min-w-0 flex-1">
                      <Text className="font-sans text-sm text-card-foreground">
                        {task.title}
                      </Text>
                      {task.dueAt ? (
                        <Text className="font-sans text-xs text-muted-foreground">
                          Due {formatDateCompact(task.dueAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Block>
            ) : null}

            {data.interactions && data.interactions.length > 0 ? (
              <Block title="Recent activity">
                {data.interactions.slice(0, 5).map((i) => (
                  <View key={i.id} className="gap-0.5">
                    <Text className="font-sans-medium text-[13px] text-card-foreground">
                      {i.type}
                    </Text>
                    <Text className="font-sans text-xs text-muted-foreground">
                      {formatDateCompact(i.occurredAt)}
                      {i.summary ? ` · ${i.summary}` : ""}
                    </Text>
                  </View>
                ))}
              </Block>
            ) : null}

            <View className="flex-row gap-2 pt-1">
              <DangerButton
                icon={<Archive size={16} color="#52525B" strokeWidth={2} />}
                label={data.archived ? "Unarchive" : "Archive"}
                onPress={onToggleArchive}
                disabled={archive.isPending || remove.isPending}
              />
              <DangerButton
                icon={<Trash size={16} color="#DC2626" strokeWidth={2} />}
                label="Delete"
                tone="destructive"
                onPress={onDelete}
                disabled={archive.isPending || remove.isPending}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ContactAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
}) {
  const interactive = !!onPress;
  return (
    <Pressable
      accessibilityRole={interactive ? "button" : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!interactive}
      className={`flex-row items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 ${
        interactive ? "active:opacity-70" : ""
      }`}
    >
      {icon}
      <Text
        numberOfLines={1}
        className={`min-w-0 flex-1 font-sans text-sm ${
          interactive ? "text-primary-strong" : "text-card-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PreferenceRow({
  label,
  items,
  tint,
  fg,
}: {
  label: string;
  items: string[];
  tint: string;
  fg: string;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Heart size={12} color={fg} strokeWidth={2.2} />
        <Text className="font-sans-medium text-xs" style={{ color: fg }}>
          {label}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {items.map((item, i) => (
          <View
            key={`${item}-${i}`}
            style={{ backgroundColor: tint }}
            className="rounded-full px-2.5 py-1"
          >
            <Text style={{ color: fg }} className="font-sans text-xs">
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DangerButton({
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

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
