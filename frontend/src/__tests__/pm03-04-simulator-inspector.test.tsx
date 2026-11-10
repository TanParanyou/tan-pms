import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { RateTariffTaxSection } from "@/features/rates/components/RateTariffTaxSection";
import { AdminReservationsSection } from "@/features/reservations/components/AdminReservationsSection";
import { ReservationEditor } from "@/features/reservations/components/ReservationEditor";
import { UnitTypesPanel } from "@/features/properties/components/HierarchyPanels";
import type { PropertyHierarchyResponse, RateSimulationResponse } from "@/generated/api";
import { renderAdmin } from "./test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin",
}));

const rt = thMessages.admin.rates;
const rs = thMessages.admin.reservations;
const pr = thMessages.admin.properties;
const tc = thMessages.common;

const unitType = { id: "ut1", code: "STD", name: { th: "สตูดิโอ", en: "Studio" }, areaSqm: 24 };
const plan = {
  id: "rp1",
  code: "RP-STD",
  name: { th: "แผนมาตรฐาน", en: "Standard" },
  unitType,
  supportedStayModes: ["Hourly" as const],
  hourlyPackage: { basePackageHours: 3, basePackagePrice: 450, additionalHourPrice: 120, gracePeriodMinutes: 15, autoCapToDailyRate: 1200, turnaroundBufferMinutes: 30 },
  dailyRate: { weekdayRate: 890, weekendRate: 1090, holidaySurchargeAmount: 0, extraGuestPrice: 0 },
  monthlyRate: { monthlyRentRate: 12000, minimumLeaseMonths: 1, securityDepositMonths: 2 },
  isActive: true,
};
const tax = { id: "tx1", chargeCategoryCode: "SHORT_STAY", name: { th: "ห้องพักระยะสั้น", en: "Short stay" }, taxMode: "VatIncluded" as const, vatRatePercent: 7, defaultWithholdingTaxPercent: 3, isActive: true };
const catalog = { property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } }, ratePlans: [plan], utilityTariffs: [], taxProfiles: [tax] };

const simResponse: RateSimulationResponse = {
  hourlyQuote: { durationMinutes: 300, extraHours: 2, rawCharge: 690, finalHourlyRoomCharge: 690, isCappedToDailyRate: false, turnaroundBufferMinutes: 30 },
  waterQuote: { utilityType: "Water", usageUnits: 20, chargeAmount: 360, usedRollover: false },
  electricQuote: { utilityType: "Electric", usageUnits: 100, chargeAmount: 750, usedRollover: true },
  taxQuote: { taxMode: "VatIncluded", vatRatePercent: 7, subTotal: 934.58, vatAmount: 65.42, invoiceTotal: 1000, withholdingTaxPercent: 3, withholdingTaxAmount: 28.04, netPayable: 971.96 },
};

const availability = {
  property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
  stayMode: "Daily" as const,
  slotStartAt: "2026-11-20T07:00:00Z",
  slotEndAt: "2026-11-22T05:00:00Z",
  items: [
    { unitType, supportedStayModes: ["Daily" as const], totalPhysicalUnits: 5, unassignedQuotaHeld: 2, netAvailableQuota: 3, turnaroundBufferMinutes: 0, estimatedRoomRate: 900, estimatedDepositAmount: 500, availableUnits: [{ id: "u1", unitNumber: "A-105", buildingName: { th: "อาคาร A", en: "A" }, floorNumber: 1, conditionStatus: "Clean" as const }] },
    { unitType: { ...unitType, id: "ut2", code: "DLX", name: { th: "ดีลักซ์", en: "Deluxe" } }, supportedStayModes: ["Daily" as const], totalPhysicalUnits: 2, unassignedQuotaHeld: 0, netAvailableQuota: 0, turnaroundBufferMinutes: 0, estimatedRoomRate: 1500, estimatedDepositAmount: 800, availableUnits: [] },
  ],
};

beforeEach(() => {
  vi.spyOn(apiClient, "getAdminPropertyRates").mockResolvedValue(catalog);
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue({
    property: { id: "p1", code: "BKK01", taxBranchCode: "0", name: { th: "สาขา", en: "B" } },
    buildings: [],
    unitTypes: [{ ...unitType, totalQuotaUnits: 5, supportedStayModes: ["Daily"], hourlyBasePackagePrice: 0, hourlyBasePackageHours: 3, hourlyAdditionalHourPrice: 0, dailyRate: 900, monthlyRentRate: 9000 }],
    units: [],
  } as unknown as PropertyHierarchyResponse);
});
afterEach(() => vi.restoreAllMocks());

