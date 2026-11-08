"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { EntityAutocompleteOption } from "@/components/ui/entity-autocomplete";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";

/** Active admin users as assignee options (housekeeping staff, technicians). No sample fallback. */
export function useAssigneeOptions() {
  const locale = useLocale() as "th" | "en";
  const query = useQuery({
    queryKey: [...queryKeys.users.all, "assignee-options"],
    queryFn: () => apiClient.getAdminUsers(),
  });
  const options = useMemo<EntityAutocompleteOption[]>(
    () =>
      (query.data?.items ?? [])
        .filter((u) => u.isActive)
        .map((u) => ({ value: u.id, label: u.fullName, sublabel: resolveLocalizedText(u.roleName, locale), code: u.username })),
    [query.data, locale]
  );
  return { ...query, options };
}
