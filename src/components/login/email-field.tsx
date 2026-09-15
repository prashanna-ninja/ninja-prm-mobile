import * as React from "react";
import { Animated, Text, TextInput, View, type TextInputProps } from "react-native";

import { AUTH } from "@/components/login/auth-palette";
import { Mail } from "@/lib/icons";

type EmailFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  error?: string;
};

/**
 * Boxed email input: mail icon on the left, a small label stacked above the
 * value inside the box. The border animates to brand orange on focus, which is
 * the design system's endorsed use of orange (an accent rule, never text).
 */
export const EmailField = React.forwardRef<TextInput, EmailFieldProps>(
  function EmailField({ label, error, onFocus, onBlur, ...props }, ref) {
    const [focused, setFocused] = React.useState(false);
    const focusAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
      const animation = Animated.timing(focusAnim, {
        toValue: focused ? 1 : 0,
        duration: 160,
        // Border colour/width can't run on the native driver.
        useNativeDriver: false,
      });
      animation.start();
      return () => animation.stop();
    }, [focused, focusAnim]);

    const borderColor = error
      ? AUTH.danger
      : focusAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [AUTH.line, AUTH.brand],
        });

    return (
      <View style={{ gap: 8 }}>
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1.5,
            borderColor,
            borderRadius: 14,
            backgroundColor: error ? AUTH.dangerSoft : AUTH.fieldBg,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Mail
            size={20}
            color={error ? AUTH.danger : focused ? AUTH.brand : AUTH.muted}
            strokeWidth={1.9}
          />

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Bricolage_500Medium",
                fontSize: 12,
                lineHeight: 16,
                color: error ? AUTH.danger : AUTH.muted,
              }}
            >
              {label}
            </Text>
            <TextInput
              ref={ref}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="go"
              placeholderTextColor={AUTH.lineStrong}
              selectionColor={AUTH.brand}
              onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
              }}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
              }}
              style={{
                fontFamily: "Bricolage_400Regular",
                fontSize: 16,
                lineHeight: 21,
                color: AUTH.ink,
                // RN adds invisible vertical padding to TextInput on Android;
                // zeroing it keeps the label/value pair optically tight.
                paddingVertical: 2,
                paddingHorizontal: 0,
              }}
              {...props}
            />
          </View>
        </Animated.View>

        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: "Bricolage_400Regular",
              fontSize: 13,
              lineHeight: 18,
              color: AUTH.danger,
            }}
          >
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);
