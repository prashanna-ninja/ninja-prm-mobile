import { Text, View } from "react-native";

import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/types/task.types";

/**
 * Status + priority pills. Colours follow the web's task badges
 * (`ref/prm/src/app/(user)/dashboard/tasks/[id]/page.tsx`): low grey, normal
 * blue, high red; open blue, done green, cancelled grey. Solid literal tints —
 * alpha on themed tokens doesn't work here (docs/03).
 */
const PRIORITY: Record<TaskPriority, { bg: string; fg: string }> = {
  LOW: { bg: "#F4F4F5", fg: "#52525B" },
  NORMAL: { bg: "#DBEAFE", fg: "#1E40AF" },
  HIGH: { bg: "#FEE2E2", fg: "#B91C1C" },
};

const STATUS: Record<TaskStatus, { bg: string; fg: string }> = {
  OPEN: { bg: "#DBEAFE", fg: "#1E40AF" },
  DONE: { bg: "#DCFCE7", fg: "#166534" },
  CANCELLED: { bg: "#F4F4F5", fg: "#52525B" },
};

export function PriorityBadge({
  priority,
  size = "md",
}: {
  priority: TaskPriority;
  size?: "sm" | "md";
}) {
  // Unknown values shouldn't crash a row — the API could add one.
  const style = PRIORITY[priority] ?? PRIORITY.NORMAL;
  return (
    <Pill
      bg={style.bg}
      fg={style.fg}
      size={size}
      label={`${TASK_PRIORITY_LABELS[priority] ?? priority} priority`}
    />
  );
}

export function StatusBadge({
  status,
  size = "md",
}: {
  status: TaskStatus;
  size?: "sm" | "md";
}) {
  const style = STATUS[status] ?? STATUS.OPEN;
  return (
    <Pill
      bg={style.bg}
      fg={style.fg}
      size={size}
      label={TASK_STATUS_LABELS[status] ?? status}
    />
  );
}

function Pill({
  bg,
  fg,
  label,
  size,
}: {
  bg: string;
  fg: string;
  label: string;
  size: "sm" | "md";
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: size === "sm" ? 7 : 9,
        paddingVertical: size === "sm" ? 2 : 3,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontFamily: "Bricolage_500Medium",
          fontSize: size === "sm" ? 11 : 12,
          color: fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
