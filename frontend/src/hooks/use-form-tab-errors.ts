import { useMemo, useCallback } from "react";

export type FieldToTabMap = Record<string, string>;

export interface UseFormTabErrorsOptions {
  fieldToTabMap: FieldToTabMap;
  errors: Record<string, unknown>;
}

export function useFormTabErrors({ fieldToTabMap, errors }: UseFormTabErrorsOptions) {
  const tabErrors = useMemo(() => {
    const errorTabSet = new Set<string>();
    const errorKeys = Object.keys(errors);

    for (const key of errorKeys) {
      if (errors[key]) {
        const tabId = fieldToTabMap[key];
        if (tabId) {
          errorTabSet.add(tabId);
        }
      }
    }
    return errorTabSet;
  }, [fieldToTabMap, errors]);

  const hasTabError = useCallback(
    (tabId: string) => {
      return tabErrors.has(tabId);
    },
    [tabErrors]
  );

  const firstErrorTab = useMemo(() => {
    const errorKeys = Object.keys(errors);
    for (const key of errorKeys) {
      if (errors[key] && fieldToTabMap[key]) {
        return fieldToTabMap[key];
      }
    }
    return null;
  }, [fieldToTabMap, errors]);

  return {
    errorTabs: Array.from(tabErrors),
    hasTabError,
    firstErrorTab,
  };
}
