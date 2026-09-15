import Constants from "expo-constants";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { Screen } from "@/components/screen";
import { Moon, Sun } from "@/lib/icons";
import { initialsFromName } from "@/lib/format";
import { useSession } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";

export default function SettingsScreen() {
  const { data: session, signOut } = useSession();
  const { theme, toggleTheme } = useTheme();

  const user = session?.user;
  const version = Constants.expoConfig?.version ?? "—";

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You'll need a new sign-in link to get back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-4 pb-10 gap-6">
        {/* No back button — Settings is a tab, not a pushed screen. */}
        <AppHeader title="Settings" />

        <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <Text className="font-sans-semibold text-base text-primary-strong">
              {initialsFromName(user?.name ?? user?.email)}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="font-sans-medium text-[15px] text-card-foreground"
            >
              {user?.name || "Signed in"}
            </Text>
            <Text numberOfLines={1} className="font-sans text-sm text-muted-foreground">
              {user?.email ?? "—"}
            </Text>
          </View>
        </View>

        <Section title="Appearance">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onPress={toggleTheme}
            className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5 active:opacity-70"
          >
            <Text className="font-sans text-[15px] text-card-foreground">Theme</Text>
            <View className="flex-row items-center gap-2">
              <Text className="font-sans-medium text-sm capitalize text-muted-foreground">
                {theme}
              </Text>
              {theme === "dark" ? (
                <Moon size={16} color="#A1A1AA" strokeWidth={2} />
              ) : (
                <Sun size={16} color="#71717A" strokeWidth={2} />
              )}
            </View>
          </Pressable>
        </Section>

        <Section title="Account">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={confirmSignOut}
            className="items-center rounded-lg border border-border bg-card px-4 py-3.5 active:opacity-70"
          >
            <Text className="font-sans-medium text-[15px] text-destructive">
              Sign out
            </Text>
          </Pressable>
        </Section>

        <Text className="text-center font-sans text-xs text-muted-foreground">
          Ninja PRM {version}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Section({
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
      {children}
    </View>
  );
}
