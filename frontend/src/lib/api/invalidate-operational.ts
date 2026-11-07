import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

/** Operational writes (leases, readings, invoices) touch many caches; await all so UI never shows stale data. */
export function invalidateOperationalCaches(queryClient: QueryClient): Promise<unknown[]> {
  return Promise.all(
    [
      queryKeys.leases.all,
      queryKeys.meters.all,
      queryKeys.billing.all,
      queryKeys.cashier.all,
      queryKeys.payments.all,
      queryKeys.depositLedgers.all,
      queryKeys.properties.all,
      queryKeys.rack.all,
      queryKeys.availability.all,
      queryKeys.stays.all,
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}
