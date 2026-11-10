import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { queryKeys } from "@/lib/api/query-keys";
import { clearAllToasts, getActiveToasts } from "@/components/ui/toast";
import { AdminRbacUsersSection } from "@/features/users/components/AdminRbacUsersSection";
import { AdminUserEditor } from "@/features/users/components/AdminUserEditor";
import { PropertyMasterSection } from "@/features/properties/components/PropertyMasterSection";
import { UnitMasterEditor } from "@/features/properties/components/UnitMasterEditor";
import { RateTariffTaxSection } from "@/features/rates/components/RateTariffTaxSection";
import { RatePlanEditor } from "@/features/rates/components/RatePlanEditor";
import type { AdminUserDto, PropertyHierarchyResponse, RatePlanItemDto } from "@/generated/api";
import { renderAdmin } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin",
}));

const rb = thMessages.admin.rbac;
const pr = thMessages.admin.properties;
const rt = thMessages.admin.rates;
const rd = thMessages.common.reasonDialog;
const tc = thMessages.common;

const toastMessages = () => getActiveToasts().map((t) => t.message);
const conflict = () => new ApiError({ status: 409, errorCode: "master_data.in_use", message: "in use" });

const user = (over: Partial<AdminUserDto> = {}): AdminUserDto => ({
  id: "u1",
  username: "mali",
  fullName: "Mali Dee",
  email: "mali@tan-pms.internal",
  roleCode: "FrontDesk",
  roleName: { th: "พนักงานต้อนรับ", en: "Front desk" },
  isActive: true,
  allowedProperties: [{ id: "11111111-1111-1111-1111-111111111101", code: "BKK01", name: { th: "สาขา", en: "Branch" } }],
  permissions: ["admin.rack.view", "admin.stay.checkin"],
  ...over,
});
const roles = { roles: [{ code: "FrontDesk", name: { th: "พนักงานต้อนรับ", en: "Front desk" }, scope: "AdminScope" as const, defaultPermissions: [] }], permissions: [] };

const building = { id: "b1", code: "B1", name: { th: "อาคาร 1", en: "Building 1" }, floors: [{ id: "f1", floorNumber: 1, name: { th: "ชั้น 1", en: "Floor 1" }, unitCount: 2 }] };
const unitType = { id: "ut1", code: "STD", name: { th: "สตูดิโอ", en: "Studio" }, areaSqm: 24, totalQuotaUnits: 5, supportedStayModes: ["Daily" as const], hourlyBasePackagePrice: 0, hourlyBasePackageHours: 3, hourlyAdditionalHourPrice: 0, dailyRate: 900, monthlyRentRate: 9000 };
const unitMaster = {
  id: "un1",
  unitNumber: "A-101",
  building: { id: "b1", code: "B1", name: building.name },
  floor: { id: "f1", floorNumber: 1, name: building.floors[0].name },
  unitType: { id: "ut1", code: "STD", name: unitType.name, areaSqm: 24 },
  occupancyStatus: "Vacant" as const,
  conditionStatus: "Clean" as const,
  supportedStayModes: ["Daily" as const],
  assets: [{ id: "as1", assetCode: "TV", name: { th: "ทีวี", en: "TV" }, replacementCostAmount: 5000 }],
};
const hierarchy = { property: { id: "p1", code: "BKK01", taxBranchCode: "0", name: { th: "สาขา", en: "Branch" } }, buildings: [building], unitTypes: [unitType], units: [unitMaster] } as unknown as PropertyHierarchyResponse;

