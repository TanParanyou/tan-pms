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

/** Builds the API LocalizedText payload; an empty English text is omitted. */
export function toLocalizedText(th: string, en?: string | null): LocalizedTextDto {
  const english = en?.trim();
  return english ? { th: th.trim(), en: english } : { th: th.trim() };
}
