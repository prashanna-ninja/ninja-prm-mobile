import { Text, View } from "react-native";

import type { Tag } from "@/types/contact.types";

/**
 * A contact's tags — the user's own labels, each with its own colour.
 *
 * Mirrors the web's `components/tags/tag-badges.tsx`: tinted fill, faint
 * border and text in the tag's colour, with a dot. Alpha is applied to the
 * literal hex (#RRGGBBAA), which RN supports — not to a themed token, which
 * NativeWind can't (CLAUDE.md gotcha 4).
 *
 * The colour is user-entered on the web (default #3b82f6), so anything that
 * isn't a 6-digit hex falls back to neutral grey rather than rendering nothing.
 */
const HEX = /^#[0-9a-f]{6}$/i;
const FALLBACK = "#71717A";

export function TagBadges({
  tags,
  max = 3,
  size = "sm",
}: {
  tags: Tag[] | undefined;
  max?: number;
  size?: "sm" | "md";
}) {
  if (!tags?.length) return null;

  const visible = tags.slice(0, max);
  const remaining = tags.length - visible.length;
  const sm = size === "sm";

  return (
    <View className="flex-row flex-wrap gap-1">
      {visible.map((tag) => {
        const color = HEX.test(tag.color) ? tag.color : FALLBACK;
        return (
          <View
            key={tag.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: sm ? 4 : 5,
              backgroundColor: `${color}18`,
              borderColor: `${color}40`,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: sm ? 6 : 8,
              paddingVertical: sm ? 1 : 2,
            }}
          >
            <View
              style={{
                width: sm ? 5 : 6,
                height: sm ? 5 : 6,
                borderRadius: 999,
                backgroundColor: color,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Bricolage_500Medium",
                fontSize: sm ? 11 : 12,
                color,
                maxWidth: 140,
              }}
            >
              {tag.name}
            </Text>
          </View>
        );
      })}
      {remaining > 0 ? (
        <View
          className="rounded-full border border-border"
          style={{ paddingHorizontal: sm ? 6 : 8, paddingVertical: sm ? 1 : 2 }}
        >
          <Text
            className="text-muted-foreground"
            style={{ fontFamily: "Bricolage_400Regular", fontSize: sm ? 11 : 12 }}
          >
            +{remaining}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
