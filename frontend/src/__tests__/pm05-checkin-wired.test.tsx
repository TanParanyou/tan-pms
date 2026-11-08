import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { queryKeys } from "@/lib/api/query-keys";
import { StayCreateEditor } from "@/features/stays/components/StayCreateEditor";
import { QuickWalkInModal } from "@/features/rack/components/QuickWalkInModal";
import type { PropertyHierarchyResponse, StaySummaryDto } from "@/generated/api";
import { renderAdmin, customerRef, unitRef } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/stays/create",
}));

const st = thMessages.admin.stays;
const cm = thMessages.admin.checkInModal;
const tc = thMessages.common;

const unit = (id: string, unitNumber: string, occupancyStatus: string, conditionStatus: string) => ({
  id,
  unitNumber,
  building: { id: "b1", code: "B", name: { th: "อาคาร B", en: "Building B" } },
  floor: { id: "f1", floorNumber: 1, name: { th: "ชั้น 1", en: "Floor 1" } },
  unitType: { id: "t1", code: "STD", name: { th: "สตูดิโอ", en: "Studio" }, areaSqm: 24 },
  occupancyStatus,
  conditionStatus,
  supportedStayModes: ["Hourly", "Daily"],
  assets: [],
});

const hierarchy = {
  property: { id: "p1", code: "BKK01", taxBranchCode: "00000", name: { th: "สาขา", en: "Branch" } },
  buildings: [],
  unitTypes: [],
  units: [unit("u-clean", "A-101", "Vacant", "Clean"), unit("u-dirty", "A-302", "Vacant", "Dirty"), unit("u-occ", "A-103", "Occupied", "Clean")],
} as unknown as PropertyHierarchyResponse;

const stay = { id: "st1", documentNumber: "STY-2611-0001", stayMode: "Hourly", status: "Active", unit: unitRef, customer: customerRef } as StaySummaryDto;

async function pick(id: string, optionText: string | RegExp) {
  const trigger = document.getElementById(id) as HTMLElement;
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByText(optionText));
}

async function fillGuest() {
  fireEvent.change(screen.getByPlaceholderText(tc.placeholders.guestName), { target: { value: "Alice Smith" } });
  fireEvent.change(screen.getByPlaceholderText(st.fieldNationality), { target: { value: "USA" } });
  fireEvent.change(screen.getByPlaceholderText(tc.placeholders.nationalId), { target: { value: "US-PASS-5544" } });
}

beforeEach(() => {
  push.mockClear();
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
  vi.spyOn(apiClient, "searchAdminCustomers").mockResolvedValue({ items: [customerRef] });
});
afterEach(() => vi.restoreAllMocks());

