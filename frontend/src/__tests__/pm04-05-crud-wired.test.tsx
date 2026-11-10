import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { queryKeys } from "@/lib/api/query-keys";
import { clearAllToasts, getActiveToasts } from "@/components/ui/toast";
import { AdminReservationsSection } from "@/features/reservations/components/AdminReservationsSection";
import { ReservationEditor } from "@/features/reservations/components/ReservationEditor";
import { FrontDeskStaysSection } from "@/features/stays/components/FrontDeskStaysSection";
import { StayDetailEditor } from "@/features/stays/components/StayDetailEditor";
import RoomRackPage from "@/app/(admin)/admin/rack/page";
import type { PropertyHierarchyResponse, ReservationItemDto, StayDetailDto } from "@/generated/api";
import { renderAdmin, customerRef, unitRef } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin",
}));

const rs = thMessages.admin.reservations;
const st = thMessages.admin.stays;
const rd = thMessages.common.reasonDialog;
const tc = thMessages.common;

const toastMessages = () => getActiveToasts().map((t) => t.message);
const unitType = { id: "ut1", code: "STD", name: { th: "สตูดิโอ", en: "Studio" }, areaSqm: 24 };
const hierarchy = {
  property: { id: "p1", code: "BKK01", taxBranchCode: "0", name: { th: "สาขา", en: "Branch" } },
  buildings: [],
  unitTypes: [{ ...unitType, totalQuotaUnits: 5, supportedStayModes: ["Daily"], hourlyBasePackagePrice: 0, dailyRate: 900, monthlyRentRate: 9000 }],
  units: [],
} as unknown as PropertyHierarchyResponse;

const reservation = (status: string, over: Partial<ReservationItemDto> = {}): ReservationItemDto => ({
  id: "r1",
  documentNumber: "RES-2611-0001",
  property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
  customer: customerRef,
  unitType,
  stayMode: "Daily",
  slotStartAt: "2026-11-20T07:00:00Z",
  slotEndAt: "2026-11-22T05:00:00Z",
  effectiveBlockedEndAt: "2026-11-22T05:00:00Z",
  holdExpiresAt: "2026-11-20T07:15:00Z",
  depositAmount: 500,
  status: status as ReservationItemDto["status"],
  ...over,
});

const availability = {
  property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
  stayMode: "Daily" as const,
  slotStartAt: "2026-11-20T07:00:00Z",
  slotEndAt: "2026-11-22T05:00:00Z",
  items: [
    {
      unitType,
      supportedStayModes: ["Daily" as const],
      totalPhysicalUnits: 5,
      unassignedQuotaHeld: 0,
      netAvailableQuota: 3,
      turnaroundBufferMinutes: 0,
      estimatedRoomRate: 900,
      estimatedDepositAmount: 500,
      availableUnits: [{ id: "u-free", unitNumber: "A-105", buildingName: { th: "อาคาร A", en: "Building A" }, floorNumber: 1, conditionStatus: "Clean" as const }],
    },
  ],
};

const stay = (over: Partial<StayDetailDto> = {}): StayDetailDto => ({
  id: "st1",
  documentNumber: "STY-2611-0001",
  property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
  unit: unitRef,
  customer: customerRef,
  stayMode: "Hourly",
  status: "Active",
  checkInAt: "2026-11-07T01:00:00Z",
  expectedCheckOutAt: "2026-11-07T04:00:00Z",
  isOvertime: false,
  keyDepositAmount: 500,
  keyDepositBalance: 500,
  folio: {
    id: "f1",
    charges: [
      { id: "c1", description: { th: "ค่าห้อง", en: "Room" }, amount: 450, taxMode: "VatIncluded", isVoided: false },
      { id: "c2", description: { th: "มินิบาร์", en: "Minibar" }, amount: 80, taxMode: "VatIncluded", isVoided: true, voidReason: "Wrong room" },
    ],
    totalCharges: 450,
    totalPayments: 0,
    balanceDue: 450,
  },
  occupants: [{ id: "o1", fullName: "Alice Smith", nationalityCode: "USA", maskedIdentityNumber: "US-XXXX", isPrimaryOccupant: true, vehicleLicensePlate: null }],
  note: "Late arrival",
  ...over,
});

beforeEach(() => {
  push.mockClear();
  clearAllToasts();
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
  vi.spyOn(apiClient, "searchAdminCustomers").mockResolvedValue({ items: [customerRef] });
});
afterEach(() => vi.restoreAllMocks());

