import type { components } from "@/generated/api/tan-pms.v1";

export type LocalizedTextDto = components["schemas"]["LocalizedTextDto"];

export function resolveLocalizedText(
  value: LocalizedTextDto | null | undefined,
  locale: "th" | "en"
): string {
  if (!value) return "-";
  if (locale === "en" && value.en && value.en.trim().length > 0) {
    return value.en;
  }
  return value.th;
}
