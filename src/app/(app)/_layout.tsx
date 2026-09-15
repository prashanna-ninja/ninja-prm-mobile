import { Tabs } from "expo-router";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { House, Library, Settings } from "@/lib/icons";

/** Logged-IN shell: Home · Recordings · Settings. */
export default function AppLayout() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";

  // Android is edge-to-edge and always-on in SDK 57, so the tab bar sits over
  // the gesture/nav bar. Add the inset to the bar's own height rather than
  // letting the default padding stack on top of it.
  const barHeight = 58 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF8900",
        tabBarInactiveTintColor: isDark ? "#A1A1AA" : "#71717A",
        tabBarStyle: {
          height: barHeight,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          backgroundColor: isDark ? "#1D1D20" : "#FFFFFF",
          borderTopColor: isDark ? "#38383D" : "#E4E4E7",
          borderTopWidth: 1,
          // The default bar draws its own elevation shadow, which reads as a
          // grey smear above the border on Android. Borders carry hierarchy
          // in this design — see docs/03 §5.
          elevation: 0,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarLabelStyle: {
          fontFamily: "Bricolage_500Medium",
          fontSize: 11,
          marginTop: 2,
        },
        // ⚠️ Android's default tab button uses an UNBOUNDED ripple, which
        // balloons well past the bar and spills below it when pressed. Swap in
        // a plain Pressable with the ripple disabled so the touch feedback
        // stays inside the tab.
        //
        // Only the handlers we need are forwarded — spreading the full prop
        // set drags in a `ref` whose type doesn't match Pressable's, and a
        // plain style OBJECT is used because NativeWind's wrapper silently
        // drops the function form (see components/login/auth-button.tsx).
        tabBarButton: ({
          onPress,
          onLongPress,
          accessibilityState,
          accessibilityLabel,
          testID,
          children,
        }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={accessibilityState}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            onPress={onPress}
            onLongPress={onLongPress}
            android_ripple={null}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {children}
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <House size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="recordings"
        options={{
          title: "Recordings",
          tabBarIcon: ({ color }) => (
            <Library size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Settings size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
