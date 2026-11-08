"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import type { EntityAutocompleteOption } from "@/components/ui/entity-autocomplete";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";

/** Name-first unit options (all units) built from the property hierarchy. */
export function useUnitOptions(propertyId: string) {
  const locale = useLocale() as "th" | "en";
  const query = usePropertyHierarchy(propertyId);
  const options = useMemo<EntityAutocompleteOption[]>(
    () =>
      (query.data?.units ?? []).map((u) => ({
        value: u.id,
        label: `${resolveLocalizedText(u.unitType.name, locale)} (${u.unitNumber})`,
        sublabel: resolveLocalizedText(u.building.name, locale),
        code: u.unitNumber,
      })),
    [query.data, locale]
  );
  return { ...query, options };
}