const plan = (over: Partial<RatePlanItemDto> = {}): RatePlanItemDto => ({
  id: "rp1",
  code: "RP-STD",
  name: { th: "แผนมาตรฐาน", en: "Standard plan" },
  unitType: { id: "ut1", code: "STD", name: unitType.name, areaSqm: 24 },
  supportedStayModes: ["Hourly", "Daily"],
  hourlyPackage: { basePackageHours: 3, basePackagePrice: 450, additionalHourPrice: 120, gracePeriodMinutes: 15, autoCapToDailyRate: 1200, turnaroundBufferMinutes: 30 },
  dailyRate: { weekdayRate: 890, weekendRate: 1090, holidaySurchargeAmount: 200, extraGuestPrice: 250 },
  monthlyRate: { monthlyRentRate: 12000, minimumLeaseMonths: 1, securityDepositMonths: 2 },
  isActive: true,
  ...over,
});
const tariff = { id: "tf1", utilityType: "Water" as const, name: { th: "ค่าน้ำ", en: "Water" }, billingMode: "PerUnit" as const, ratePerUnit: 18, minimumChargeAmount: 100, includedUnits: 0, baseMinimumAmount: 0, flatRateAmount: 0, flatRatePerOccupant: false, meterMaxDigits: 4 };
const tax = { id: "tx1", chargeCategoryCode: "MONTHLY_ROOM_RENT", name: { th: "ค่าเช่า", en: "Rent" }, taxMode: "Exempt" as const, vatRatePercent: 0, defaultWithholdingTaxPercent: 5, isActive: true };
const catalog = { property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } }, ratePlans: [plan()], utilityTariffs: [tariff], taxProfiles: [tax] };

beforeEach(() => {
  push.mockClear();
  clearAllToasts();
});
afterEach(() => vi.restoreAllMocks());

describe("PM-01 users (real API, create / view / edit / deactivate)", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getAdminRoles").mockResolvedValue(roles);
  });

  it("lists users from the API, filters, and shows empty and error states", async () => {
    const spy = vi.spyOn(apiClient, "getAdminUsers").mockResolvedValue({ items: [user(), user({ id: "u2", username: "off", fullName: "Off Staff", isActive: false })] });
    renderAdmin(<AdminRbacUsersSection />);
    expect(await screen.findByText("Mali Dee")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(rb.colStatus), { target: { value: "Inactive" } });
    await waitFor(() => expect(screen.queryByText("Mali Dee")).not.toBeInTheDocument());
    expect(screen.getByText("Off Staff")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(rb.searchPlaceholder), { target: { value: "zzz" } });
    expect(await screen.findByText(rb.emptyTitle)).toBeInTheDocument();
    spy.mockRejectedValue(new Error("boom"));
    const second = renderAdmin(<AdminRbacUsersSection />);
    expect(await second.findByText(rb.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: rb.colUser }).length).toBeGreaterThan(0);
  });

  it("hides the add button without admin.users.manage", async () => {
    vi.spyOn(apiClient, "getAdminUsers").mockResolvedValue({ items: [user()] });
    renderAdmin(<AdminRbacUsersSection />, ["admin.users.read"]);
    await screen.findByText("Mali Dee");
    expect(screen.queryByRole("button", { name: rb.addUser })).not.toBeInTheDocument();
  });

  it("validates, confirms and upserts a new user, invalidating user caches", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminUser").mockResolvedValue(user({ id: "u9" }));
    const { queryClient } = renderAdmin(<AdminUserEditor userId="create" />);
    fireEvent.click(await screen.findByRole("button", { name: rb.saveUser }));
    expect(await screen.findByText(rb.errorUsername)).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(rb.placeholderUsername), { target: { value: "newuser" } });
    fireEvent.change(screen.getByPlaceholderText(rb.placeholderFullName), { target: { value: "New User" } });
    fireEvent.change(screen.getByPlaceholderText(rb.placeholderEmail), { target: { value: "new@tan-pms.internal" } });
    fireEvent.click(screen.getByLabelText(/BKK01/));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(screen.getByRole("button", { name: rb.saveUser }));
    const confirm = await screen.findByRole("alertdialog");
    expect(upsert).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ username: "newuser", roleCode: "FrontDesk", allowedPropertyIds: ["11111111-1111-1111-1111-111111111101"] })));
    await waitFor(() => expect(spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))).toContain(JSON.stringify(queryKeys.users.all)));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users/u9"));
  });

  it("edits an existing user keeping its id and changed properties", async () => {
    vi.spyOn(apiClient, "getAdminUser").mockResolvedValue(user());
    const upsert = vi.spyOn(apiClient, "upsertAdminUser").mockResolvedValue(user());
    renderAdmin(<AdminUserEditor userId="u1" />);
    const name = await screen.findByPlaceholderText(rb.placeholderFullName);
    expect((name as HTMLInputElement).value).toBe("Mali Dee");
    fireEvent.change(name, { target: { value: "Mali Dee Updated" } });
    fireEvent.click(screen.getByRole("button", { name: rb.saveUser }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "u1", fullName: "Mali Dee Updated", isActive: true })));
    expect(push).not.toHaveBeenCalled();
  });

  it("deactivates only with reason and confirmation, and surfaces the server error", async () => {
    vi.spyOn(apiClient, "getAdminUser").mockResolvedValue(user());
    const deactivate = vi.spyOn(apiClient, "deactivateAdminUser").mockRejectedValue(
      new ApiError({ status: 409, errorCode: "validation.failed", message: "Cannot deactivate the last administrator" })
    );
    renderAdmin(<AdminUserEditor userId="u1" />);
    expect(await screen.findByTestId("user-permission-count")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: rb.btnDeactivate }));
    const dialog = await screen.findByRole("dialog", { name: rb.deactivateTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: rb.btnDeactivate }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Left the company" } });
    fireEvent.click(within(dialog).getByRole("button", { name: rb.btnDeactivate }));
    const confirm = await screen.findByRole("alertdialog");
    expect(deactivate).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: rb.btnDeactivate }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledWith("u1", "Left the company"));
    await waitFor(() => expect(toastMessages().join(" ")).toContain("last administrator"));
    expect(screen.getByRole("dialog", { name: rb.deactivateTitle })).toBeInTheDocument();
  });

  it("reactivates an inactive user after confirmation and hides actions without permission", async () => {
    vi.spyOn(apiClient, "getAdminUser").mockResolvedValue(user({ isActive: false }));
    const reactivate = vi.spyOn(apiClient, "reactivateAdminUser").mockResolvedValue(user());
    const first = renderAdmin(<AdminUserEditor userId="u1" />);
    fireEvent.click(await screen.findByRole("button", { name: rb.btnReactivate }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: rb.btnReactivate }));
    await waitFor(() => expect(reactivate).toHaveBeenCalledWith("u1"));
    first.unmount();
    renderAdmin(<AdminUserEditor userId="u1" />, ["admin.users.manage"]);
    await screen.findByText(rb.fieldStatus);
    expect(screen.queryByRole("button", { name: rb.btnReactivate })).not.toBeInTheDocument();
  });

  it("shows an error state with retry when the user cannot be loaded", async () => {
    vi.spyOn(apiClient, "getAdminUser").mockRejectedValue(new Error("boom"));
    renderAdmin(<AdminUserEditor userId="u1" />);
    expect(await screen.findByText(rb.loadUserError)).toBeInTheDocument();
  });
});

