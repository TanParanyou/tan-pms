import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";

/** Client writes touch the portal caches and the dashboard summary; await both so the UI is never stale. */
export function invalidateClientCaches(queryClient: QueryClient): Promise<unknown[]> {
  return Promise.all(
    [queryKeys.clientPortal.all, queryKeys.clientDashboard.all].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  );
}