describe("PM-03 quote and tax simulator (backend driven)", () => {
  const open = async (permissions?: string[]) => {
    const r = renderAdmin(<RateTariffTaxSection />, permissions);
    await screen.findByText("RP-STD");
    return r;
  };

  it("hides the simulator without admin.rates.manage", async () => {
    await open(["admin.rates.read"]);
    expect(screen.queryByRole("button", { name: rt.openSimulator })).not.toBeInTheDocument();
  });

  it("validates the form, sends the real request and renders only the backend figures", async () => {
    const sim = vi.spyOn(apiClient, "simulateAdminRateAndTax").mockResolvedValue(simResponse);
    await open();
    fireEvent.click(screen.getByRole("button", { name: rt.openSimulator }));
    const dialog = await screen.findByRole("dialog", { name: rt.simTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: rt.btnSimulate }));
    expect((await within(dialog).findAllByText(tc.required)).length).toBeGreaterThan(0);
    expect(sim).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("sim-plan") as HTMLSelectElement, { target: { value: "rp1" } });
    fireEvent.change(document.getElementById("sim-tax") as HTMLSelectElement, { target: { value: "tx1" } });
    fireEvent.change(document.getElementById("sim-durationMinutes") as HTMLInputElement, { target: { value: "300" } });
    fireEvent.blur(document.getElementById("sim-durationMinutes") as HTMLInputElement);
    fireEvent.click(document.getElementById("sim-applyWithholdingTax") as HTMLElement);
    fireEvent.click(within(dialog).getByRole("button", { name: rt.btnSimulate }));
    await waitFor(() =>
      expect(sim).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ ratePlanId: "rp1", taxProfileId: "tx1", durationMinutes: 300, applyWithholdingTax: true }))
    );
    expect(await screen.findByTestId("sim-result")).toBeInTheDocument();
    expect(screen.getByTestId("sim-final-charge")).toHaveTextContent("690");
    expect(screen.getByTestId("sim-vat")).toHaveTextContent("65.42");
    expect(screen.getByTestId("sim-wht")).toHaveTextContent("28.04");
    expect(screen.getByTestId("sim-net")).toHaveTextContent("971.96");
    expect(screen.getByText(rt.rolloverWarning)).toBeInTheDocument();
  });

  it("shows a loading state while simulating and an error with retry on failure", async () => {
    let reject: (e: unknown) => void = () => undefined;
    const sim = vi.spyOn(apiClient, "simulateAdminRateAndTax").mockImplementation(() => new Promise((_r, rej) => { reject = rej; }));
    await open();
    fireEvent.click(screen.getByRole("button", { name: rt.openSimulator }));
    const dialog = await screen.findByRole("dialog", { name: rt.simTitle });
    fireEvent.change(document.getElementById("sim-plan") as HTMLSelectElement, { target: { value: "rp1" } });
    fireEvent.change(document.getElementById("sim-tax") as HTMLSelectElement, { target: { value: "tx1" } });
    const btn = within(dialog).getByRole("button", { name: rt.btnSimulate });
    fireEvent.click(btn);
    await waitFor(() => expect(within(dialog).getByRole("status")).toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: tc.loading }));
    expect(sim).toHaveBeenCalledTimes(1);
    reject(new ApiError({ status: 500, errorCode: "generic", message: "boom" }));
    expect(await screen.findByTestId("sim-error")).toBeInTheDocument();
    sim.mockResolvedValue(simResponse);
    fireEvent.click(within(screen.getByTestId("sim-error")).getByRole("button", { name: tc.retry }));
    expect(await screen.findByTestId("sim-result")).toBeInTheDocument();
  });
});