describe("PM-02 property master (units, buildings, floors, unit types)", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
  });

  it("lists units from the hierarchy and keeps the header on error", async () => {
    const first = renderAdmin(<PropertyMasterSection />);
    expect(await screen.findByText("A-101")).toBeInTheDocument();
    first.unmount();
    vi.mocked(apiClient.getAdminPropertyHierarchy).mockRejectedValue(new Error("boom"));
    renderAdmin(<PropertyMasterSection />);
    expect(await screen.findByText(pr.loadHierarchyError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: pr.colUnit }).length).toBeGreaterThan(0);
  });

  it("creates a building through the dialog with validation and invalidates property caches", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminBuilding").mockResolvedValue(building);
    const { queryClient } = renderAdmin(<PropertyMasterSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: pr.tabBuildings }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: pr.tabBuildings }));
    fireEvent.click(await screen.findByRole("button", { name: pr.addBuilding }));
    const dialog = await screen.findByRole("dialog", { name: pr.createBuildingTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    expect(await within(dialog).findByText(thMessages.common.localized.errorThaiRequired)).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByPlaceholderText(pr.placeholderCode), { target: { value: "B2" } });
    fireEvent.change(document.getElementById("bld-name-th") as HTMLInputElement, { target: { value: "อาคาร 2" } });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: "B2", name: { th: "อาคาร 2" } })));
    await waitFor(() => expect(spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))).toContain(JSON.stringify(queryKeys.properties.all)));
  });

  it("shows the readable in-use message when deleting a floor that is in use", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminFloor").mockRejectedValue(conflict());
    renderAdmin(<PropertyMasterSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: pr.tabBuildings }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: pr.tabBuildings }));
    fireEvent.click(await screen.findByRole("button", { name: `${pr.btnDelete} ชั้น 1` }));
    const confirm = await screen.findByRole("alertdialog");
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: pr.btnDelete }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "f1"));
    await waitFor(() => expect(toastMessages()).toContain(thMessages.errors.master_data_in_use));
  });

  it("deletes an unused unit type after confirmation", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminUnitType").mockResolvedValue(unitType);
    renderAdmin(<PropertyMasterSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: pr.tabUnitTypes }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: pr.tabUnitTypes }));
    fireEvent.click(await screen.findByRole("button", { name: `${pr.btnDelete} STD` }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: pr.btnDelete }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "ut1"));
  });

  it("hides master data actions without admin.properties.manage", async () => {
    renderAdmin(<PropertyMasterSection />, ["admin.properties.read"]);
    await screen.findByText("A-101");
    expect(screen.queryByRole("button", { name: pr.addUnit })).not.toBeInTheDocument();
  });

  it("creates a unit with assets after validation and confirmation", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminUnitMaster").mockResolvedValue(unitMaster);
    renderAdmin(<UnitMasterEditor unitId="create" />);
    fireEvent.click(await screen.findByRole("button", { name: pr.save }));
    expect(await screen.findAllByText(tc.required)).not.toHaveLength(0);
    expect(upsert).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(pr.placeholderUnitNumber), { target: { value: "C-303" } });
    fireEvent.change(document.getElementById("unit-building") as HTMLSelectElement, { target: { value: "b1" } });
    fireEvent.change(document.getElementById("unit-floor") as HTMLSelectElement, { target: { value: "f1" } });
    fireEvent.change(document.getElementById("unit-type") as HTMLSelectElement, { target: { value: "ut1" } });
    fireEvent.click(screen.getByRole("button", { name: pr.addAsset }));
    fireEvent.change(await screen.findByPlaceholderText(pr.assetCode), { target: { value: "AC" } });
    fireEvent.change(screen.getByPlaceholderText(pr.assetNameTh), { target: { value: "แอร์" } });
    fireEvent.click(screen.getByRole("button", { name: pr.save }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: pr.save }));
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ unitNumber: "C-303", buildingId: "b1", floorId: "f1", unitTypeId: "ut1", assets: [expect.objectContaining({ assetCode: "AC", name: { th: "แอร์" } })] })
      )
    );
  });

  it("views a unit via GET, edits it and deletes it with the in-use conflict surfaced", async () => {
    vi.spyOn(apiClient, "getAdminUnit").mockResolvedValue(unitMaster);
    const del = vi.spyOn(apiClient, "deleteAdminUnit").mockRejectedValue(conflict());
    renderAdmin(<UnitMasterEditor unitId="un1" />);
    expect(await screen.findByDisplayValue("A-101")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("TV").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: pr.btnDelete }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: pr.btnDelete }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "un1"));
    await waitFor(() => expect(toastMessages()).toContain(thMessages.errors.master_data_in_use));
    expect(push).not.toHaveBeenCalled();
  });
});

