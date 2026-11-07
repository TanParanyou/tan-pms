import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { AdminWorkspaceProvider } from "@/components/shared/admin-workspace-provider";
import { PermissionProvider } from "@/hooks/use-permission";
import { LeasesListSection } from "@/features/leases/components/LeasesListSection";
import { LeaseDetailEditor } from "@/features/leases/components/LeaseDetailEditor";
import { LeaseCreateEditor } from "@/features/leases/components/LeaseCreateEditor";
import type { LeaseItemDto, LeaseListResponse, CustomerListResponse } from "@/features/leases/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/leases",
}));

const lease: LeaseItemDto = {
  id: "11111111-1111-1111-1111-111111111111",
  documentNumber: "BKK01-LSE-2611-0001",
  status: "MoveOutNotice",
  unit: {
    id: "22222222-2222-2222-2222-222222222222",
    unitNumber: "B-201",
    buildingName: { th: "อาคาร B", en: "Building B" },
    floorNumber: 2,
    unitTypeName: { th: "สตูดิโอ", en: "Studio" },
  },
  customer: {
    id: "33333333-3333-3333-3333-333333333333",
    fullName: "Somchai Jaidee",
    maskedNationalId: "1-1004-XXXXX-91-2",
  },
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  monthlyRentAmount: 8500,
  securityDepositAmount: 17000,
  securityDepositBalance: 17000,
  initialWaterMeterReading: 10,
  initialElectricMeterReading: 100,
  occupants: [],
  vehicles: [
    { id: "v1", licensePlate: "1กข-1234", province: "Bangkok", vehicleBrandModel: "Honda City" },
  ],
};

function renderWith(ui: React.ReactElement, permissions: string[] = ["*"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="th" messages={thMessages}>
        <PermissionProvider permissions={permissions}>
          <AdminWorkspaceProvider>{ui}</AdminWorkspaceProvider>
        </PermissionProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const customers: CustomerListResponse = { items: [lease.customer] };

let getLeases: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  const response: LeaseListResponse = { items: [lease] };
  getLeases = vi.spyOn(apiClient, "getAdminLeases").mockResolvedValue(response);
  vi.spyOn(apiClient, "getAdminLease").mockResolvedValue(lease);
  vi.spyOn(apiClient, "searchAdminCustomers").mockResolvedValue(customers);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PM-06: Monthly leases UI", () => {
  it("renders lease list with headers, row data and plate", async () => {
    const { container } = renderWith(<LeasesListSection />);
    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(await screen.findByText("BKK01-LSE-2611-0001")).toBeInTheDocument();
    expect(screen.getByText("1กข-1234")).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.leases.colDepositBalance)).toBeInTheDocument();
  });

  it("sends licensePlate query param after debounce", async () => {
    renderWith(<LeasesListSection />);
    await screen.findByText("BKK01-LSE-2611-0001");
    fireEvent.change(screen.getByPlaceholderText(thMessages.admin.leases.searchPlatePlaceholder), {
      target: { value: "1กข" },
    });
    await waitFor(() =>
      expect(getLeases).toHaveBeenCalledWith(expect.any(String), {
        status: undefined,
        licensePlate: "1กข",
      })
    );
  });

  it("hides settle move-out button without settle permission", async () => {
    renderWith(<LeaseDetailEditor leaseId={lease.id} />, ["admin.leases.manage"]);
    await screen.findByText(lease.documentNumber);
    expect(screen.queryByText(thMessages.admin.leases.btnSettleMoveOut)).not.toBeInTheDocument();
  });

  it("shows enabled settle button with settle permission on MoveOutNotice lease", async () => {
    renderWith(<LeaseDetailEditor leaseId={lease.id} />, ["admin.leases.settle_moveout"]);
    const btn = await screen.findByText(thMessages.admin.leases.btnSettleMoveOut);
    expect(btn.closest("button")).not.toBeDisabled();
  });

  it("searches customers via API with debounce and shows name-first options", async () => {
    const search = vi.spyOn(apiClient, "searchAdminCustomers");
    renderWith(<LeaseCreateEditor />);
    fireEvent.click(screen.getByLabelText(thMessages.admin.leases.fieldCustomer, { exact: false }));
    fireEvent.change(await screen.findByPlaceholderText(thMessages.admin.leases.placeholderCustomer), {
      target: { value: "Som" },
    });
    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.any(String), "Som"));
    expect(await screen.findByText("Somchai Jaidee (1-1004-XXXXX-91-2)")).toBeInTheDocument();
  });

  it("create form validation does not call the API when required fields are empty", async () => {
    const create = vi.spyOn(apiClient, "createAdminLease");
    renderWith(<LeaseCreateEditor />);
    fireEvent.click(screen.getByText(thMessages.admin.leases.btnSaveLease));
    await waitFor(() => expect(screen.getByTestId("tab-error-dot-tab-lease-terms")).toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });
});
