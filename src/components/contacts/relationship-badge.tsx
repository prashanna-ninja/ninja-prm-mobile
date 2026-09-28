import { Text, View } from "react-native";

import {
  RELATIONSHIP_LABELS,
  type RelationshipType,
} from "@/types/contact.types";

/**
 * The relationship pill.
 *
 * Distinct colours per type, matching the web's coloured badges — with one
 * contact per row, the type is the fastest thing to scan for, and eight
 * identical grey pills would defeat that.
 */
const STYLES: Record<RelationshipType, { bg: string; fg: string }> = {
  FRIEND: { bg: "#DBEAFE", fg: "#1E40AF" },
  FAMILY: { bg: "#FCE7F3", fg: "#9D174D" },
  CLIENT: { bg: "#DCFCE7", fg: "#166534" },
  LEAD: { bg: "#FFF2E0", fg: "#AD5100" },
  VENDOR: { bg: "#EDE9FE", fg: "#5B21B6" },
  COLLABORATOR: { bg: "#CCFBF1", fg: "#115E59" },
  COLLEAGUE: { bg: "#E0E7FF", fg: "#3730A3" },
  OTHER: { bg: "#F4F4F5", fg: "#52525B" },
};

export function RelationshipBadge({
  type,
  size = "md",
}: {
  type: RelationshipType;
  size?: "sm" | "md";
}) {
  // Unknown values shouldn't crash the row — the API could add a type.
  const style = STYLES[type] ?? STYLES.OTHER;
  const label = RELATIONSHIP_LABELS[type] ?? type;

  return (
    <View
      style={{
        backgroundColor: style.bg,
        borderRadius: 999,
        paddingHorizontal: size === "sm" ? 7 : 9,
        paddingVertical: size === "sm" ? 2 : 3,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontFamily: "Bricolage_500Medium",
          fontSize: size === "sm" ? 11 : 12,
          color: style.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
