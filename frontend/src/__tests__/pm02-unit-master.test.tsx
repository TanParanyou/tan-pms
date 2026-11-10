import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { queryKeys } from "@/lib/api/query-keys";
import { clearAllToasts, getActiveToasts } from "@/components/ui/toast";
import { PropertyMasterSection } from "@/features/properties/components/PropertyMasterSection";
import { UnitMasterEditor } from "@/features/properties/components/UnitMasterEditor";
import type { PropertyHierarchyResponse } from "@/generated/api";
import { renderAdmin } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/properties",
}));

const pr = thMessages.admin.properties;
const tc = thMessages.common;
const toastMessages = () => getActiveToasts().map((t) => t.message);

const buildingA = { id: "b1", code: "BA", name: { th: "อาคาร เอ", en: "Building A" }, floors: [{ id: "f1", floorNumber: 1, name: { th: "ชั้น 1", en: "Floor 1" }, unitCount: 2 }, { id: "f2", floorNumber: 2, name: { th: "ชั้น 2", en: "Floor 2" }, unitCount: 0 }] };
const buildingB = { id: "b2", code: "BB", name: { th: "อาคาร บี", en: "Building B" }, floors: [{ id: "f3", floorNumber: 1, name: { th: "ชั้น หนึ่ง", en: "Floor one" }, unitCount: 1 }] };
const studio = { id: "ut1", code: "STD", name: { th: "สตูดิโอ", en: "Studio" }, areaSqm: 24, totalQuotaUnits: 5, supportedStayModes: ["Hourly" as const, "Daily" as const], hourlyBasePackagePrice: 450, hourlyBasePackageHours: 3, hourlyAdditionalHourPrice: 120, dailyRate: 900, monthlyRentRate: 9000 };
const unit = (id: string, no: string, b: typeof buildingA, status = "Vacant") => ({
  id,
  unitNumber: no,
  building: { id: b.id, code: b.code, name: b.name },
  floor: { id: b.floors[0].id, floorNumber: 1, name: b.floors[0].name },
  unitType: { id: "ut1", code: "STD", name: studio.name, areaSqm: 24 },
  occupancyStatus: status as "Vacant",
  conditionStatus: "Clean" as const,
  supportedStayModes: ["Hourly" as const, "Daily" as const],
  assets: [
    { id: "as1", assetCode: "TV", name: { th: "ทีวี", en: "Smart TV" }, replacementCostAmount: 5000 },
    { id: "as2", assetCode: "AC", name: { th: "แอร์", en: "Air" }, replacementCostAmount: 12000 },
  ],
});
const hierarchy = { property: { id: "p1", code: "BKK01", taxBranchCode: "0", name: { th: "สาขา", en: "B" } }, buildings: [buildingA, buildingB], unitTypes: [studio], units: [unit("un1", "A-101", buildingA), unit("un2", "B-201", buildingB, "Occupied")] } as unknown as PropertyHierarchyResponse;
const conflict = () => new ApiError({ status: 409, errorCode: "master_data.in_use", message: "in use" });
const openTab = async (name: string) => {
  fireEvent.mouseDown(await screen.findByRole("tab", { name }), { button: 0 });
  fireEvent.click(screen.getByRole("tab", { name }));
};

beforeEach(() => {
  push.mockClear();
  clearAllToasts();
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
});
afterEach(() => vi.restoreAllMocks());

