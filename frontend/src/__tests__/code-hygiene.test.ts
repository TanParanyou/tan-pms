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
});
