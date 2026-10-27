import { Tabs } from "expo-router";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSmsUnreadTotal } from "@/api/sms.api";
import { PushBridge } from "@/components/notifications/push-bridge";
import { House, Library, ListTodo, MessagesSquare, Users } from "@/lib/icons";

/**
 * Logged-IN shell: Home · Messages · Recordings · Contacts · Tasks.
 * Tabs render in DECLARATION order, so the order below IS the bar's order.
 * Messages moved to second at the user's request on 2026-10-20.
 * Five is the ceiling for a bottom bar — a sixth section needs a different
 * navigation shape, not a sixth tab. That's why Settings is a gear on Home
 * (since 2026-10-18) rather than a tab: Messages took its slot.
 */
export default function AppLayout() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = scheme === "dark";
  const unread = useSmsUnreadTotal();

  // Android is edge-to-edge and always-on in SDK 57, so the tab bar sits over
  // the gesture/nav bar. Add the inset to the bar's own height rather than
  // letting the default padding stack on top of it.
  const barHeight = 58 + insets.bottom;

  return (
    <>
      {/* Here, not at the root: the user is signed in and the tabs are
          mounted, so a tapped notification has somewhere to navigate. */}
      <PushBridge />
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
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => (
            <MessagesSquare size={22} color={color} strokeWidth={2} />
          ),
          tabBarBadge: unread.data ? (unread.data > 99 ? "99+" : unread.data) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#FF8900",
            color: "#FFFFFF",
            fontFamily: "Bricolage_600SemiBold",
            fontSize: 10,
          },
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
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: ({ color }) => (
            <Users size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => (
            <ListTodo size={22} color={color} strokeWidth={2} />
          ),
        }}
      />
      {/* Routable but NOT a tab — reached from the gear on Home. `href: null`
          is the whole mechanism: expo-router turns it into a hidden item and a
          null button (TabsClient.js). It only throws if THIS screen also sets
          `tabBarButton`; the shared one in screenOptions is overridden. */}
      <Tabs.Screen name="settings" options={{ href: null, title: "Settings" }} />
      </Tabs>
    </>
  );
}
