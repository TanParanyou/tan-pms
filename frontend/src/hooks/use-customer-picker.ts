"use client";

import { useMemo, useState } from "react";
import type { EntityAutocompleteOption } from "@/components/ui/entity-autocomplete";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAdminCustomerSearch } from "@/features/leases/api/use-leases";

export const CUSTOMER_PICKER_DEBOUNCE_MS = 300;

/** Debounced customer search that keeps the picked customer selectable after the search text changes. */
export function useCustomerPicker(propertyId: string) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), CUSTOMER_PICKER_DEBOUNCE_MS);
  const query = useAdminCustomerSearch(propertyId, debounced);
  const [picked, setPicked] = useState<EntityAutocompleteOption | null>(null);

  const map = useMemo(
    () =>
      new Map<string, EntityAutocompleteOption>(
        (query.data?.items ?? []).map((c) => [c.id, { value: c.id, label: `${c.fullName} (${c.maskedNationalId})` }])
      ),
    [query.data]
  );
  const options = useMemo(() => {
    const list = Array.from(map.values());
    return picked && !map.has(picked.value) ? [picked, ...list] : list;
  }, [map, picked]);

  return {
    options,
    setSearch,
    pick: (value: string) => setPicked(map.get(value) ?? null),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
