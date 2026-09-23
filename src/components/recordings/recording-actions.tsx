import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { useRecordingAudio } from "@/api/recordings.api";
import { describeError } from "@/components/ui/states";
import { downloadAndShare, shareTextAsFile } from "@/lib/file-share";
import { formatDateTimeLong } from "@/lib/format";
import { Copy, Download } from "@/lib/icons";
// import { Share2 } from "@/lib/icons"; // ← restore with the Share button below
import { SOURCE_META } from "@/lib/recordings";
import type { RecordingDetail } from "@/types/recording.types";

type Busy = "audio" | "transcript" | null;

/**
 * Save the audio · share the transcript · copy the transcript.
 *
 * Both share paths go through the OS share sheet, which is where "Save to
 * Files"/"Save to Drive" live — on a phone that sheet IS the download.
 */
export function RecordingActions({ recording }: { recording: RecordingDetail }) {
  const [busy, setBusy] = React.useState<Busy>(null);

  // Only fetch the audio URL once the user actually asks for it — no point
  // burning a signed URL on every detail view.
  const audio = useRecordingAudio(recording.source, recording.id, false);

  const baseName = `${SOURCE_META[recording.source].label}-${recording.title}`;

  const onSaveAudio = async () => {
    if (busy) return;
    setBusy("audio");
    try {
      // refetch() rather than enabling the query, so the URL is fresh — the
      // signed link expires and a stale one fails mid-download.
      const { data, error } = await audio.refetch();
      if (error || !data?.url) throw error ?? new Error("No audio available.");

      const ext = data.mimeType?.includes("wav")
        ? "wav"
        : data.mimeType?.includes("m4a") || data.mimeType?.includes("mp4")
          ? "m4a"
          : "mp3";

      await downloadAndShare(data.url, `${baseName}.${ext}`, data.mimeType || "audio/mpeg");
    } catch (err) {
      Alert.alert("Couldn't save the audio", describeError(err));
    } finally {
      setBusy(null);
    }
  };

  /*
   * ⏸ SHARE IS PARKED (2026-09-23, user's call).
   *
   * This shares the transcript as a .txt through the OS share sheet. It works,
   * but the PRM web app's "share" is a different thing: you enter recipient
   * addresses and a note, and the SERVER emails a branded transcript
   * (`shareRecordingTranscript` in ref/prm/src/app/actions/share-transcript.ts).
   * That needs a backend route — there is no REST endpoint for it today.
   *
   * Keeping Download + Copy only until we decide which one we want. To bring
   * this back: uncomment this handler, the Share button in the JSX, and the
   * Share2 import. `shareTextAsFile` and `transcriptDocument` are still here.
   *
   * const onShareTranscript = async () => {
   *   if (busy || !recording.transcript) return;
   *   setBusy("transcript");
   *   try {
   *     await shareTextAsFile(transcriptDocument(recording), `${baseName}.txt`);
   *   } catch (err) {
   *     Alert.alert("Couldn't share the transcript", describeError(err));
   *   } finally {
   *     setBusy(null);
   *   }
   * };
   */

  const onCopyTranscript = async () => {
    if (!recording.transcript) return;
    await Clipboard.setStringAsync(recording.transcript);
    Alert.alert("Copied", "The transcript is on your clipboard.");
  };

  const hasTranscript = !!recording.transcript;
  if (!recording.hasAudio && !hasTranscript) return null;

  return (
    <View className="flex-row gap-2">
      {recording.hasAudio ? (
        <ActionButton
          label="Save audio"
          icon={<Download size={16} color="#52525B" strokeWidth={2} />}
          loading={busy === "audio"}
          disabled={!!busy}
          onPress={onSaveAudio}
        />
      ) : null}

      {hasTranscript ? (
        <>
          {/* ⏸ Share parked — see the note above the handler.
          <ActionButton
            label="Share"
            icon={<Share2 size={16} color="#52525B" strokeWidth={2} />}
            loading={busy === "transcript"}
            disabled={!!busy}
            onPress={onShareTranscript}
          />
          */}
          <ActionButton
            label="Copy transcript"
            icon={<Copy size={16} color="#52525B" strokeWidth={2} />}
            disabled={!!busy}
            onPress={onCopyTranscript}
          />
        </>
      ) : null}
    </View>
  );
}

/** A readable .txt: who/when/what up top, then the transcript. */
function transcriptDocument(r: RecordingDetail): string {
  const lines = [
    r.title,
    `${SOURCE_META[r.source].label} · ${formatDateTimeLong(r.occurredAt)}`,
  ];

  if (r.contacts.length > 0) {
    lines.push(`With: ${r.contacts.map((c) => c.name).join(", ")}`);
  }
  if (r.summary) lines.push("", "SUMMARY", r.summary);
  if (r.actionItems.length > 0) {
    lines.push("", "ACTION ITEMS", ...r.actionItems.map((a) => `- ${a}`));
  }
  lines.push("", "TRANSCRIPT", r.transcript ?? "");

  return lines.join("\n");
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
