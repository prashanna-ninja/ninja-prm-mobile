import { Pressable } from "react-native";

import { Circle, CircleCheckBig, CircleX } from "@/lib/icons";
import type { TaskStatus } from "@/types/task.types";

/**
 * The tick. OPEN ⇄ DONE; a CANCELLED task shows a cross and reopens on tap.
 *
 * Plain className + `active:` for feedback — never a function `style`, which
 * NativeWind's wrapper drops (CLAUDE.md gotcha 4b).
 */
export function TaskCheck({
  status,
  onToggle,
  size = 24,
  disabled,
}: {
  status: TaskStatus;
  onToggle: (next: TaskStatus) => void;
  size?: number;
  disabled?: boolean;
}) {
  const done = status === "DONE";
  const cancelled = status === "CANCELLED";

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={done ? "Mark as open" : "Mark as done"}
      onPress={() => onToggle(status === "OPEN" ? "DONE" : "OPEN")}
      disabled={disabled}
      hitSlop={10}
      className="items-center justify-center active:opacity-60"
    >
      {done ? (
        <CircleCheckBig size={size} color="#16A34A" strokeWidth={2.2} />
      ) : cancelled ? (
        <CircleX size={size} color="#A1A1AA" strokeWidth={2} />
      ) : (
        <Circle size={size} color="#A1A1AA" strokeWidth={1.8} />
      )}
    </Pressable>
  );
}
