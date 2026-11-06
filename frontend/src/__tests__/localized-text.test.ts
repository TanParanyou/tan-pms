import { describe, it, expect } from "vitest";
import { resolveLocalizedText, type LocalizedTextDto } from "@/lib/i18n/localized-text";

describe("resolveLocalizedText", () => {
  const sampleText: LocalizedTextDto = {
    th: "อาคาร A",
    en: "Building A",
  };

  it("returns Thai text when locale is 'th'", () => {
    expect(resolveLocalizedText(sampleText, "th")).toBe("อาคาร A");
  });

  it("returns English text when locale is 'en' and en is present", () => {
    expect(resolveLocalizedText(sampleText, "en")).toBe("Building A");
  });

  it("falls back to Thai when locale is 'en' but en is null or whitespace", () => {
    const withoutEn: LocalizedTextDto = { th: "อาคาร B", en: null };
    expect(resolveLocalizedText(withoutEn, "en")).toBe("อาคาร B");

    const emptyEn: LocalizedTextDto = { th: "อาคาร C", en: "   " };
    expect(resolveLocalizedText(emptyEn, "en")).toBe("อาคาร C");
  });

  it("returns '-' when value is null or undefined", () => {
    expect(resolveLocalizedText(null, "th")).toBe("-");
    expect(resolveLocalizedText(undefined, "en")).toBe("-");
  });
});