describe("PM-02 unit master list and hierarchy tabs", () => {
  it("renders the units table with status badges, asset counts and filters that keep the header", async () => {
    const { container } = renderAdmin(<PropertyMasterSection />);
    expect(await screen.findByText("A-101")).toBeInTheDocument();
    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(screen.getByText("B-201")).toBeInTheDocument();
    expect(screen.getAllByText(pr.statusOccupied).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(pr.fieldBuilding), { target: { value: "b2" } });
    await waitFor(() => expect(screen.queryByText("A-101")).not.toBeInTheDocument());
    expect(screen.getByText("B-201")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(pr.searchPlaceholder), { target: { value: "no-such-unit" } });
    expect(await screen.findByText(pr.emptyTitle)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: pr.colUnit }).length).toBeGreaterThan(0);
  });

  it("lists buildings, floors and unit types from the hierarchy on their tabs", async () => {
    renderAdmin(<PropertyMasterSection />);
    await openTab(pr.tabBuildings);
    expect(await screen.findByText("BA")).toBeInTheDocument();
    expect(screen.getByText("BB")).toBeInTheDocument();
    expect(screen.getByText("ชั้น หนึ่ง")).toBeInTheDocument();
    await openTab(pr.tabUnitTypes);
    expect(await screen.findByText("STD")).toBeInTheDocument();
  });

  it("edits a building through the prefilled dialog and sends its id", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminBuilding").mockResolvedValue(buildingA);
    renderAdmin(<PropertyMasterSection />);
    await openTab(pr.tabBuildings);
    fireEvent.click(await screen.findByRole("button", { name: `${pr.btnEdit} BA` }));
    const dialog = await screen.findByRole("dialog", { name: pr.editBuildingTitle });
    expect(within(dialog).getByDisplayValue("BA")).toBeInTheDocument();
    fireEvent.change(document.getElementById("bld-name-th") as HTMLInputElement, { target: { value: "อาคาร เอ ใหม่" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: "b1", code: "BA", name: { th: "อาคาร เอ ใหม่", en: "Building A" } })));
  });

  it("creates a floor for a chosen building and blocks an empty Thai name", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminFloor").mockResolvedValue({ id: "f9", floorNumber: 3, name: { th: "ชั้น 3" }, unitCount: 0 });
    renderAdmin(<PropertyMasterSection />);
    await openTab(pr.tabBuildings);
    fireEvent.click(await screen.findByRole("button", { name: pr.addFloor }));
    const dialog = await screen.findByRole("dialog", { name: pr.createFloorTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    expect(await within(dialog).findByText(thMessages.common.localized.errorThaiRequired)).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("flr-building") as HTMLSelectElement, { target: { value: "b2" } });
    fireEvent.change(document.getElementById("flr-number") as HTMLInputElement, { target: { value: "3" } });
    fireEvent.change(document.getElementById("flr-name-th") as HTMLInputElement, { target: { value: "ชั้น 3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ buildingId: "b2", floorNumber: 3, name: { th: "ชั้น 3" } })));
  });

  it("creates a unit type with the hourly package and daily/monthly rates", async () => {
    const upsert = vi.spyOn(apiClient, "upsertAdminUnitType").mockResolvedValue(studio);
    renderAdmin(<PropertyMasterSection />);
    await openTab(pr.tabUnitTypes);
    fireEvent.click(await screen.findByRole("button", { name: pr.addUnitType }));
    const dialog = await screen.findByRole("dialog", { name: pr.createUnitTypeTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(pr.placeholderCode), { target: { value: "DLX" } });
    fireEvent.change(document.getElementById("ut-name-th") as HTMLInputElement, { target: { value: "ดีลักซ์" } });
    fireEvent.change(document.getElementById("ut-area") as HTMLInputElement, { target: { value: "32" } });
    fireEvent.change(document.getElementById("ut-dailyRate") as HTMLInputElement, { target: { value: "1500" } });
    fireEvent.blur(document.getElementById("ut-dailyRate") as HTMLInputElement);
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ code: "DLX", areaSqm: 32, dailyRate: 1500, hourlyBasePackageHours: 3, name: { th: "ดีลักซ์" } }))
    );
  });
});

