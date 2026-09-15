import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { AudioPlayer } from "@/components/recordings/audio-player";
import { Screen } from "@/components/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useRecording } from "@/api/recordings.api";
import { ArrowLeft } from "@/lib/icons";
import { formatDateTimeLong, formatDuration } from "@/lib/format";
import { SOURCE_META } from "@/lib/recordings";
import {
  RECORDING_SOURCES,
  type RecordingSource,
} from "@/types/recording.types";

/**
 * Recording detail — one route, all four sources.
 *
 * ⚠️ Phase 7 in progress: header + summary + action items + transcript are
 * here; the audio player and the per-source `details` blocks are still to
 * come (see docs/features/FEAT-01-RECORDINGS.md §6).
 */
export default function RecordingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string; id?: string }>();

  const source = RECORDING_SOURCES.includes(params.source as RecordingSource)
    ? (params.source as RecordingSource)
    : null;
  const id = params.id ?? "";

  const query = useRecording(source ?? "call", id);

  // Back always returns to the list, so opening a recording from Home doesn't
  // leave a detail screen parked inside the Recordings tab.
  const goBack = () => router.replace("/recordings");

  if (!source || !id) {
    return (
      <Screen>
        <View className="px-4 pt-2">
          <EmptyState
            title="Recording not found"
            action={{ label: "Back to recordings", onPress: goBack }}
          />
        </View>
      </Screen>
    );
  }

  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  const data = query.data;
  const duration = formatDuration(data?.durationSec);

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-4 pb-10 gap-6">
        <AppHeader
          title={`${meta.label} details`}
          left={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to recordings"
              onPress={goBack}
              hitSlop={10}
              className="h-10 w-10 items-center justify-center rounded-full border border-border active:opacity-70"
            >
              <ArrowLeft size={18} color="#52525B" strokeWidth={2} />
            </Pressable>
          }
        />

        {query.isPending ? (
          <View className="gap-3">
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-28 rounded-lg" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !data ? (
          <EmptyState
            title="Recording not found"
            action={{ label: "Back to recordings", onPress: goBack }}
          />
        ) : (
          <>
            <View className="flex-row gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-md bg-primary-soft">
                <Icon size={21} color="#FF8900" strokeWidth={2} />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-display text-[22px] leading-7 text-foreground">
                  {data.title}
                </Text>
                <Text className="font-sans text-sm text-muted-foreground">
                  {formatDateTimeLong(data.occurredAt)}
                  {duration ? ` · ${duration}` : ""}
                </Text>
              </View>
            </View>

            {/* Guarded as a whole: an empty badge row would still consume a
                `gap-6` of the parent's spacing and leave a hole. */}
            {data.category || data.details?.sentiment || data.archived ? (
              <View className="flex-row flex-wrap items-center gap-2">
                {data.category ? (
                  <View className="flex-row items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    <View
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: data.category.color }}
                    />
                    <Text className="font-sans text-xs text-muted-foreground">
                      {data.category.name}
                    </Text>
                  </View>
                ) : null}

                {data.details?.sentiment ? (
                  <View className="rounded-full border border-border px-2.5 py-1">
                    <Text className="font-sans text-xs capitalize text-muted-foreground">
                      {data.details.sentiment}
                    </Text>
                  </View>
                ) : null}

                {data.archived ? (
                  <View className="rounded-full bg-secondary px-2.5 py-1">
                    <Text className="font-sans text-xs text-secondary-foreground">
                      Archived
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Omitted entirely for Granola and Fieldy, which have no audio —
                an empty player is worse than no player. */}
            {data.hasAudio ? (
              <AudioPlayer source={source} recordingId={id} />
            ) : null}

            {data.contacts.length > 0 ? (
              <Block title="People">
                {data.contacts.map((c) => (
                  <Text
                    key={c.id}
                    className="font-sans text-sm text-card-foreground"
                  >
                    {c.name}
                    {c.email ? (
                      <Text className="text-muted-foreground"> · {c.email}</Text>
                    ) : null}
                  </Text>
                ))}
              </Block>
            ) : null}

            <Block title="Summary">
              <Text className="font-sans text-sm leading-[21px] text-card-foreground">
                {data.summary || "No summary yet"}
              </Text>
            </Block>

            <Block title="Action items">
              {data.actionItems.length > 0 ? (
                <View className="gap-2">
                  {data.actionItems.map((item, i) => (
                    <View key={`${i}-${item}`} className="flex-row gap-2.5">
                      <View className="mt-[7px] h-1.5 w-1.5 rounded-full bg-primary" />
                      <Text className="flex-1 font-sans text-sm leading-[21px] text-card-foreground">
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="font-sans text-sm text-muted-foreground">
                  None identified
                </Text>
              )}
            </Block>

            {data.transcript ? (
              <Block title="Transcript">
                <Text
                  selectable
                  className="font-sans text-sm leading-[22px] text-card-foreground"
                >
                  {data.transcript}
                </Text>
              </Block>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Block({
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
      <View className="gap-1.5 rounded-lg border border-border bg-card p-4">
        {children}
      </View>
    </View>
  );
}
