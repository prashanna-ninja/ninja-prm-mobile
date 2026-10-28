import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { RelationshipBadge } from "@/components/contacts/relationship-badge";
import { TagBadges } from "@/components/contacts/tag-badges";
import { Building } from "@/lib/icons";
import type { ContactListItem } from "@/types/contact.types";

export function ContactRow({ contact }: { contact: ContactListItem }) {
  const router = useRouter();

  // Email is the more useful identifier when both exist; fall back to phone.
  const subtitle = contact.email || contact.phone;
  const activity =
    contact._count.interactions + contact._count.taskContacts > 0
      ? [
          contact._count.interactions > 0
            ? `${contact._count.interactions} interaction${contact._count.interactions === 1 ? "" : "s"}`
            : null,
          contact._count.taskContacts > 0
            ? `${contact._count.taskContacts} task${contact._count.taskContacts === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={contact.name}
      onPress={() =>
        router.push({
          pathname: "/contacts/[id]",
          params: { id: contact.id },
        })
      }
      className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-3 active:opacity-70"
    >
      <ContactAvatar name={contact.name} image={contact.image} />

      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 font-sans-medium text-[15px] text-card-foreground"
          >
            {contact.name}
          </Text>
          <RelationshipBadge type={contact.relationshipType} size="sm" />
        </View>

        {subtitle ? (
          <Text
            numberOfLines={1}
            className="font-sans text-[13px] text-muted-foreground"
          >
            {subtitle}
          </Text>
        ) : null}

        <TagBadges tags={contact.tags} />

        {contact.company?.name || activity ? (
          <View className="flex-row items-center gap-2">
            {contact.company?.name ? (
              <View className="flex-row items-center gap-1">
                <Building size={11} color="#A1A1AA" strokeWidth={2} />
                <Text
                  numberOfLines={1}
                  className="font-sans text-xs text-muted-foreground"
                >
                  {contact.company.name}
                </Text>
              </View>
            ) : null}
            {activity ? (
              <Text className="font-sans text-xs text-muted-foreground">
                {activity}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