describe("PM-02 unit editor: asset registry, edit, delete", () => {
  it("edits a unit keeping its id, removing one asset and adding another", async () => {
    vi.spyOn(apiClient, "getAdminUnit").mockResolvedValue(unit("un1", "A-101", buildingA));
    const upsert = vi.spyOn(apiClient, "upsertAdminUnitMaster").mockResolvedValue(unit("un1", "A-101", buildingA));
    const { queryClient } = renderAdmin(<UnitMasterEditor unitId="un1" />);
    expect(await screen.findByDisplayValue("A-101")).toBeInTheDocument();
    expect(screen.getByDisplayValue("AC")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${pr.removeAsset} 1` }));
    await waitFor(() => expect(screen.queryByDisplayValue("TV")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: pr.addAsset }));
    const codes = await screen.findAllByPlaceholderText(pr.assetCode);
    fireEvent.change(codes[codes.length - 1], { target: { value: "FAN" } });
    const names = screen.getAllByPlaceholderText(pr.assetNameTh);
    fireEvent.change(names[names.length - 1], { target: { value: "พัดลม" } });
    fireEvent.change(document.getElementById("unit-condition") as HTMLSelectElement, { target: { value: "Dirty" } });
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(screen.getByRole("button", { name: pr.save }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: pr.save }));
    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          id: "un1",
          conditionStatus: "Dirty",
          assets: [expect.objectContaining({ assetCode: "AC", name: { th: "แอร์", en: "Air" }, replacementCostAmount: 12000 }), expect.objectContaining({ assetCode: "FAN", name: { th: "พัดลม" } })],
        })
      )
    );
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.properties.all));
      expect(keys).toContain(JSON.stringify(queryKeys.rack.all));
    });
  });

  it("requires asset code and Thai name before saving", async () => {
    vi.spyOn(apiClient, "getAdminUnit").mockResolvedValue(unit("un1", "A-101", buildingA));
    const upsert = vi.spyOn(apiClient, "upsertAdminUnitMaster");
    renderAdmin(<UnitMasterEditor unitId="un1" />);
    await screen.findByDisplayValue("A-101");
    fireEvent.click(screen.getByRole("button", { name: pr.addAsset }));
    fireEvent.click(screen.getByRole("button", { name: pr.save }));
    await waitFor(() => expect(screen.getAllByText(tc.required).length).toBeGreaterThan(0));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("guards double submit on the confirmed save", async () => {
    vi.spyOn(apiClient, "getAdminUnit").mockResolvedValue(unit("un1", "A-101", buildingA));
    let resolve: (v: ReturnType<typeof unit>) => void = () => undefined;
    const upsert = vi.spyOn(apiClient, "upsertAdminUnitMaster").mockImplementation(() => new Promise((r) => { resolve = r as typeof resolve; }));
    renderAdmin(<UnitMasterEditor unitId="un1" />);
    await screen.findByDisplayValue("A-101");
    fireEvent.click(screen.getByRole("button", { name: pr.save }));
    const confirm = await screen.findByRole("alertdialog");
    const btn = within(confirm).getByRole("button", { name: pr.save });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
    resolve(unit("un1", "A-101", buildingA));
  });

  it("deletes a unit after confirmation and returns to the list, but stays on a 409 in-use conflict", async () => {
    vi.spyOn(apiClient, "getAdminUnit").mockResolvedValue(unit("un1", "A-101", buildingA));
    const del = vi.spyOn(apiClient, "deleteAdminUnit").mockRejectedValueOnce(conflict());
    renderAdmin(<UnitMasterEditor unitId="un1" />);
    await screen.findByDisplayValue("A-101");
    fireEvent.click(screen.getByRole("button", { name: pr.btnDelete }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: pr.btnDelete }));
    await waitFor(() => expect(toastMessages()).toContain(thMessages.errors.master_data_in_use));
    expect(push).not.toHaveBeenCalled();
    del.mockResolvedValue(unit("un1", "A-101", buildingA));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: pr.btnDelete }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: pr.btnDelete }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/properties"));
  });

  it("hides the delete action and fields are read-only without admin.properties.manage", async () => {
    vi.spyOn(apiClient, "getAdminUnit").mockResolvedValue(unit("un1", "A-101", buildingA));
    renderAdmin(<UnitMasterEditor unitId="un1" />, ["admin.properties.read"]);
    await screen.findByDisplayValue("A-101");
    expect(screen.queryByRole("button", { name: pr.btnDelete })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("A-101")).toBeDisabled();
    expect(screen.getByText(pr.readOnlyHint)).toBeInTheDocument();
  });
});
