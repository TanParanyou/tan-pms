import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import { AdminWorkspaceProvider } from "@/components/shared/admin-workspace-provider";
import { PermissionProvider } from "@/hooks/use-permission";
import type { PropertyHierarchyResponse } from "@/generated/api";

export function renderAdmin(ui: React.ReactElement, permissions: string[] = ["*"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="th" messages={thMessages}>
        <PermissionProvider permissions={permissions}>
          <AdminWorkspaceProvider>{ui}</AdminWorkspaceProvider>
        </PermissionProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { ...result, queryClient };
}

export const unitRef = {
  id: "22222222-2222-2222-2222-222222222222",
  unitNumber: "B-201",
  buildingName: { th: "อาคาร B", en: "Building B" },
  floorNumber: 2,
  unitTypeName: { th: "สตูดิโอ", en: "Studio" },
};

export const customerRef = { id: "c1", fullName: "Somchai Jaidee", maskedNationalId: "1-XXXX" };

export const hierarchy = {
  property: { id: "p1", code: "BKK01", taxBranchCode: "00000", name: { th: "สาขา", en: "Branch" } },
  buildings: [{ id: "b1", code: "B", name: { th: "อาคาร B", en: "Building B" } }],
  unitTypes: [],
  units: [
    {
      id: unitRef.id,
      unitNumber: "B-201",
      building: { id: "b1", code: "B", name: { th: "อาคาร B", en: "Building B" } },
      floor: { id: "f1", floorNumber: 2, name: { th: "ชั้น 2", en: "Floor 2" } },
      unitType: { id: "t1", code: "STD", name: { th: "สตูดิโอ", en: "Studio" }, areaSqm: 24 },
      occupancyStatus: "Vacant",
      conditionStatus: "Clean",
      supportedStayModes: ["Monthly"],
      assets: [],
    },
  ],
} as unknown as PropertyHierarchyResponse;
