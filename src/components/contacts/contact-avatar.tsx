import { Image, Text, View } from "react-native";

import { initialsFromName } from "@/lib/format";

/**
 * Initials on a tinted disc, or the photo when there is one.
 *
 * The tint is derived from the name so the same person keeps the same colour
 * everywhere — a list of grey circles is much harder to scan.
 */
const TINTS = [
  { bg: "#FFF2E0", fg: "#AD5100" },
  { bg: "#E0F2FE", fg: "#075985" },
  { bg: "#DCFCE7", fg: "#166534" },
  { bg: "#FAE8FF", fg: "#86198F" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#E0E7FF", fg: "#3730A3" },
];

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length]!;
}

export function ContactAvatar({
  name,
  image,
  size = 40,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const tint = tintFor(name || "?");

  if (image) {
    return (
      <Image
        source={{ uri: image }}
        accessibilityLabel={name}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tint.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Bricolage_600SemiBold",
          fontSize: size * 0.36,
          color: tint.fg,
        }}
      >
        {initialsFromName(name)}
      </Text>
    </View>
  );
}
