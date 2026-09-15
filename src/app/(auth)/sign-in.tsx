import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthHero } from "@/components/login/auth-hero";
import { AUTH } from "@/components/login/auth-palette";
import { FadeIn } from "@/components/login/fade-in";
import { useLoginForm } from "@/components/login/login-form";

/**
 * Magic-link sign-in. Thin route: brand-orange hero up top, white sheet
 * overlapping its bottom edge.
 *
 * A ScrollView (rather than KeyboardAvoidingView) carries the content, on
 * purpose: under Android edge-to-edge the window no longer resizes when the
 * keyboard opens, so KeyboardAvoidingView computes zero padding and the layout
 * ends up behind the keyboard. Letting a scroll view own the overflow sidesteps
 * that entirely. See CLAUDE.md's gotcha list.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { heroTitle, heroSubtitle, sheet } = useLoginForm();

  return (
    <View style={{ flex: 1, backgroundColor: AUTH.heroTop }}>
      {/* Light glyphs: the hero behind the status bar is saturated orange. */}
      <StatusBar style="light" />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, backgroundColor: AUTH.sheet }}
      >
        <View style={{ paddingTop: insets.top }}>
          <AuthHero title={heroTitle} subtitle={heroSubtitle} />
        </View>

        {/* The sheet pulls up over the hero's bottom edge — that overlap is
            what ties the two zones together without needing a shadow. */}
        <View
          style={{
            flex: 1,
            backgroundColor: AUTH.sheet,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -24,
            paddingHorizontal: 26,
            paddingTop: 30,
            paddingBottom: insets.bottom + 20,
          }}
        >
          {sheet}

          {/* marginTop:auto pushes the footer to the bottom of whatever space
              is left. A sibling flex:1 would fight the sheet's own flex:1 and
              open a huge gap instead. */}
          <FadeIn delay={320} style={{ marginTop: "auto", paddingTop: 28 }}>
            <Text
              style={{
                fontFamily: "Bricolage_400Regular",
                fontSize: 12.5,
                lineHeight: 18,
                color: AUTH.muted,
                textAlign: "center",
              }}
            >
              Invite-only access. Contact your administrator if you can't sign in.
            </Text>
          </FadeIn>
        </View>
      </ScrollView>
    </View>
  );
}
