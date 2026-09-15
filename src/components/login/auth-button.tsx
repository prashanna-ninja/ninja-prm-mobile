import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from "react-native";

import { AUTH } from "@/components/login/auth-palette";

type AuthButtonProps = Omit<PressableProps, "style" | "children"> & {
  label: string;
  /** "primary" = the one orange fill. "quiet" = a text action. */
  variant?: "primary" | "quiet";
  loading?: boolean;
  icon?: React.ReactNode;
};

/**
 * ⚠️ Do NOT give the Pressable a FUNCTION style (`style={({pressed}) => …}`).
 *
 * NativeWind 4 wraps every React Native component to support `className`, and
 * that wrapper does not reliably forward the function form — the returned style
 * gets dropped, so the button renders with NO background and NO text colour:
 * an invisible-but-tappable box. It cost us a real device bug on 2026-09-15.
 *
 * Track the press state ourselves and hand the Pressable a plain style OBJECT.
 */
export function AuthButton({
  label,
  variant = "primary",
  loading = false,
  icon,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: AuthButtonProps) {
  const [pressed, setPressed] = React.useState(false);

  const isPrimary = variant === "primary";
  const isDisabled = disabled || loading;

  const background = isPrimary
    ? pressed && !isDisabled
      ? AUTH.brandPressed
      : AUTH.brand
    : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={{
        height: isPrimary ? 56 : 46,
        borderRadius: 999,
        backgroundColor: background,
        // Dim rather than grey out: the button keeps its shape and colour
        // identity while unavailable, which reads as "not yet", not "broken".
        opacity: isDisabled ? 0.5 : 1,
      }}
      {...props}
    >
      {/* The inner View owns the centring so the Pressable's own style stays
          as simple as possible — see the NativeWind note above. */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isPrimary ? AUTH.white : AUTH.muted} />
        ) : (
          icon
        )}
        <Text
          style={{
            fontFamily: "Bricolage_600SemiBold",
            fontSize: isPrimary ? 16.5 : 14,
            color: isPrimary ? AUTH.white : AUTH.inkSoft,
            letterSpacing: isPrimary ? 0.1 : 0,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
