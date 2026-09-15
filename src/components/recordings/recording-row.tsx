import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

import { FileText, Volume2 } from "@/lib/icons";
import { formatDateCompact, formatDuration, initialsFromName } from "@/lib/format";
import { SOURCE_META } from "@/lib/recordings";
import type { RecordingListItem } from "@/types/recording.types";

/**
 * One recording in a list.
 *
 * Shared by the Recordings list and the Home "recent" card — `compact` drops
 * the summary and avatars for the denser Home variant. Two copies of this row
 * would drift within a week.
 */
export function RecordingRow({
  item,
  compact = false,
}: {
  item: RecordingListItem;
  compact?: boolean;
}) {
  const router = useRouter();
  const meta = SOURCE_META[item.source];
  const Icon = meta.icon;
  const duration = formatDuration(item.durationSec);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${item.title}`}
      // Typed routes require the object form for dynamic segments.
      onPress={() =>
        router.push({
          pathname: "/recordings/[source]/[id]",
          params: { source: item.source, id: item.id },
        })
      }
      className="flex-row gap-3 rounded-lg border border-border bg-card p-3 active:opacity-70"
    >
      {/* "New" rail: unarchived with nobody linked. The one place red is not
          an error — it mirrors the web app's border-l-4 treatment. */}
      {item.isNew ? (
        <View className="absolute bottom-0 left-0 top-0 w-1 rounded-l-lg bg-destructive" />
      ) : null}

      <View className="h-10 w-10 items-center justify-center rounded-md bg-primary-soft">
        <Icon size={19} color="#FF8900" strokeWidth={2} />
      </View>

      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className="min-w-0 flex-1 font-sans-medium text-[15px] text-card-foreground"
          >
            {item.title}
          </Text>
          {item.isNew ? (
            <View className="rounded-full bg-destructive-soft px-2 py-0.5">
              <Text className="font-sans-medium text-[10px] text-destructive">
                New
              </Text>
            </View>
          ) : null}
        </View>

        {!compact && item.summary ? (
          <Text
            numberOfLines={2}
            className="font-sans text-[13px] leading-[18px] text-muted-foreground"
          >
            {item.summary}
          </Text>
        ) : null}

        <View className="flex-row items-center gap-2">
          <Text className="font-sans text-xs text-muted-foreground">
            {meta.label}
          </Text>
          <Dot />
          <Text className="font-sans text-xs text-muted-foreground">
            {formatDateCompact(item.occurredAt)}
          </Text>
          {duration ? (
            <>
              <Dot />
              <Text className="font-sans text-xs text-muted-foreground">
                {duration}
              </Text>
            </>
          ) : null}

          {/* What's actually IN this recording — the question a phone user
              asks first ("can I listen to this on the train?"). */}
          <View className="flex-row items-center gap-1.5 pl-0.5">
            {item.hasAudio ? (
              <Volume2 size={12} color="#A1A1AA" strokeWidth={2} />
            ) : null}
            {item.hasTranscript ? (
              <FileText size={12} color="#A1A1AA" strokeWidth={2} />
            ) : null}
          </View>
        </View>

        {!compact && item.contacts.length > 0 ? (
          <ContactStrip contacts={item.contacts} />
        ) : null}
      </View>
    </Pressable>
  );
}

function Dot() {
  return <View className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />;
}

function ContactStrip({
  contacts,
}: {
  contacts: RecordingListItem["contacts"];
}) {
  const shown = contacts.slice(0, 3);
  const extra = contacts.length - shown.length;

  return (
    <View className="flex-row items-center gap-1.5 pt-0.5">
      {shown.map((contact) => (
        <View
          key={contact.id}
          className="h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-secondary"
        >
          {contact.image ? (
            <Image
              source={{ uri: contact.image }}
              style={{ width: 20, height: 20 }}
              accessibilityLabel={contact.name}
            />
          ) : (
            <Text className="font-sans-medium text-[9px] text-secondary-foreground">
              {initialsFromName(contact.name)}
            </Text>
          )}
        </View>
      ))}
      <Text numberOfLines={1} className="font-sans text-xs text-muted-foreground">
        {shown.map((c) => c.name).join(", ")}
        {extra > 0 ? ` +${extra}` : ""}
      </Text>
    </View>
  );
}
