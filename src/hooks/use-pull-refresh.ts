import * as React from "react";

/**
 * Pull-to-refresh state that only reflects the PULL.
 *
 * Binding `RefreshControl` to `query.isRefetching` showed the spinner for
 * every background refetch too — returning to the app, a push arriving, a
 * poll — so a silent update looked like the screen was loading. The spinner
 * now means "you asked, it's working"; every other refresh just swaps the
 * data in.
 */
export function usePullRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    refresh()
      .catch(() => {}) // the query's own error state reports failures
      .finally(() => setRefreshing(false));
  }, [refresh]);

  return { refreshing, onRefresh };
}
