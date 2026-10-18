import { View } from "react-native";

import { ContactAvatar } from "@/components/contacts/contact-avatar";
import { UserRound } from "@/lib/icons";
import type { SmsThread } from "@/types/sms.types";

/**
 * A contact gets their avatar; an unknown number or sender name gets a plain
 * person glyph — the same split the web inbox draws, so "is this someone I
 * know?" reads at a glance.
 */
export function ThreadAvatar({
  contact,
  size = 44,
}: {
  contact: SmsThread["contact"];
  size?: number;
}) {
  if (contact) {
    return <ContactAvatar name={contact.name} image={contact.image} size={size} />;
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-muted"
      style={{ width: size, height: size }}
    >
      <UserRound size={size * 0.42} color="#A1A1AA" strokeWidth={1.8} />
    </View>
  );
}
