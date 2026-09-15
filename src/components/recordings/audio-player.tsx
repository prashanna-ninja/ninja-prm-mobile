import Slider from "@react-native-community/slider";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useRecordingAudio } from "@/api/recordings.api";
import { formatClock } from "@/lib/format";
import { Pause, Play, RotateCcw, RotateCw } from "@/lib/icons";
import { describeError } from "@/components/ui/states";
import type { RecordingSource } from "@/types/recording.types";

const SKIP_SECONDS = 15;
/** 40-minute meetings are the norm here, so speed is a first-class control. */
const SPEEDS = [1, 1.25, 1.5, 2] as const;

/**
 * Audio playback for a recording.
 *
 * ⚠️ The URL must be publicly playable for a short window. `expo-audio` hands
 * it to the OS player (AVPlayer / ExoPlayer), which does NOT share our fetch
 * stack and will never send the session cookie. The backend returns a
 * presigned S3 URL for calls and a short-lived signed proxy URL for Plaud —
 * see docs/04-BACKEND-REFERENCE.md §4.
 */
export function AudioPlayer({
  source,
  recordingId,
}: {
  source: RecordingSource;
  recordingId: string;
}) {
  const audio = useRecordingAudio(source, recordingId);
  const player = useAudioPlayer(audio.data?.url ?? null);
  const status = useAudioPlayerStatus(player);

  const [speedIndex, setSpeedIndex] = React.useState(0);
  // While dragging, the slider owns the displayed position — otherwise status
  // updates fight the user's thumb and it jitters back mid-drag.
  const [scrubTo, setScrubTo] = React.useState<number | null>(null);

  // Keep playing when the screen locks or the app backgrounds. Someone
  // listening to a call on a commute should not have it stop in their pocket.
  React.useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {
      // Non-fatal: playback still works, it just won't survive backgrounding.
    });
  }, []);

  const duration = status.duration || 0;
  const position = scrubTo ?? status.currentTime ?? 0;

  const togglePlay = React.useCallback(() => {
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing]);

  const skip = React.useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(0, position + delta), duration || Infinity);
      void player.seekTo(next);
    },
    [player, position, duration],
  );

  const cycleSpeed = React.useCallback(() => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    // Pitch correction on: 2x speech should sound fast, not like a chipmunk.
    player.setPlaybackRate(SPEEDS[next]!, "high");
  }, [player, speedIndex]);

  if (audio.isPending) {
    return (
      <Shell>
        <ActivityIndicator color="#FF8900" />
        <Text className="font-sans text-sm text-muted-foreground">
          Loading audio…
        </Text>
      </Shell>
    );
  }

  if (audio.isError) {
    return (
      <Shell>
        <Text className="text-center font-sans text-sm text-muted-foreground">
          {describeError(audio.error)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void audio.refetch()}
          className="h-9 items-center justify-center rounded-lg border border-border px-4 active:opacity-70"
        >
          <Text className="font-sans-medium text-sm text-foreground">Retry</Text>
        </Pressable>
      </Shell>
    );
  }

  const isReady = status.isLoaded && duration > 0;

  return (
    <View className="gap-3 rounded-lg border border-border bg-card p-4">
      <Slider
        value={duration > 0 ? position / duration : 0}
        minimumValue={0}
        maximumValue={1}
        minimumTrackTintColor="#FF8900"
        maximumTrackTintColor="#E4E4E7"
        thumbTintColor="#FF8900"
        disabled={!isReady}
        onValueChange={(v) => setScrubTo(v * duration)}
        onSlidingComplete={(v) => {
          const target = v * duration;
          setScrubTo(null);
          void player.seekTo(target);
        }}
        style={{ height: 32 }}
        accessibilityLabel="Seek"
      />

      <View className="-mt-2 flex-row justify-between">
        <Text className="font-sans text-xs text-muted-foreground">
          {formatClock(position)}
        </Text>
        <Text className="font-sans text-xs text-muted-foreground">
          {isReady ? formatClock(duration) : "--:--"}
        </Text>
      </View>

      <View className="flex-row items-center justify-center gap-5">
        <IconButton
          label={`Back ${SKIP_SECONDS} seconds`}
          onPress={() => skip(-SKIP_SECONDS)}
          disabled={!isReady}
        >
          <RotateCcw size={20} color="#52525B" strokeWidth={2} />
        </IconButton>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? "Pause" : "Play"}
          accessibilityState={{ disabled: !isReady, busy: status.isBuffering }}
          onPress={togglePlay}
          disabled={!isReady}
          className="h-14 w-14 items-center justify-center rounded-full bg-primary active:opacity-80"
          style={{ opacity: isReady ? 1 : 0.5 }}
        >
          {status.isBuffering && !status.playing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : status.playing ? (
            <Pause size={24} color="#FFFFFF" strokeWidth={2.4} />
          ) : (
            // Optical centring: a triangle looks left-heavy when geometrically centred.
            <Play
              size={24}
              color="#FFFFFF"
              strokeWidth={2.4}
              style={{ marginLeft: 2 }}
            />
          )}
        </Pressable>

        <IconButton
          label={`Forward ${SKIP_SECONDS} seconds`}
          onPress={() => skip(SKIP_SECONDS)}
          disabled={!isReady}
        >
          <RotateCw size={20} color="#52525B" strokeWidth={2} />
        </IconButton>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playback speed ${SPEEDS[speedIndex]}x. Tap to change.`}
        onPress={cycleSpeed}
        disabled={!isReady}
        className="self-center rounded-full border border-border px-3 py-1 active:opacity-70"
      >
        <Text className="font-sans-medium text-xs text-muted-foreground">
          {SPEEDS[speedIndex]}×
        </Text>
      </Pressable>
    </View>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-6">
      {children}
    </View>
  );
}

function IconButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </Pressable>
  );
}
