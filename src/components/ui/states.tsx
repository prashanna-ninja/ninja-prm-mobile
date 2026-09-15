import { Pressable, Text, View } from "react-native";

import { ApiError } from "@/lib/api-client";

/**
 * The two states every data surface needs besides "loading" and "data".
 * Having them here keeps the wording consistent instead of each screen
 * inventing its own.
 */

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="items-center gap-3 rounded-lg border border-border bg-card px-6 py-12">
      {icon}
      <Text className="text-center font-sans-medium text-[15px] text-card-foreground">
        {title}
      </Text>
      {message ? (
        <Text className="text-center font-sans text-sm leading-5 text-muted-foreground">
          {message}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          className="mt-1 h-10 items-center justify-center rounded-lg border border-border px-4 active:opacity-70"
        >
          <Text className="font-sans-medium text-sm text-foreground">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <View className="gap-3 rounded-lg border border-border bg-card px-6 py-10">
      <Text className="text-center font-sans-medium text-[15px] text-card-foreground">
        Something went wrong
      </Text>
      <Text className="text-center font-sans text-sm leading-5 text-muted-foreground">
        {describeError(error)}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-1 h-10 items-center justify-center self-center rounded-lg bg-primary px-5 active:opacity-70"
        >
          <Text className="font-sans-semibold text-sm text-primary-foreground">
            Try again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Turn an error into something worth reading.
 *
 * The status-specific cases matter: a 409 means an integration isn't connected
 * (fixable, on the web), and a network failure means "we couldn't reach the
 * server" — neither is "something broke", which is what a bare message implies.
 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Please sign in again.";
    if (error.status === 403) return "You don't have access to this.";
    if (error.status === 404) return "We couldn't find that.";
    if (error.status === 409) return error.message;
    if (error.status === 429) return "Too many requests — give it a moment.";
    if (error.status >= 500) return "The server had a problem. Try again shortly.";
    return error.message;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
    return "Can't reach Ninja PRM. Check your connection.";
  }
  return message || "An unexpected error occurred.";
}
