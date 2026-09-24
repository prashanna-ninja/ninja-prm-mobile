import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { useRecordingAudio } from "@/api/recordings.api";
import { ShareTranscriptSheet } from "@/components/recordings/share-transcript-sheet";
import { describeError } from "@/components/ui/states";
import { downloadAndShare } from "@/lib/file-share";
import { Copy, Download, Share2 } from "@/lib/icons";
import { SOURCE_META } from "@/lib/recordings";
import type { RecordingDetail } from "@/types/recording.types";

/**
 * Save the audio · email the transcript · copy the transcript.
 *
 * Two different kinds of "share", on purpose:
 *   - **Save audio** goes through the OS share sheet, which is where
 *     "Save to Files"/"Save to Drive" live — on a phone that sheet IS the
 *     download.
 *   - **Email** posts to the backend so the recipient gets the same branded
 *     Ninja PRM email the web app sends, with the sender's note on top.
 *
 * Each button only appears when the recording actually has that content, and
 * the whole row disappears when it has neither.
 */
export function RecordingActions({ recording }: { recording: RecordingDetail }) {
  const [savingAudio, setSavingAudio] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);

  // Only fetch the audio URL once the user actually asks for it — no point
  // burning a signed URL on every detail view.
  const audio = useRecordingAudio(recording.source, recording.id, false);

  const hasTranscript = !!recording.transcript;

  const onSaveAudio = async () => {
    if (savingAudio) return;
    setSavingAudio(true);
    try {
      // refetch() rather than enabling the query, so the URL is fresh — the
      // signed link expires and a stale one fails mid-download.
      const { data, error } = await audio.refetch();
      if (error || !data?.url) throw error ?? new Error("No audio available.");

      const mime = data.mimeType ?? "audio/mpeg";
      const ext = mime.includes("wav")
        ? "wav"
        : mime.includes("m4a") || mime.includes("mp4")
          ? "m4a"
          : "mp3";

      const name = `${SOURCE_META[recording.source].label}-${recording.title}.${ext}`;
      await downloadAndShare(data.url, name, mime);
    } catch (err) {
      Alert.alert("Couldn't save the audio", describeError(err));
    } finally {
      setSavingAudio(false);
    }
  };

  const onCopyTranscript = async () => {
    if (!recording.transcript) return;
    await Clipboard.setStringAsync(recording.transcript);
    Alert.alert("Copied", "The transcript is on your clipboard.");
  };

  if (!recording.hasAudio && !hasTranscript) return null;

  return (
    <>
      <View className="flex-row gap-2">
        {recording.hasAudio ? (
          <ActionButton
            label="Save audio"
            icon={<Download size={16} color="#52525B" strokeWidth={2} />}
            loading={savingAudio}
            disabled={savingAudio}
            onPress={onSaveAudio}
          />
        ) : null}

        {hasTranscript ? (
          <>
            <ActionButton
              label="Email"
              icon={<Share2 size={16} color="#52525B" strokeWidth={2} />}
              disabled={savingAudio}
              onPress={() => setShareOpen(true)}
            />
            <ActionButton
              label="Copy"
              icon={<Copy size={16} color="#52525B" strokeWidth={2} />}
              disabled={savingAudio}
              onPress={onCopyTranscript}
            />
          </>
        ) : null}
      </View>

      <ShareTranscriptSheet
        recording={recording}
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}

function ActionButton({
  label,
  icon,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled}
      // Plain style OBJECT — NativeWind drops the function form (CLAUDE.md §4b).
      className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card active:opacity-70"
      style={{ opacity: disabled && !loading ? 0.5 : 1 }}
    >
      {loading ? <ActivityIndicator size="small" color="#71717A" /> : icon}
      <Text className="font-sans-medium text-[13px] text-card-foreground">
        {label}
      </Text>
    </Pressable>
  );
}
