import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import thMessages from "@/messages/th.json";
import enMessages from "@/messages/en.json";
import { adminModuleKeyFromPath } from "@/lib/admin-nav";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const hrefsIn = (rel: string) => Array.from(read(rel).matchAll(/href: "(\/admin\/[^"]+)"/g), (m) => m[1]);

const SOURCES = [
  "src/components/layout/admin-sidebar.tsx",
  "src/components/layout/admin-mobile-drawer.tsx",
  "src/components/layout/admin-bottom-bar.tsx",
];

describe("admin navigation integrity", () => {
  const all = SOURCES.flatMap((s) => hrefsIn(s));

  it("finds links in the sidebar, drawer and bottom bar", () => {
    expect(hrefsIn(SOURCES[0]).length).toBeGreaterThan(10);
    expect(hrefsIn(SOURCES[1]).length).toBeGreaterThan(10);
    expect(hrefsIn(SOURCES[2]).length).toBeGreaterThan(0);
  });

  it.each(Array.from(new Set(all)))("%s resolves to an existing app route", (href) => {
    const page = path.join(root, "src/app/(admin)", href, "page.tsx");
    expect(fs.existsSync(page)).toBe(true);
  });

  it("keeps the sidebar and the drawer in sync", () => {
    expect(new Set(hrefsIn(SOURCES[0]))).toEqual(new Set(hrefsIn(SOURCES[1])));
  });

  it("derives a translated breadcrumb title for every nav route, including kebab-case ones", () => {
    for (const href of new Set(all)) {
      const key = adminModuleKeyFromPath(href);
      expect(Object.keys(thMessages.admin.nav)).toContain(key);
      expect(Object.keys(enMessages.admin.nav)).toContain(key);
    }
    expect(adminModuleKeyFromPath("/admin/lease-intents")).toBe("leaseIntents");
    expect(adminModuleKeyFromPath("/admin/work-orders/abc")).toBe("workOrders");
    expect(adminModuleKeyFromPath("/admin")).toBe("rack");
  });

  it("redirects the admin index to the rack route which exists", () => {
    expect(read("src/app/(admin)/admin/page.tsx")).toContain('redirect("/admin/rack")');
    expect(fs.existsSync(path.join(root, "src/app/(admin)/admin/rack/page.tsx"))).toBe(true);
  });
});
