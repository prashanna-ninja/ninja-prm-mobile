import { LinearGradient } from "expo-linear-gradient";
import { Image, Text, View } from "react-native";

import { AUTH } from "@/components/login/auth-palette";
import { FadeIn } from "@/components/login/fade-in";

/**
 * The brand-orange hero above the sign-in sheet.
 *
 * A gradient rather than a flat fill — barely perceptible, but it stops the
 * block reading as a plain rectangle and gives the white sheet something with
 * depth to sit against.
 */
export function AuthHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <LinearGradient
      colors={[AUTH.heroTop, AUTH.heroBottom]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      // paddingTop sits on top of the safe-area inset the screen already
      // applies, so the logo clears the status bar with room to breathe.
      style={{ paddingHorizontal: 26, paddingTop: 28, paddingBottom: 44 }}
    >
      <FadeIn delay={40}>
        <Image
          source={require("@/assets/images/logo.png")}
          // The wordmark is white with a transparent ground, so it needs the
          // saturated hero behind it. Kept deliberately modest — it's a sign-in
          // screen, not a splash. Resized from the 16612px original; see
          // docs/02 §7.
          style={{ width: 104, height: 67, resizeMode: "contain" }}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Ninja PRM"
        />
      </FadeIn>

      <FadeIn delay={110}>
        <View style={{ gap: 8, marginTop: 16 }}>
          <Text
            style={{
              fontFamily: "Bricolage_700Bold",
              fontSize: 31,
              lineHeight: 36,
              letterSpacing: -0.8,
              color: AUTH.heroText,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: "Bricolage_400Regular",
              fontSize: 14.5,
              lineHeight: 22,
              color: AUTH.heroMuted,
            }}
          >
            {subtitle}
          </Text>
        </View>
      </FadeIn>
    </LinearGradient>
  );
}