describe("PM-04 reservations (real API)", () => {
  it("lists from the API, filters server-side, and shows error and permission states", async () => {
    const spy = vi.spyOn(apiClient, "getAdminReservations").mockResolvedValue({ items: [reservation("Hold")] });
    const first = renderAdmin(<AdminReservationsSection />, ["admin.reservations.read"]);
    expect(await screen.findByText("RES-2611-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: rs.createReservation })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(rs.colStatusDeposit), { target: { value: "Confirmed" } });
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.any(String), { status: "Confirmed", stayMode: undefined }));
    first.unmount();
    spy.mockRejectedValue(new Error("boom"));
    renderAdmin(<AdminReservationsSection />);
    expect(await screen.findByText(rs.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: rs.colDocument }).length).toBeGreaterThan(0);
  });

  it("validates, re-checks availability and creates a reservation with ISO slots", async () => {
    const avail = vi.spyOn(apiClient, "getAdminAvailability").mockResolvedValue(availability);
    const create = vi.spyOn(apiClient, "createAdminReservation").mockResolvedValue(reservation("Hold", { id: "r9" }));
    const { queryClient } = renderAdmin(<ReservationEditor reservationId="create" />);
    fireEvent.click(await screen.findByRole("button", { name: rs.saveCreate }));
    expect(await screen.findByText(rs.errorCustomerRequired)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(document.getElementById("res-customer") as HTMLElement);
    fireEvent.click(await screen.findByText(/Somchai Jaidee/));
    fireEvent.change(document.getElementById("res-start") as HTMLInputElement, { target: { value: "2026-11-20T14:00" } });
    fireEvent.change(document.getElementById("res-end") as HTMLInputElement, { target: { value: "2026-11-22T12:00" } });
    fireEvent.change(document.getElementById("res-unit-type") as HTMLSelectElement, { target: { value: "ut1" } });
    await waitFor(() => expect(avail).toHaveBeenCalled());
    expect(await screen.findByText(/3/, { selector: "[data-testid='availability-hint'] span" })).toBeInTheDocument();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(screen.getByRole("button", { name: rs.saveCreate }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: rs.saveCreate }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ unitTypeId: "ut1", stayMode: "Daily", slotStartAt: expect.stringMatching(/Z$/), slotEndAt: expect.stringMatching(/Z$/) })
      )
    );
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.reservations.all));
      expect(keys).toContain(JSON.stringify(queryKeys.availability.all));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/reservations/r9"));
  });

  it("edits through PUT and surfaces the availability re-check error", async () => {
    vi.spyOn(apiClient, "getAdminReservation").mockResolvedValue(reservation("Hold"));
    vi.spyOn(apiClient, "getAdminAvailability").mockResolvedValue(availability);
    const update = vi.spyOn(apiClient, "updateAdminReservation").mockRejectedValue(new ApiError({ status: 409, errorCode: "reservation.slot_overlap", message: "overlap" }));
    renderAdmin(<ReservationEditor reservationId="r1" />);
    fireEvent.change(await screen.findByPlaceholderText(rs.placeholderNote), { target: { value: "Late arrival" } });
    fireEvent.click(screen.getByRole("button", { name: tc.save }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.any(String), "r1", expect.objectContaining({ unitTypeId: "ut1", note: "Late arrival" })));
    await waitFor(() => expect(toastMessages()).toContain(thMessages.errors.reservation_slot_overlap));
  });

  it("confirms after a confirmation modal and cancels or marks no-show with a reason", async () => {
    vi.spyOn(apiClient, "getAdminReservation").mockResolvedValue(reservation("PendingVerification"));
    vi.spyOn(apiClient, "getAdminAvailability").mockResolvedValue(availability);
    const confirm = vi.spyOn(apiClient, "confirmAdminReservation").mockResolvedValue(reservation("Confirmed"));
    const cancel = vi.spyOn(apiClient, "cancelAdminReservation").mockResolvedValue(reservation("Cancelled"));
    renderAdmin(<ReservationEditor reservationId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: rs.actionConfirm }));
    const modal = await screen.findByRole("alertdialog");
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByRole("button", { name: rs.actionConfirm }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.any(String), "r1"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: rs.typeCancel }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(rs.modalTitleCancel.split(":")[0]) });
    fireEvent.click(within(dialog).getByRole("button", { name: rs.typeCancel }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Guest cancelled" } });
    fireEvent.click(within(dialog).getByRole("button", { name: rs.typeCancel }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: rs.typeCancel }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.any(String), "r1", { reason: "Guest cancelled", markNoShow: false }));
  });

  it("offers no-show only for Confirmed and delete only for Expired, guarding by status", async () => {
    vi.spyOn(apiClient, "getAdminAvailability").mockResolvedValue(availability);
    const del = vi.spyOn(apiClient, "deleteAdminReservation").mockResolvedValue(reservation("Expired"));
    vi.spyOn(apiClient, "getAdminReservation").mockResolvedValue(reservation("Hold"));
    const first = renderAdmin(<ReservationEditor reservationId="r1" />);
    await screen.findByRole("button", { name: rs.actionConfirm });
    expect(screen.queryByRole("button", { name: rs.typeNoShow })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: rs.btnDelete })).not.toBeInTheDocument();
    first.unmount();
    vi.mocked(apiClient.getAdminReservation).mockResolvedValue(reservation("Expired"));
    renderAdmin(<ReservationEditor reservationId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: rs.btnDelete }));
    expect(screen.queryByRole("button", { name: rs.typeCancel })).not.toBeInTheDocument();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: rs.btnDelete }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "r1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/reservations"));
  });

  it("assigns a free unit from the availability response", async () => {
    vi.spyOn(apiClient, "getAdminReservation").mockResolvedValue(reservation("Confirmed"));
    vi.spyOn(apiClient, "getAdminAvailability").mockResolvedValue(availability);
    const assign = vi.spyOn(apiClient, "assignAdminReservationUnit").mockResolvedValue(reservation("Confirmed"));
    renderAdmin(<ReservationEditor reservationId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: rs.actionAssignUnit }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(rs.modalTitleAssign.split(":")[0]) });
    await waitFor(() => expect(within(dialog).getByRole("option", { name: /A-105/ })).toBeInTheDocument());
    fireEvent.change(document.getElementById("assign-unit") as HTMLSelectElement, { target: { value: "u-free" } });
    fireEvent.click(within(dialog).getByRole("button", { name: rs.saveAssign }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(expect.any(String), "r1", { unitId: "u-free" }));
  });
});