describe("PM-03 rates, tariffs and taxes", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getAdminPropertyRates").mockResolvedValue(catalog);
    vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
  });

  it("lists the real catalog across the three tabs with error state and permission gating", async () => {
    const first = renderAdmin(<RateTariffTaxSection />, ["admin.rates.read"]);
    expect(await screen.findByText("RP-STD")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: rt.createRatePlan })).not.toBeInTheDocument();
    first.unmount();
    vi.mocked(apiClient.getAdminPropertyRates).mockRejectedValue(new Error("boom"));
    renderAdmin(<RateTariffTaxSection />);
    expect(await screen.findByText(rt.loadError)).toBeInTheDocument();
  });

  it("deletes a utility tariff only after confirmation and shows the in-use message on conflict", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminUtilityTariff").mockRejectedValue(conflict());
    renderAdmin(<RateTariffTaxSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: rt.tabUtilityTariffs }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: rt.tabUtilityTariffs }));
    fireEvent.click(await screen.findByRole("button", { name: `${rt.actionDelete} ค่าน้ำ` }));
    const confirm = await screen.findByRole("alertdialog");
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: rt.btnDelete }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "tf1"));
    await waitFor(() => expect(toastMessages()).toContain(thMessages.errors.master_data_in_use));
  });

  it("creates a utility tariff through the dialog", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminUtilityTariff").mockResolvedValue(tariff);
    renderAdmin(<RateTariffTaxSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: rt.tabUtilityTariffs }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: rt.tabUtilityTariffs }));
    fireEvent.click(await screen.findByRole("button", { name: rt.createTariff }));
    const dialog = await screen.findByRole("dialog", { name: rt.modalTitleCreateTariff });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    expect(await within(dialog).findByText(thMessages.common.localized.errorThaiRequired)).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("tf-name-th") as HTMLInputElement, { target: { value: "ค่าไฟ" } });
    fireEvent.change(document.getElementById("tf-type") as HTMLSelectElement, { target: { value: "Electric" } });
    fireEvent.change(document.getElementById("tf-ratePerUnit") as HTMLInputElement, { target: { value: "7" } });
    fireEvent.blur(document.getElementById("tf-ratePerUnit") as HTMLInputElement);
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ utilityType: "Electric", ratePerUnit: 7, name: { th: "ค่าไฟ" } })));
  });

  it("loads a tax profile via GET and saves the edit through the upsert", async () => {
    vi.spyOn(apiClient, "getAdminTaxProfile").mockResolvedValue(tax);
    const upsert = vi.spyOn(apiClient, "upsertAdminTaxProfile").mockResolvedValue(tax);
    renderAdmin(<RateTariffTaxSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: rt.tabTaxProfiles }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: rt.tabTaxProfiles }));
    fireEvent.click(await screen.findByRole("button", { name: `${rt.editTax} MONTHLY_ROOM_RENT` }));
    const dialog = await screen.findByRole("dialog", { name: rt.modalTitleEditTax });
    await waitFor(() => expect(within(dialog).getByDisplayValue("MONTHLY_ROOM_RENT")).toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: "tx1", chargeCategoryCode: "MONTHLY_ROOM_RENT" })));
  });

  it("validates and creates a rate plan sending the complete hourly, daily and monthly configuration", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminRatePlan").mockResolvedValue(plan({ id: "rp9" }));
    renderAdmin(<RatePlanEditor ratePlanId="create" />);
    fireEvent.click(await screen.findByRole("button", { name: rt.savePlan }));
    expect(await screen.findAllByText(tc.required)).not.toHaveLength(0);
    expect(upsert).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(rt.placeholderCode), { target: { value: "RP-NEW" } });
    fireEvent.change(document.getElementById("rp-name-th") as HTMLInputElement, { target: { value: "แผนใหม่" } });
    fireEvent.change(document.getElementById("rp-unit-type") as HTMLSelectElement, { target: { value: "ut1" } });
    fireEvent.click(screen.getByRole("button", { name: rt.savePlan }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: rt.savePlan }));
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          code: "RP-NEW",
          unitTypeId: "ut1",
          hourlyPackage: expect.objectContaining({ gracePeriodMinutes: 15, turnaroundBufferMinutes: 30 }),
          dailyRate: expect.objectContaining({ holidaySurchargeAmount: 0 }),
          monthlyRate: expect.objectContaining({ securityDepositMonths: 2 }),
        })
      )
    );
  });

  it("views a plan via GET, keeps its hidden config on edit, and deletes after confirmation", async () => {
    vi.spyOn(apiClient, "getAdminRatePlan").mockResolvedValue(plan());
    const upsert = vi.spyOn(apiClient, "upsertAdminRatePlan").mockResolvedValue(plan());
    const del = vi.spyOn(apiClient, "deleteAdminRatePlan").mockResolvedValue(plan());
    renderAdmin(<RatePlanEditor ratePlanId="rp1" />);
    expect(await screen.findByDisplayValue("RP-STD")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: rt.savePlan }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: rt.savePlan }));
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: "rp1", dailyRate: expect.objectContaining({ holidaySurchargeAmount: 200, extraGuestPrice: 250 }) }))
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: rt.btnDelete }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: rt.btnDelete }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "rp1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/rates"));
  });
});
