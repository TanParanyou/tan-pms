import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
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
import type { PropertyHierarchyResponse } from "@/generated/api";
import { queryKeys } from "@/lib/api/query-keys";
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

const hierarchy = {
  property: { id: "p1", code: "BKK01", taxBranchCode: "00000", name: { th: "สาขา", en: "Branch" } },
  buildings: [],
  unitTypes: [],
  units: [
    {
      id: "22222222-2222-2222-2222-222222222222",
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

async function renderCreateReady() {
  const result = renderWith(<LeaseCreateEditor />);
  await waitFor(() =>
    expect(screen.getByText(thMessages.admin.leases.btnSaveLease).closest("button")).not.toBeDisabled()
  );
  return result;
}

function fillOccupant() {
  const l = thMessages.admin.leases;
  fireEvent.change(screen.getByPlaceholderText(thMessages.common.placeholders.guestName), {
    target: { value: "Mali Dee" },
  });
  fireEvent.change(screen.getByPlaceholderText(thMessages.common.placeholders.nationalId), {
    target: { value: "1234567890123" },
  });
  return l;
}

const customers: CustomerListResponse = { items: [lease.customer] };

let getLeases: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  const response: LeaseListResponse = { items: [lease] };
  getLeases = vi.spyOn(apiClient, "getAdminLeases").mockResolvedValue(response);
  vi.spyOn(apiClient, "getAdminLease").mockResolvedValue(lease);
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
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
        page: 1,
        pageSize: 25,
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
    await renderCreateReady();
    fireEvent.click(screen.getByText(thMessages.admin.leases.btnSaveLease));
    await waitFor(() => expect(screen.getByTestId("tab-error-dot-tab-lease-terms")).toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });

  it("invalidates properties, rack, availability and stays caches before finishing a mutation", async () => {
    vi.spyOn(apiClient, "addAdminLeaseOccupant").mockResolvedValue(lease);
    const { queryClient } = renderWith(<LeaseDetailEditor leaseId={lease.id} />);
    await screen.findByText(lease.documentNumber);
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fillOccupant();
    fireEvent.submit(screen.getByText(thMessages.admin.leases.btnAddOccupant).closest("form")!);
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.properties.all));
      expect(keys).toContain(JSON.stringify(queryKeys.rack.all));
      expect(keys).toContain(JSON.stringify(queryKeys.availability.all));
      expect(keys).toContain(JSON.stringify(queryKeys.stays.all));
    });
  });

  it("guards double submit and disables every action while a mutation is pending", async () => {
    vi.mocked(apiClient.getAdminLease).mockResolvedValue({ ...lease, status: "Active" });
    let resolve: (v: LeaseItemDto) => void = () => undefined;
    const add = vi.spyOn(apiClient, "addAdminLeaseOccupant").mockImplementation(
      () => new Promise<LeaseItemDto>((r) => { resolve = r; })
    );
    renderWith(<LeaseDetailEditor leaseId={lease.id} />);
    await screen.findByText(lease.documentNumber);
    fillOccupant();
    const form = screen.getByText(thMessages.admin.leases.btnAddOccupant).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByText(thMessages.admin.leases.btnRenew).closest("button")).toBeDisabled()
    );
    expect(screen.getByText(thMessages.admin.leases.btnMoveOutNotice).closest("button")).toBeDisabled();
    expect(screen.getByText(thMessages.admin.leases.btnAddVehicle).closest("button")).toBeDisabled();
    fireEvent.submit(form);
    await act(async () => { await Promise.resolve(); });
    expect(add).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(lease); });
  });

  it("shows an error state when customer search fails", async () => {
    vi.mocked(apiClient.searchAdminCustomers).mockRejectedValue(new Error("boom"));
    renderWith(<LeaseCreateEditor />);
    expect(await screen.findByText(thMessages.admin.leases.customerSearchError)).toBeInTheDocument();
  });

  it("keeps user input and does not navigate when create fails", async () => {
    const create = vi.spyOn(apiClient, "createAdminLease").mockRejectedValue(new Error("unit not vacant"));
    await renderCreateReady();
    const l = thMessages.admin.leases;
    fireEvent.click(screen.getByLabelText(l.fieldUnit, { exact: false }));
    fireEvent.click(await screen.findByText(/สตูดิโอ \(B-201\)/));
    fireEvent.click(screen.getByLabelText(l.fieldCustomer, { exact: false }));
    fireEvent.click(await screen.findByText("Somchai Jaidee (1-1004-XXXXX-91-2)"));
    fireEvent.change(screen.getByLabelText(l.fieldStartDate, { exact: false }), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(l.fieldEndDate, { exact: false }), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText(l.fieldMonthlyRent, { exact: false }), { target: { value: "8500" } });
    fireEvent.blur(screen.getByLabelText(l.fieldMonthlyRent, { exact: false }));
    fireEvent.click(screen.getByText(l.btnSaveLease));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByText(l.btnSaveLease));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(l.fieldEndDate, { exact: false })).toHaveValue("2026-12-31");
    expect(screen.getByLabelText(l.fieldStartDate, { exact: false })).toHaveValue("2026-01-01");
  });

  it("shows an error state with retry and blocks save when the unit hierarchy fails", async () => {
    const h = vi.mocked(apiClient.getAdminPropertyHierarchy);
    h.mockRejectedValue(new Error("down"));
    renderWith(<LeaseCreateEditor />);
    expect(await screen.findByText(thMessages.admin.leases.unitsLoadError)).toBeInTheDocument();
    expect(screen.getByText(thMessages.admin.leases.btnSaveLease).closest("button")).toBeDisabled();
    h.mockResolvedValue(hierarchy);
    const retryButtons = screen.getAllByText(thMessages.admin.leases.btnRetry);
    fireEvent.click(retryButtons[0]);
    await waitFor(() =>
      expect(screen.getByText(thMessages.admin.leases.btnSaveLease).closest("button")).not.toBeDisabled()
    );
  });

  it("offers only real API unit ids (no sample data)", async () => {
    await renderCreateReady();
    fireEvent.click(screen.getByLabelText(thMessages.admin.leases.fieldUnit, { exact: false }));
    expect(await screen.findByText(/สตูดิโอ \(B-201\)/)).toBeInTheDocument();
    expect(screen.queryByText(/A-101/)).not.toBeInTheDocument();
  });
});
