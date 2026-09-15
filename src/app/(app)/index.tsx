import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { LibraryCard } from "@/components/dashboard/library-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { RecordingRow } from "@/components/recordings/recording-row";
import { Screen } from "@/components/screen";
import { RecordingRowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useRecordings, useRecordingStats } from "@/api/recordings.api";
import { ChevronRight, Library, Moon, Sun } from "@/lib/icons";
import { percentChange, pluralize } from "@/lib/format";
import { useSession } from "@/providers/session-provider";
import { useTheme } from "@/providers/theme-provider";

const RECENT_COUNT = 5;

export default function HomeScreen() {
  const router = useRouter();
  const { data: session } = useSession();

  // Two INDEPENDENT queries on purpose: if stats fail, the recent list should
  // still render, and vice versa. One combined hook would blank the whole
  // screen on a single failure.
  const stats = useRecordingStats();
  const recent = useRecordings({ pageSize: RECENT_COUNT });

  const refreshing = stats.isRefetching || recent.isRefetching;
  const onRefresh = () => {
    void Promise.all([stats.refetch(), recent.refetch()]);
  };

  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const isEmpty =
    stats.data?.total === 0 && (recent.data?.items.length ?? 0) === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-4 pb-8 gap-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF8900"
            colors={["#FF8900"]}
          />
        }
      >
        <AppHeader
          title={greeting(firstName)}
          titleLines={2}
          subtitle="Everything you've captured, in one place."
          right={<ThemeToggle />}
        />

        {/* A wall of zeroes is a worse first impression than one honest empty
            state, so when there's genuinely nothing we skip the stats. */}
        {isEmpty ? (
          <EmptyState
            icon={<Library size={34} color="#D4D4D8" strokeWidth={1.6} />}
            title="No recordings yet"
            message="Calls, Plaud recordings, Granola meetings and Fieldy conversations will appear here once they sync."
          />
        ) : (
          <>
            <StatsBlock stats={stats} onOpen={() => router.push("/recordings")} />
            <RecentBlock recent={recent} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function StatsBlock({
  stats,
  onOpen,
}: {
  stats: ReturnType<typeof useRecordingStats>;
  onOpen: () => void;
}) {
  if (stats.isPending) {
    return (
      <View className="gap-3">
        <View className="flex-row gap-3">
          <Skeleton className="h-[92px] flex-1 rounded-lg" />
          <Skeleton className="h-[92px] flex-1 rounded-lg" />
        </View>
        <Skeleton className="h-[220px] rounded-lg" />
      </View>
    );
  }

  if (stats.isError || !stats.data) {
    return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  }

  const data = stats.data;
  const trend = percentChange(data.thisWeek, data.lastWeek);

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <StatCard
          label="This week"
          value={data.thisWeek}
          trend={trend}
          trendLabel="vs last week"
          hint={data.lastWeek === 0 ? "First week of data" : undefined}
          onPress={onOpen}
        />
        <StatCard
          label="Needs a contact"
          value={data.unassigned}
          accent={data.unassigned > 0}
          hint={data.unassigned === 0 ? "All linked up" : "Not linked to anyone"}
          onPress={onOpen}
        />
      </View>

      <LibraryCard stats={data} />
    </View>
  );
}

function RecentBlock({ recent }: { recent: ReturnType<typeof useRecordings> }) {
  const router = useRouter();

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-xs uppercase tracking-wide text-muted-foreground">
          Recent
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all recordings"
          onPress={() => router.push("/recordings")}
          hitSlop={8}
          className="flex-row items-center gap-0.5 active:opacity-70"
        >
          <Text className="font-sans-medium text-sm text-primary-strong">
            View all
          </Text>
          <ChevronRight size={15} color="#AD5100" strokeWidth={2.2} />
        </Pressable>
      </View>

      {recent.isPending ? (
        <RecordingRowSkeleton count={3} />
      ) : recent.isError ? (
        <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
      ) : recent.data && recent.data.items.length > 0 ? (
        <>
          <View className="gap-3">
            {recent.data.items.map((item) => (
              <RecordingRow key={`${item.source}-${item.id}`} item={item} compact />
            ))}
          </View>
          {recent.data.totalCount > RECENT_COUNT ? (
            <Text className="pt-0.5 text-center font-sans text-xs text-muted-foreground">
              Showing {RECENT_COUNT} of {pluralize(recent.data.totalCount, "recording")}
            </Text>
          ) : null}
        </>
      ) : (
        <EmptyState title="Nothing recent" message="New recordings will show up here." />
      )}
    </View>
  );
}

/**
 * Time-of-day greeting, broken over two lines so the NAME gets its own line
 * at display size rather than trailing off the end of a long salutation.
 * Uses the device clock, which is the user's own.
 */
function greeting(firstName?: string) {
  const hour = new Date().getHours();
  const part =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return firstName ? `${part},\n${firstName}` : part;
}

/** Light/dark switch. Lives here because Home is where you land. */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isDark ? "light" : "dark"} mode`}
      onPress={toggleTheme}
      hitSlop={10}
      className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
    >
      {isDark ? (
        <Sun size={18} color="#A1A1AA" strokeWidth={2} />
      ) : (
        <Moon size={18} color="#52525B" strokeWidth={2} />
      )}
    </Pressable>
  );
}