describe("PM-04 availability inspector (real endpoint)", () => {
  it("opens from the reservations list, validates the window and renders quota per unit type", async () => {
    vi.spyOn(apiClient, "getAdminReservations").mockResolvedValue({ items: [] });
    const avail = vi.spyOn(apiClient, "getAdminAvailability").mockResolvedValue(availability);
    renderAdmin(<AdminReservationsSection />);
    fireEvent.click(await screen.findByRole("button", { name: rs.inspectAvailability }));
    const dialog = await screen.findByRole("dialog", { name: rs.modalTitleInspector });
    expect(avail).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("insp-start") as HTMLInputElement, { target: { value: "2026-11-22T12:00" } });
    fireEvent.change(document.getElementById("insp-end") as HTMLInputElement, { target: { value: "2026-11-20T12:00" } });
    expect(await within(dialog).findByText(rs.errorSlotWindow)).toBeInTheDocument();
    expect(avail).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("insp-start") as HTMLInputElement, { target: { value: "2026-11-20T14:00" } });
    fireEvent.change(document.getElementById("insp-end") as HTMLInputElement, { target: { value: "2026-11-22T12:00" } });
    await waitFor(() => expect(avail).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ stayMode: "Daily", checkIn: expect.stringMatching(/Z$/) })));
    expect(await within(dialog).findByTestId("inspector-net-STD")).toHaveTextContent("3");
    expect(screen.getByTestId("inspector-net-DLX")).toHaveTextContent("0");
    expect(within(dialog).getByText(rs.inspectorSoldOut)).toBeInTheDocument();
    expect(within(dialog).getByText("A-105")).toBeInTheDocument();
  });

  it("keeps the table header with an error and retry when the endpoint fails", async () => {
    vi.spyOn(apiClient, "getAdminReservations").mockResolvedValue({ items: [] });
    const avail = vi.spyOn(apiClient, "getAdminAvailability").mockRejectedValue(new Error("boom"));
    renderAdmin(<AdminReservationsSection />);
    fireEvent.click(await screen.findByRole("button", { name: rs.inspectAvailability }));
    const dialog = await screen.findByRole("dialog", { name: rs.modalTitleInspector });
    fireEvent.change(document.getElementById("insp-start") as HTMLInputElement, { target: { value: "2026-11-20T14:00" } });
    fireEvent.change(document.getElementById("insp-end") as HTMLInputElement, { target: { value: "2026-11-22T12:00" } });
    expect(await within(dialog).findByText(rs.availabilityError)).toBeInTheDocument();
    expect(within(dialog).getAllByRole("columnheader", { name: rs.colUnitType }).length).toBeGreaterThan(0);
    avail.mockResolvedValue(availability);
    fireEvent.click(within(dialog).getByRole("button", { name: tc.retry }));
    expect(await within(dialog).findByTestId("inspector-net-STD")).toBeInTheDocument();
  });

  it("pre-checks the reservation form: the inspector opens prefilled with the form window", async () => {
    vi.spyOn(apiClient, "getAdminAvailability").mockResolvedValue(availability);
    vi.spyOn(apiClient, "searchAdminCustomers").mockResolvedValue({ items: [] });
    renderAdmin(<ReservationEditor reservationId="create" />);
    await screen.findByRole("button", { name: rs.saveCreate });
    fireEvent.change(document.getElementById("res-start") as HTMLInputElement, { target: { value: "2026-11-20T14:00" } });
    fireEvent.change(document.getElementById("res-end") as HTMLInputElement, { target: { value: "2026-11-22T12:00" } });
    const hint = await screen.findByTestId("availability-hint");
    fireEvent.click(within(hint).getByRole("button", { name: rs.inspectAvailability }));
    const dialog = await screen.findByRole("dialog", { name: rs.modalTitleInspector });
    expect((document.getElementById("insp-start") as HTMLInputElement).value).toBe("2026-11-20T14:00");
    expect(await within(dialog).findByTestId("inspector-net-STD")).toBeInTheDocument();
  });
});

describe("PM-02 unit type form prefill", () => {
  it("prefills the hourly package hours and extra-hour price from the DTO", async () => {
    vi.mocked(apiClient.getAdminPropertyHierarchy).mockResolvedValue({
      property: { id: "p1", code: "BKK01", taxBranchCode: "0", name: { th: "สาขา", en: "B" } },
      buildings: [],
      unitTypes: [{ ...unitType, totalQuotaUnits: 5, supportedStayModes: ["Hourly"], hourlyBasePackagePrice: 400, hourlyBasePackageHours: 4, hourlyAdditionalHourPrice: 90, dailyRate: 900, monthlyRentRate: 9000 }],
      units: [],
    } as unknown as PropertyHierarchyResponse);
    renderAdmin(<UnitTypesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: `${pr.btnEdit} STD` }));
    await screen.findByRole("dialog", { name: pr.editUnitTypeTitle });
    expect((document.getElementById("ut-hours") as HTMLInputElement).value).toBe("4");
    expect((document.getElementById("ut-hourlyAdditionalHourPrice") as HTMLInputElement).value).toBe("90.00");
  });
});