describe("PM-05 stays and front desk (real API)", () => {
  it("lists stays from the API with the monthly-lease hint, gating, empty and error states", async () => {
    const spy = vi.spyOn(apiClient, "getAdminStays").mockResolvedValue({ items: [stay(), stay({ id: "st2", documentNumber: "STY-2611-0002", isOvertime: true })] });
    const first = renderAdmin(<FrontDeskStaysSection />, ["admin.stay.checkout"]);
    expect(await screen.findByText("STY-2611-0001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: st.monthlyHintLink })).toHaveAttribute("href", "/admin/leases/create");
    expect(screen.queryByRole("button", { name: st.btnCheckIn })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(st.colStatus), { target: { value: "CheckedOut" } });
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.any(String), { status: "CheckedOut", stayMode: undefined }));
    spy.mockResolvedValue({ items: [] });
    fireEvent.change(screen.getByLabelText(st.colStatus), { target: { value: "Cancelled" } });
    expect(await screen.findByText(st.emptyStays)).toBeInTheDocument();
    first.unmount();
    spy.mockRejectedValue(new Error("boom"));
    renderAdmin(<FrontDeskStaysSection />);
    expect(await screen.findByText(st.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: st.colDocUnit }).length).toBeGreaterThan(0);
  });

  it("shows note, voided charge reasons and the cancel reason from the real stay", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay({ status: "Cancelled", cancelReason: "Mistaken check-in" }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    expect(await screen.findByText("Mistaken check-in")).toBeInTheDocument();
    expect(screen.getByText("Late arrival")).toBeInTheDocument();
    expect(screen.getByTestId("charge-void-reason")).toHaveTextContent("Wrong room");
    expect(screen.queryByRole("button", { name: st.btnCancelStay })).not.toBeInTheDocument();
  });

  it("shows a load error with retry for the stay detail", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockRejectedValue(new Error("boom"));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    expect(await screen.findByText(st.loadStayError)).toBeInTheDocument();
  });

  it("voids a charge only with a reason and confirmation, then invalidates stay caches", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const voidCharge = vi.spyOn(apiClient, "voidAdminFolioCharge").mockResolvedValue(stay());
    const { queryClient } = renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: `${st.btnVoidCharge} ค่าห้อง` }));
    const dialog = await screen.findByRole("dialog", { name: st.voidChargeTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnVoidCharge }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Duplicate" } });
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnVoidCharge }));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: st.btnVoidCharge }));
    await waitFor(() => expect(voidCharge).toHaveBeenCalledWith(expect.any(String), "st1", "c1", "Duplicate"));
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.stays.all));
      expect(keys).toContain(JSON.stringify(queryKeys.cashier.all));
    });
  });

  it("requires admin.invoices.void to reverse a payment and validates the reversal", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const reverse = vi.spyOn(apiClient, "reverseAdminFolioPayment").mockResolvedValue(stay());
    const first = renderAdmin(<StayDetailEditor stayId="st1" />, ["admin.stay.checkout"]);
    await screen.findByText("ค่าห้อง");
    expect(screen.queryByRole("button", { name: st.btnReversePayment })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(st.btnVoidCharge) })).not.toBeInTheDocument();
    first.unmount();
    renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.btnReversePayment }));
    const dialog = await screen.findByRole("dialog", { name: st.reversePaymentTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnReversePayment }));
    expect(await within(dialog).findByText(st.errorAmount)).toBeInTheDocument();
    expect(reverse).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("reverse-amount") as HTMLInputElement, { target: { value: "100" } });
    fireEvent.blur(document.getElementById("reverse-amount") as HTMLInputElement);
    fireEvent.change(within(dialog).getByPlaceholderText(st.placeholderReverseReason), { target: { value: "Wrong guest" } });
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnReversePayment }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: st.btnReversePayment }));
    await waitFor(() => expect(reverse).toHaveBeenCalledWith(expect.any(String), "st1", { amount: 100, paymentMethod: "Cash", reason: "Wrong guest" }));
  });

  it("records a payment, shows the shift.not_open alert on rejection and guards double submit", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    let reject: (e: unknown) => void = () => undefined;
    const pay = vi.spyOn(apiClient, "recordAdminFolioPayment").mockImplementation(() => new Promise((_r, rej) => { reject = rej; }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    await screen.findByTestId("folio-balance");
    const amount = document.getElementById("payment-amount") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "450" } });
    fireEvent.blur(amount);
    const btn = screen.getByRole("button", { name: st.saveRecordPayment });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(pay).toHaveBeenCalledTimes(1));
    reject(new ApiError({ status: 409, errorCode: "shift.not_open", message: "x" }));
    expect(await screen.findByTestId("shift-not-open-alert")).toBeInTheDocument();
  });

  it("cancels a mistaken check-in only with a reason and a confirmation", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const cancel = vi.spyOn(apiClient, "cancelAdminStay").mockResolvedValue(stay({ status: "Cancelled" }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.btnCancelStay }));
    const dialog = await screen.findByRole("dialog", { name: st.cancelStayTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Wrong unit" } });
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnCancelStay }));
    const confirm = await screen.findByRole("alertdialog");
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: st.btnCancelStay }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.any(String), "st1", "Wrong unit"));
  });

  it("edits note through PUT, adds and deletes occupants with the ID document uploaded on submit only", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const update = vi.spyOn(apiClient, "updateAdminStay").mockResolvedValue(stay());
    const addOcc = vi.spyOn(apiClient, "addAdminStayOccupant").mockResolvedValue(stay());
    const delOcc = vi.spyOn(apiClient, "deleteAdminStayOccupant").mockResolvedValue(stay());
    const upload = vi.spyOn(apiClient, "uploadAdminFile").mockResolvedValue({ fileKey: "files/id-1", purpose: "IdentityDocument", contentType: "image/jpeg", size: 1, createdAt: "2026-11-07T00:00:00Z" });
    renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.change(await screen.findByPlaceholderText(st.placeholderNote), { target: { value: "Updated note" } });
    fireEvent.click(screen.getAllByRole("button", { name: tc.save })[0]);
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.any(String), "st1", expect.objectContaining({ note: "Updated note" })));

    fireEvent.click(screen.getByRole("button", { name: st.addOccupant }));
    const dialog = await screen.findByRole("dialog", { name: st.addOccupantTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    expect(await within(dialog).findAllByText(st.errorGuestRequired)).not.toHaveLength(0);
    expect(addOcc).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("occ-name") as HTMLInputElement, { target: { value: "Bob" } });
    fireEvent.change(document.getElementById("occ-nationality") as HTMLInputElement, { target: { value: "GBR" } });
    fireEvent.change(document.getElementById("occ-identity") as HTMLInputElement, { target: { value: "GB-123456" } });
    fireEvent.change(document.getElementById("occ-phone") as HTMLInputElement, { target: { value: "0812345678" } });
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "id.jpg", { type: "image/jpeg" })] } });
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith(expect.any(String), "IdentityDocument", expect.any(File)));
    await waitFor(() =>
      expect(addOcc).toHaveBeenCalledWith(expect.any(String), "st1", expect.objectContaining({ fullName: "Bob", phoneNumber: "0812345678", identityDocumentFileKey: "files/id-1" }))
    );

    fireEvent.click(await screen.findByRole("button", { name: `${tc.delete} Alice Smith` }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: tc.delete }));
    await waitFor(() => expect(delOcc).toHaveBeenCalledWith(expect.any(String), "st1", "o1"));
  });

  it("blocks check-out hints on unsettled folio, then checks out after confirmation", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const checkOut = vi.spyOn(apiClient, "checkOutAdminStay").mockRejectedValue(new ApiError({ status: 409, errorCode: "stay.folio_unsettled", message: "x" }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.actionCheckOut }));
    expect(await screen.findByTestId("unsettled-warning")).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: new RegExp(st.modalTitleCheckOut.split(":")[0]) });
    fireEvent.click(within(dialog).getByRole("button", { name: st.saveCheckOut }));
    const confirm = await screen.findByRole("alertdialog");
    expect(checkOut).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: st.saveCheckOut }));
    await waitFor(() => expect(checkOut).toHaveBeenCalledWith(expect.any(String), "st1", { keyDepositDeductionAmount: 0, deductionOrRefundReason: "" }));
    await waitFor(() => expect(toastMessages()).toContain(thMessages.errors.stay_folio_unsettled));
  });

  it("exports the regulatory report masked by default and unmasks only after confirmation", async () => {
    vi.spyOn(apiClient, "getAdminStays").mockResolvedValue({ items: [] });
    const exp = vi.spyOn(apiClient, "getAdminRegulatoryExports").mockImplementation(async (_p, params) => ({
      property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
      reportType: params.reportType,
      generatedAt: "2026-11-07T00:00:00Z",
      isPiiUnmasked: Boolean(params.unmaskPii),
      csvContent: "a,b",
      rows: [
        { occupantId: "o1", sourceDocumentNumber: "STY-1", unitNumber: "A-101", fullName: "Alice", nationalityCode: "USA", identityNumber: params.unmaskPii ? "US-12345678" : "US-XXXX", isPrimaryOccupant: true, checkInAt: "2026-11-07T01:00:00Z", stayMode: "Hourly" },
      ],
    }));
    renderAdmin(<FrontDeskStaysSection />);
    fireEvent.click(await screen.findByRole("button", { name: st.btnRegulatory }));
    expect(await screen.findByText("US-XXXX")).toBeInTheDocument();
    expect(exp).toHaveBeenCalledWith(expect.any(String), { reportType: "RR4", unmaskPii: false });
    fireEvent.click(screen.getByRole("button", { name: st.unmaskPiiButton }));
    const confirm = await screen.findByRole("alertdialog");
    expect(exp).toHaveBeenCalledTimes(1);
    fireEvent.click(within(confirm).getByRole("button", { name: st.confirmUnmaskBtn }));
    expect(await screen.findByText("US-12345678")).toBeInTheDocument();
    expect(exp).toHaveBeenLastCalledWith(expect.any(String), { reportType: "RR4", unmaskPii: true });
  });

  it("hides the regulatory export without admin.regulatory.export", async () => {
    vi.spyOn(apiClient, "getAdminStays").mockResolvedValue({ items: [] });
    renderAdmin(<FrontDeskStaysSection />, ["admin.stay.checkin"]);
    await screen.findByText(st.emptyStays);
    expect(screen.queryByRole("button", { name: st.btnRegulatory })).not.toBeInTheDocument();
  });
});

describe("PM-05 room rack (real API)", () => {
  const rackItem = {
    unit: unitRef,
    occupancyStatus: "Vacant" as const,
    conditionStatus: "Clean" as const,
    supportedStayModes: ["Daily" as const],
  };

  it("renders the rack from the API and shows an error state with retry, never sample rooms", async () => {
    vi.spyOn(apiClient, "getAdminCurrentCashierShift").mockResolvedValue({ shift: null });
    const spy = vi.spyOn(apiClient, "getAdminRoomRack").mockRejectedValue(new Error("boom"));
    renderAdmin(<RoomRackPage />);
    expect(await screen.findByText(thMessages.admin.roomRack.loadError)).toBeInTheDocument();
    expect(screen.queryByText("A-101")).not.toBeInTheDocument();
    spy.mockResolvedValue({ property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } }, items: [rackItem] });
    fireEvent.click(screen.getByRole("button", { name: tc.retry }));
    expect(await screen.findByText("B-201")).toBeInTheDocument();
  });
});
