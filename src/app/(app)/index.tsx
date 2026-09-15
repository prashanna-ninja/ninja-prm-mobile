import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSession } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";

/**
 * TEMPORARY — Phase 1 verification screen.
 *
 * Proves the design system is wired end to end: tokens resolve, all four font
 * weights render, and the light/dark toggle drives NativeWind. Now also the
 * landing spot after a successful sign-in, so it carries Sign out until the
 * real Settings screen exists.
 *
 * Delete this in Phase 5 when the real Home screen lands.
 */
export default function DesignSystemCheck() {
  const { theme, toggleTheme } = useTheme();
  // Read the shared session — never authClient.useSession() directly.
  const { data: session, signOut } = useSession();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView contentContainerClassName="px-4 pb-10 gap-6">
        <View className="gap-1 pt-2">
          <Text
            className="font-display text-[30px] text-foreground"
            style={{ letterSpacing: -0.5 }}
          >
            Ninja PRM
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            Phase 1 — design system check
          </Text>
        </View>

        <Section title="Type scale">
          <Text className="font-display text-[30px] text-foreground">
            Display 700
          </Text>
          <Text className="font-sans-semibold text-base text-foreground">
            Semibold 600 — section title
          </Text>
          <Text className="font-sans-medium text-[15px] text-foreground">
            Medium 500 — card title
          </Text>
          <Text className="font-sans text-sm text-foreground">
            Regular 400 — body copy sits here.
          </Text>
          <Text className="font-sans text-xs text-muted-foreground">
            Regular 400 — muted meta line
          </Text>
        </Section>

        <Section title="Brand">
          <View className="flex-row flex-wrap gap-2">
            <Swatch className="bg-primary" label="primary" onDark />
            <Swatch className="bg-primary-soft" label="soft" />
            <Swatch className="bg-secondary" label="secondary" />
            <Swatch className="bg-muted" label="muted" />
            <Swatch className="bg-destructive" label="destructive" onDark />
          </View>
          <Text className="font-sans text-sm text-primary-strong">
            primary-strong — the only orange that is legible as text.
          </Text>
        </Section>

        <Section title="Surfaces">
          <View className="rounded-lg border border-border bg-card p-4 gap-1">
            <Text className="font-sans-medium text-[15px] text-card-foreground">
              Card
            </Text>
            <Text className="font-sans text-sm text-muted-foreground">
              Border carries the hierarchy — no drop shadows anywhere.
            </Text>
          </View>

          <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
            <View className="h-10 w-10 items-center justify-center rounded-md bg-primary-soft">
              <Text className="font-sans-semibold text-primary">NP</Text>
            </View>
            <View className="flex-1">
              <Text className="font-sans-medium text-[15px] text-card-foreground">
                Source tile
              </Text>
              <Text className="font-sans text-xs text-muted-foreground">
                40×40, primary-soft, icon in primary
              </Text>
            </View>
          </View>
        </Section>

        <Section title="Session">
          <View className="rounded-lg border border-border bg-card p-4 gap-1">
            <Text className="font-sans-medium text-[15px] text-card-foreground">
              {session?.user?.name || "Signed in"}
            </Text>
            <Text className="font-sans text-sm text-muted-foreground">
              {session?.user?.email ?? "—"}
            </Text>
          </View>
        </Section>

        <Section title="Theme">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onPress={toggleTheme}
            className="h-11 items-center justify-center rounded-lg bg-primary active:opacity-70"
          >
            <Text className="font-sans-semibold text-primary-foreground">
              Current: {theme} — tap to toggle
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={() => {
              void signOut();
            }}
            className="h-11 items-center justify-center rounded-lg border border-border active:opacity-70"
          >
            <Text className="font-sans-semibold text-foreground">Sign out</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </SafeAreaView>
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
    <View className="gap-3">
      <Text className="font-sans-semibold text-xs uppercase text-muted-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Swatch({
  className,
  label,
  onDark,
}: {
  className: string;
  label: string;
  onDark?: boolean;
}) {
  return (
    <View
      className={`h-16 w-[72px] items-center justify-end rounded-md border border-border p-1 ${className}`}
    >
      <Text
        className={`font-sans text-[10px] ${onDark ? "text-white" : "text-foreground"}`}
      >
        {label}
      </Text>
    </View>
  );
}