describe("PM-05 wired check-in page", () => {
  it("shows an error state with retry when units fail to load, never sample units", async () => {
    vi.mocked(apiClient.getAdminPropertyHierarchy).mockRejectedValue(new Error("boom"));
    renderAdmin(<StayCreateEditor />);
    expect(await screen.findByText(st.unitsLoadError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: tc.retry })).toBeInTheDocument();
  });

  it("offers only vacant units from the real hierarchy", async () => {
    renderAdmin(<StayCreateEditor />);
    await screen.findByText(st.fieldSelectUnit);
    fireEvent.click(document.getElementById("checkin-unit") as HTMLElement);
    expect(await screen.findByText("สตูดิโอ (A-101)")).toBeInTheDocument();
    expect(screen.getByText("สตูดิโอ (A-302)")).toBeInTheDocument();
    expect(screen.queryByText("สตูดิโอ (A-103)")).not.toBeInTheDocument();
  });

  it("does not call the API when required fields are missing and marks the tab", async () => {
    const checkIn = vi.spyOn(apiClient, "checkInStay");
    renderAdmin(<StayCreateEditor />);
    await screen.findByText(st.fieldSelectUnit);
    fireEvent.click(screen.getAllByRole("button", { name: st.saveCheckIn })[0]);
    await waitFor(() => expect(screen.getByTestId("tab-error-dot-tab-room-mode")).toBeInTheDocument());
    expect(checkIn).not.toHaveBeenCalled();
  });

  it("checks in a clean unit through the real endpoint after confirmation, then invalidates dependent caches", async () => {
    const checkIn = vi.spyOn(apiClient, "checkInStay").mockResolvedValue(stay);
    const { queryClient } = renderAdmin(<StayCreateEditor />);
    await screen.findByText(st.fieldSelectUnit);
    await pick("checkin-unit", "สตูดิโอ (A-101)");
    fireEvent.change(document.getElementById("checkin-customer") as HTMLInputElement, { target: { value: "Som" } });
    await pick("checkin-customer", /Somchai Jaidee/);
    await fillGuest();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(screen.getAllByRole("button", { name: st.saveCheckIn })[0]);
    const confirm = await screen.findByRole("alertdialog");
    expect(checkIn).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: st.saveCheckIn }));
    await waitFor(() =>
      expect(checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          unitId: "u-clean",
          customerId: customerRef.id,
          stayMode: "Hourly",
          overrideDirtyCheckIn: false,
          occupants: [expect.objectContaining({ fullName: "Alice Smith", nationalityCode: "USA", isPrimaryOccupant: true })],
        })
      )
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/stays/st1"));
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    for (const k of [queryKeys.stays.all, queryKeys.rack.all, queryKeys.cashier.all, queryKeys.depositLedgers.all]) {
      expect(keys).toContain(JSON.stringify(k));
    }
  });

  it("requires an override reason for a dirty unit and sends overrideDirtyCheckIn", async () => {
    const checkIn = vi.spyOn(apiClient, "checkInStay").mockResolvedValue(stay);
    renderAdmin(<StayCreateEditor />);
    await screen.findByText(st.fieldSelectUnit);
    await pick("checkin-unit", "สตูดิโอ (A-302)");
    expect(await screen.findByTestId("dirty-unit-warning-box")).toBeInTheDocument();
    fireEvent.change(document.getElementById("checkin-customer") as HTMLInputElement, { target: { value: "Som" } });
    await pick("checkin-customer", /Somchai Jaidee/);
    await fillGuest();
    fireEvent.click(screen.getAllByRole("button", { name: st.saveCheckIn })[0]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(checkIn).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(st.dirtyOverridePlaceholder), { target: { value: "Guest accepts" } });
    fireEvent.click(screen.getAllByRole("button", { name: st.saveCheckIn })[0]);
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: st.saveCheckIn }));
    await waitFor(() =>
      expect(checkIn).toHaveBeenCalledWith(expect.objectContaining({ overrideDirtyCheckIn: true, overrideReason: "Guest accepts" }))
    );
  });

  it("shows the shift.not_open alert with a link to the cashier and never double submits", async () => {
    let reject: (e: unknown) => void = () => undefined;
    const checkIn = vi.spyOn(apiClient, "checkInStay").mockImplementation(() => new Promise((_r, rej) => { reject = rej; }));
    renderAdmin(<StayCreateEditor />);
    await screen.findByText(st.fieldSelectUnit);
    await pick("checkin-unit", "สตูดิโอ (A-101)");
    fireEvent.change(document.getElementById("checkin-customer") as HTMLInputElement, { target: { value: "Som" } });
    await pick("checkin-customer", /Somchai Jaidee/);
    await fillGuest();
    fireEvent.click(screen.getAllByRole("button", { name: st.saveCheckIn })[0]);
    const confirm = await screen.findByRole("alertdialog");
    const btn = within(confirm).getByRole("button", { name: st.saveCheckIn });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
    reject(new ApiError({ status: 409, errorCode: "shift.not_open", message: "x" }));
    expect(await screen.findByTestId("shift-not-open-alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: tc.shiftNotOpen.link })).toHaveAttribute("href", "/admin/cashier");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("PM-05 wired quick walk-in on the rack", () => {
  it("uses the real check-in mutation with a searched customer and a vacant unit", async () => {
    const checkIn = vi.spyOn(apiClient, "checkInStay").mockResolvedValue(stay);
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    renderAdmin(<QuickWalkInModal isOpen onClose={onClose} onSuccess={onSuccess} />);
    await screen.findByText(cm.tabRoom);
    fireEvent.change(document.getElementById("walkin-customer") as HTMLInputElement, { target: { value: "Som" } });
    await pick("walkin-customer", /Somchai Jaidee/);
    await waitFor(() => expect(screen.getByRole("option", { name: /A-101/ })).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: /A-103/ })).not.toBeInTheDocument();
    fireEvent.change(document.getElementById("walkin-unit") as HTMLSelectElement, { target: { value: "u-clean" } });
    fireEvent.click(screen.getByRole("button", { name: cm.completeCheckIn }));
    await waitFor(() =>
      expect(checkIn).toHaveBeenCalledWith(expect.objectContaining({ unitId: "u-clean", customerId: customerRef.id, overrideDirtyCheckIn: false }))
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("STY-2611-0001"));
    expect(onClose).toHaveBeenCalled();
  });

  it("validates required fields and surfaces shift.not_open", async () => {
    const checkIn = vi.spyOn(apiClient, "checkInStay").mockRejectedValue(new ApiError({ status: 409, errorCode: "shift.not_open", message: "x" }));
    renderAdmin(<QuickWalkInModal isOpen onClose={() => undefined} onSuccess={() => undefined} />);
    await screen.findByText(cm.tabRoom);
    fireEvent.click(screen.getByRole("button", { name: cm.completeCheckIn }));
    expect(checkIn).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("walkin-customer") as HTMLInputElement, { target: { value: "Som" } });
    await pick("walkin-customer", /Somchai Jaidee/);
    await waitFor(() => expect(screen.getByRole("option", { name: /A-101/ })).toBeInTheDocument());
    fireEvent.change(document.getElementById("walkin-unit") as HTMLSelectElement, { target: { value: "u-clean" } });
    fireEvent.click(screen.getByRole("button", { name: cm.completeCheckIn }));
    expect(await screen.findByTestId("shift-not-open-alert")).toBeInTheDocument();
  });
});
