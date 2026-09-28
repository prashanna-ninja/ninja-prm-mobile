import { Linking, Pressable, Text, View } from "react-native";

import { CalendarDays, ExternalLink, Phone, Quote, Tag } from "@/lib/icons";
import { formatDateTimeLong } from "@/lib/format";
import type { RecordingDetail } from "@/types/recording.types";

/**
 * The per-source extras from the API's `details` object.
 *
 * All four shapes already arrive in the detail response — this just renders
 * the one that matches. Each section self-hides when its data is absent, so a
 * sparse recording shows nothing rather than a row of empty labels.
 */
export function RecordingDetails({ recording }: { recording: RecordingDetail }) {
  const d = recording.details ?? {};

  switch (recording.source) {
    case "call":
      return <CallDetails recording={recording} />;

    case "plaud":
      return d.keyTopics?.length ? (
        <Block title="Key topics">
          <Chips items={d.keyTopics} />
        </Block>
      ) : null;

    case "granola":
      return <GranolaDetails recording={recording} />;

    case "fieldy":
      return <FieldyDetails recording={recording} />;

    default:
      return null;
  }
}

function CallDetails({ recording }: { recording: RecordingDetail }) {
  const { callNumber, receiverNumber } = recording.details ?? {};
  if (!callNumber && !receiverNumber) return null;

  return (
    <Block title="Call details">
      {callNumber ? (
        <NumberRow
          label="Call number"
          value={callNumber}
          hint="Your line / SIM that placed or received the call"
        />
      ) : null}
      {receiverNumber ? (
        <NumberRow
          label="Receiver number"
          value={receiverNumber}
          hint="The other party on the call"
        />
      ) : null}
      <View className="flex-row items-start gap-3">
        <CalendarDays size={16} color="#71717A" strokeWidth={2} style={{ marginTop: 1 }} />
        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-[13px] text-card-foreground">
            Date &amp; time
          </Text>
          <Text className="font-sans text-[13px] text-muted-foreground">
            {formatDateTimeLong(recording.occurredAt)}
          </Text>
        </View>
      </View>
    </Block>
  );
}

/** A phone number you can actually call — the point of having it on a phone. */
function NumberRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Call ${value}`}
      onPress={() => Linking.openURL(`tel:${value.replace(/\s+/g, "")}`)}
      className="flex-row items-start gap-3 active:opacity-70"
    >
      <Phone size={16} color="#AD5100" strokeWidth={2} style={{ marginTop: 1 }} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-medium text-[13px] text-card-foreground">
          {label}
        </Text>
        <Text className="font-sans text-[13px] text-primary-strong">{value}</Text>
        <Text className="font-sans text-xs text-muted-foreground">{hint}</Text>
      </View>
    </Pressable>
  );
}

function GranolaDetails({ recording }: { recording: RecordingDetail }) {
  const { attendees, ownerName, webUrl, calendarEventTitle } =
    recording.details ?? {};
  const people = (attendees ?? []).filter((a) => a?.name || a?.email);
  if (!people.length && !ownerName && !webUrl && !calendarEventTitle) return null;

  return (
    <Block title="Meeting details">
      {calendarEventTitle ? (
        <Row label="Calendar event" value={calendarEventTitle} />
      ) : null}
      {ownerName ? <Row label="Organiser" value={ownerName} /> : null}

      {people.length > 0 ? (
        <View className="gap-1">
          <Text className="font-sans-medium text-[13px] text-card-foreground">
            Attendees
          </Text>
          {people.map((a, i) => (
            <Text
              key={`${a.email ?? a.name}-${i}`}
              className="font-sans text-[13px] text-muted-foreground"
            >
              {a.name || a.email}
              {a.name && a.email ? ` · ${a.email}` : ""}
            </Text>
          ))}
        </View>
      ) : null}

      {webUrl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open in Granola"
          onPress={() => Linking.openURL(webUrl)}
          className="flex-row items-center gap-2 active:opacity-70"
        >
          <ExternalLink size={14} color="#AD5100" strokeWidth={2.2} />
          <Text className="font-sans-medium text-[13px] text-primary-strong">
            Open in Granola
          </Text>
        </Pressable>
      ) : null}
    </Block>
  );
}

function FieldyDetails({ recording }: { recording: RecordingDetail }) {
  const { keywords, speakers, quotes } = recording.details ?? {};
  const hasAny =
    keywords?.length || speakers?.length || quotes?.length;
  if (!hasAny) return null;

  return (
    <>
      {keywords?.length || speakers?.length ? (
        <Block title="Conversation details">
          {speakers?.length ? (
            <Row label="Speakers" value={speakers.join(", ")} />
          ) : null}
          {keywords?.length ? (
            <View className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Tag size={12} color="#71717A" strokeWidth={2.2} />
                <Text className="font-sans-medium text-[13px] text-card-foreground">
                  Keywords
                </Text>
              </View>
              <Chips items={keywords} />
            </View>
          ) : null}
        </Block>
      ) : null}

      {quotes?.length ? (
        <Block title="Notable quotes">
          {quotes.map((q, i) => (
            <View key={i} className="flex-row gap-2.5">
              <Quote size={13} color="#D4D4D8" strokeWidth={2} style={{ marginTop: 3 }} />
              <View className="min-w-0 flex-1">
                <Text className="font-sans text-sm leading-[21px] text-card-foreground">
                  {q.text}
                </Text>
                {q.context ? (
                  <Text className="font-sans text-xs text-muted-foreground">
                    {q.context}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </Block>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="font-sans-medium text-[13px] text-card-foreground">
        {label}
      </Text>
      <Text className="font-sans text-[13px] text-muted-foreground">{value}</Text>
    </View>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {items.map((item, i) => (
        <View key={`${item}-${i}`} className="rounded-full bg-secondary px-2.5 py-1">
          <Text className="font-sans text-xs text-secondary-foreground">
            {item}
          </Text>
        </View>
      ))}
    </View>
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
      <View className="gap-3 rounded-lg border border-border bg-card p-4">
        {children}
      </View>
    </View>
  );
}
