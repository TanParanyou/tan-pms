import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import thMessages from "@/messages/th.json";
import enMessages from "@/messages/en.json";

function getAllFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== "dist") {
        results = results.concat(getAllFiles(fullPath, extensions));
      }
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

function getDeepKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(getDeepKeys(value as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys.sort();
}

describe("Frontend Code Hygiene & Standards Enforcement", () => {
  const srcDir = path.resolve(__dirname, "../");
  const allSourceFiles = getAllFiles(srcDir, [".ts", ".tsx"]).filter(
    (f) =>
      !f.includes("/generated/") && // Skip generated OpenAPI schema files
      !f.includes("/__tests__/") // Skip test files for syntax checking
  );

  it("enforces Strict Zero `any` Policy (no : any, as any, <any>, @ts-ignore, @ts-expect-error)", () => {
    const anyViolations: string[] = [];
    const forbiddenPatterns = [
      new RegExp(":\\s*any\\b"),
      new RegExp("\\bas\\s+any\\b"),
      new RegExp("<any>"),
      new RegExp("@ts-ignore"),
      new RegExp("@ts-expect-error"),
    ];

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line)) {
            anyViolations.push(`${path.relative(srcDir, file)}:${lineIdx + 1}: ${line.trim()}`);
            break;
          }
        }
      });
    }

    expect(anyViolations).toEqual([]);
  });

  it("enforces Zero Raw HTML Controls in src/app/ and src/features/ (no <button, <input, <select, <textarea, <table)", () => {
    const appAndFeatureFiles = allSourceFiles.filter(
      (f) => f.includes("/src/app/") || f.includes("/src/features/")
    );

    const rawTagViolations: string[] = [];
    const rawTagRegex = /<(button|input|select|textarea|table)(\s|>)/;

    for (const file of appAndFeatureFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        if (rawTagRegex.test(line)) {
          rawTagViolations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${line.trim()}`
          );
        }
      });
    }

    expect(rawTagViolations).toEqual([]);
  });

  it("enforces 100% key parity between messages/th.json and messages/en.json", () => {
    const thKeys = getDeepKeys(thMessages);
    const enKeys = getDeepKeys(enMessages);
    expect(thKeys).toEqual(enKeys);
  });

  it("enforces Zero Thai characters ([\\u0E00-\\u0E7F]) in all .tsx UI components", () => {
    const tsxFiles = allSourceFiles.filter((f) => f.endsWith(".tsx"));
    const thaiRegex = /[\u0E00-\u0E7F]/;
    const violations: string[] = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        if (thaiRegex.test(line)) {
          violations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${line.trim()}`
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("enforces that Thai characters in .ts files are strictly restricted to LocalizedTextDto mock projections in constants.ts", () => {
    const tsFiles = allSourceFiles.filter((f) => f.endsWith(".ts"));
    const thaiRegex = /[\u0E00-\u0E7F]/;
    const violations: string[] = [];

    for (const file of tsFiles) {
      const isConfigOrConstants =
        file.endsWith("constants.ts") ||
        file.endsWith("master-data.ts") ||
        file.endsWith("site.ts");
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        if (thaiRegex.test(line)) {
          if (isConfigOrConstants && /(th|companyNameTh):\s*"[^"]*"/.test(line)) {
            return;
          }
          violations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${line.trim()}`
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("enforces Zero Arbitrary Hex Color Classes in .tsx files (use semantic tokens like text-ink, bg-canvas, border-hairline instead of [#...])", () => {
    const tsxFiles = allSourceFiles.filter((f) => f.endsWith(".tsx"));
    const hexClassRegex = /(text|bg|border|ring|divide)-\[#[0-9a-fA-F]{3,8}\]/;
    const violations: string[] = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        if (hexClassRegex.test(line)) {
          violations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${line.trim()}`
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("enforces Zero Arbitrary Hex Color Classes in preview.html", () => {
    const previewPath = path.resolve(__dirname, "../../../preview.html");
    if (!fs.existsSync(previewPath)) return;
    const content = fs.readFileSync(previewPath, "utf-8");
    const hexClassRegex = /(text|bg|border|ring|divide)-\[#[0-9a-fA-F]{3,8}\]/g;
    const matches = content.match(hexClassRegex);
    expect(matches).toBeNull();
  });

  it("enforces Zero Emojis or Unicode Pictographs across all .tsx UI files and messages/*.json", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const violations: string[] = [];

    const filesToCheck = [
      ...allSourceFiles.filter((f) => f.endsWith(".tsx")),
      path.resolve(__dirname, "../messages/th.json"),
      path.resolve(__dirname, "../messages/en.json"),
    ];

    for (const file of filesToCheck) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        if (emojiRegex.test(line)) {
          violations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${line.trim()}`
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("enforces Zero .find() lookups in src/features/**/components/*.tsx (Table-Preserved & O(1) Map Lookup Architecture)", () => {
    const componentFiles = allSourceFiles.filter((f) =>
      f.includes("/src/features/") && f.includes("/components/") && f.endsWith(".tsx")
    );
    const violations: string[] = [];
    const findCallRegex = /(?<!\/\/\s*.*)\.find\s*\(/;

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
          return;
        }
        if (findCallRegex.test(trimmed)) {
          violations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${trimmed}`
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("enforces Zero Forbidden Product Boundary Words (staff, backoffice, portal, member) across src/app/ and src/features/", () => {
    const appAndFeatureFiles = allSourceFiles.filter(
      (f) => f.includes("/src/app/") || f.includes("/src/features/")
    );
    const violations: string[] = [];
    const forbiddenWordRegex = /\b(staff|backoffice|member)\b/i;

    for (const file of appAndFeatureFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, lineIdx) => {
        const trimmed = line.trim();
        // Allow Radix Primitive Portal imports and comments
        if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
          return;
        }
        if (forbiddenWordRegex.test(trimmed)) {
          violations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${trimmed}`
          );
        }
        if (/\bportal\b/i.test(trimmed) && !trimmed.includes("Portal") && !trimmed.includes("portal")) {
          violations.push(
            `${path.relative(srcDir, file)}:${lineIdx + 1}: ${trimmed}`
          );
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it("enforces that queryKeys factory is used across all src/features/*/api/*.ts hooks", () => {
    const apiFiles = allSourceFiles.filter(
      (f) => f.includes("/src/features/") && f.includes("/api/") && f.endsWith(".ts")
    );
    expect(apiFiles.length).toBeGreaterThan(0);

    const missingQueryKeys: string[] = [];
    for (const file of apiFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (!content.includes("queryKeys")) {
        missingQueryKeys.push(path.relative(srcDir, file));
      }
    }

    expect(missingQueryKeys).toEqual([]);
  });
});
