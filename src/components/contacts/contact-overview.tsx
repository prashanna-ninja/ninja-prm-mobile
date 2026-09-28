import { Text, View } from "react-native";

import { CalendarDays, CircleCheck, MessageSquare, Mic } from "@/lib/icons";
import { formatDateCompact } from "@/lib/format";
import {
  RELATIONSHIP_LABELS,
  type ContactDetail,
} from "@/types/contact.types";

/**
 * The four-up counter grid plus the metadata rows, mirroring the web's
 * Overview card.
 *
 * Counts come from the detail response's `_count`, except recordings —
 * `_count` doesn't include them, so the caller passes the total from the
 * contact's call-recordings query.
 */
export function ContactOverview({
  contact,
  recordingCount,
}: {
  contact: ContactDetail & {
    _count?: {
      interactions: number;
      taskContacts: number;
      importantDates: number;
    };
  };
  recordingCount?: number;
}) {
  const counts = contact._count;
  const openTasks = (contact.tasks ?? []).filter(
    (t) => t.status === "OPEN",
  ).length;

  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-xs uppercase tracking-wide text-muted-foreground">
        Overview
      </Text>

      <View className="gap-2">
        <View className="flex-row gap-2">
          <Stat
            icon={<MessageSquare size={14} color="#71717A" strokeWidth={2} />}
            label="Interactions"
            value={counts?.interactions ?? contact.interactions?.length ?? 0}
          />
          <Stat
            icon={<CircleCheck size={14} color="#71717A" strokeWidth={2} />}
            label="Open tasks"
            value={openTasks}
          />
        </View>
        <View className="flex-row gap-2">
          <Stat
            icon={<Mic size={14} color="#71717A" strokeWidth={2} />}
            label="Recordings"
            value={recordingCount ?? 0}
          />
          <Stat
            icon={<CalendarDays size={14} color="#71717A" strokeWidth={2} />}
            label="Key dates"
            value={
              counts?.importantDates ?? contact.importantDates?.length ?? 0
            }
          />
        </View>
      </View>

      <View className="gap-2 rounded-lg border border-border bg-card p-4">
        <MetaRow label="Added" value={formatDateCompact(contact.createdAt)} />
        <MetaRow
          label="Last updated"
          value={formatDateCompact(contact.updatedAt)}
        />
        <MetaRow
          label="Relationship"
          value={
            RELATIONSHIP_LABELS[contact.relationshipType] ??
            contact.relationshipType
          }
        />
      </View>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <View className="flex-1 gap-1 rounded-lg border border-border bg-card p-3">
      <View className="flex-row items-center gap-1.5">
        {icon}
        <Text className="font-sans text-xs text-muted-foreground">{label}</Text>
      </View>
      <Text
        className="font-display text-[22px] text-card-foreground"
        style={{ letterSpacing: -0.5 }}
      >
        {value}
      </Text>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-sans text-[13px] text-muted-foreground">
        {label}
      </Text>
      <Text className="font-sans-medium text-[13px] text-card-foreground">
        {value}
      </Text>
    </View>
  );
}
