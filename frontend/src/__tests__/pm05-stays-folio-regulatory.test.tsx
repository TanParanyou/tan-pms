import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { queryKeys } from "@/lib/api/query-keys";
import { clearAllToasts, getActiveToasts } from "@/components/ui/toast";
import { FrontDeskStaysSection } from "@/features/stays/components/FrontDeskStaysSection";
import { StayDetailEditor } from "@/features/stays/components/StayDetailEditor";
import type { StayDetailDto } from "@/generated/api";
import { renderAdmin, customerRef, unitRef } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin/stays",
}));

const st = thMessages.admin.stays;
const rd = thMessages.common.reasonDialog;
const tc = thMessages.common;
const toastMessages = () => getActiveToasts().map((t) => t.message);

const stay = (over: Partial<StayDetailDto> = {}, balance = 450): StayDetailDto => ({
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
    charges: [{ id: "c1", description: { th: "ค่าห้อง", en: "Room" }, amount: 450, taxMode: "VatIncluded", isVoided: false }],
    totalCharges: 450,
    totalPayments: 450 - balance,
    balanceDue: balance,
  },
  occupants: [],
  ...over,
});

beforeEach(() => {
  push.mockClear();
  clearAllToasts();
});
afterEach(() => vi.restoreAllMocks());

describe("PM-05 stays table (table-preserved, live KPIs)", () => {
  it("renders stays with KPIs, keeps the header on empty search and on error", async () => {
    const spy = vi.spyOn(apiClient, "getAdminStays").mockResolvedValue({
      items: [stay(), stay({ id: "st2", documentNumber: "STY-2611-0002", isOvertime: true }, 0)],
    });
    const { container } = renderAdmin(<FrontDeskStaysSection />);
    expect(await screen.findByText("STY-2611-0001")).toBeInTheDocument();
    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /KPI/i })).toHaveTextContent("1");
    fireEvent.change(screen.getByLabelText(st.searchPlaceholder), { target: { value: "no-match" } });
    expect(await screen.findByText(st.emptyStays)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: st.colDocUnit }).length).toBeGreaterThan(0);
    spy.mockRejectedValue(new Error("boom"));
    fireEvent.change(screen.getByLabelText(st.searchPlaceholder), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(st.fieldStayMode), { target: { value: "Daily" } });
    expect(await screen.findByText(st.loadError)).toBeInTheDocument();
  });
});

describe("PM-05 extend stay", () => {
  it("extends an Hourly stay after choosing hours and confirming; Daily stays have no extend", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const extend = vi.spyOn(apiClient, "extendAdminStay").mockResolvedValue(stay());
    const first = renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.actionExtend }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(st.modalTitleExtend.split(":")[0]) });
    fireEvent.change(document.getElementById("extend-hours") as HTMLSelectElement, { target: { value: "2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: st.saveExtend }));
    const confirm = await screen.findByRole("alertdialog");
    expect(extend).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: st.saveExtend }));
    await waitFor(() => expect(extend).toHaveBeenCalledWith(expect.any(String), "st1", { additionalHours: 2 }));
    first.unmount();
    vi.mocked(apiClient.getAdminStay).mockResolvedValue(stay({ stayMode: "Daily" }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    await screen.findByRole("button", { name: st.actionCheckOut });
    expect(screen.queryByRole("button", { name: st.actionExtend })).not.toBeInTheDocument();
  });
});

describe("PM-05 guest folio operations", () => {
  it("validates then adds a service charge with a localized description and tax mode", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const add = vi.spyOn(apiClient, "addAdminFolioCharge").mockResolvedValue(stay());
    renderAdmin(<StayDetailEditor stayId="st1" />);
    await screen.findByTestId("folio-balance");
    fireEvent.click(screen.getByRole("button", { name: st.saveAddCharge }));
    expect(await screen.findByText(thMessages.common.localized.errorThaiRequired)).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
    fireEvent.change(document.getElementById("charge-desc-th") as HTMLInputElement, { target: { value: "ค่าซักรีด" } });
    fireEvent.change(document.getElementById("charge-desc-en") as HTMLInputElement, { target: { value: "Laundry" } });
    fireEvent.change(document.getElementById("charge-amount") as HTMLInputElement, { target: { value: "120" } });
    fireEvent.blur(document.getElementById("charge-amount") as HTMLInputElement);
    fireEvent.change(document.getElementById("charge-tax") as HTMLSelectElement, { target: { value: "VatExcluded" } });
    fireEvent.click(screen.getByRole("button", { name: st.saveAddCharge }));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith(expect.any(String), "st1", { description: { th: "ค่าซักรีด", en: "Laundry" }, amount: 120, taxMode: "VatExcluded" })
    );
  });

  it("records a payment and the folio balance refreshes to settled from the refetch", async () => {
    const get = vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const pay = vi.spyOn(apiClient, "recordAdminFolioPayment").mockImplementation(async () => {
      get.mockResolvedValue(stay({}, 0));
      return stay({}, 0);
    });
    renderAdmin(<StayDetailEditor stayId="st1" />);
    expect(await screen.findByTestId("folio-balance")).toHaveTextContent("450");
    fireEvent.change(document.getElementById("payment-amount") as HTMLInputElement, { target: { value: "450" } });
    fireEvent.blur(document.getElementById("payment-amount") as HTMLInputElement);
    fireEvent.change(document.getElementById("payment-method") as HTMLSelectElement, { target: { value: "PromptPay" } });
    fireEvent.click(screen.getByRole("button", { name: st.saveRecordPayment }));
    await waitFor(() => expect(pay).toHaveBeenCalledWith(expect.any(String), "st1", { amount: 450, paymentMethod: "PromptPay" }));
    await waitFor(() => expect(screen.getByTestId("folio-balance")).not.toHaveTextContent("450"));
    expect(screen.getByTestId("folio-balance")).toHaveTextContent("0 THB");
  });

  it("voids a charge and the voided line shows its reason without a void button", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(
      stay({ folio: { ...stay().folio, charges: [{ id: "c9", description: { th: "มินิบาร์", en: "Minibar" }, amount: 80, taxMode: "VatIncluded", isVoided: true, voidReason: "Wrong room" }] } })
    );
    renderAdmin(<StayDetailEditor stayId="st1" />);
    expect(await screen.findByTestId("charge-void-reason")).toHaveTextContent("Wrong room");
    expect(screen.queryByRole("button", { name: new RegExp(st.btnVoidCharge) })).not.toBeInTheDocument();
  });

  it("reverses a payment only for admin.invoices.void holders, with reason, and surfaces shift.not_open", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const reverse = vi.spyOn(apiClient, "reverseAdminFolioPayment").mockRejectedValue(new ApiError({ status: 409, errorCode: "shift.not_open", message: "x" }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.btnReversePayment }));
    const dialog = await screen.findByRole("dialog", { name: st.reversePaymentTitle });
    fireEvent.change(document.getElementById("reverse-amount") as HTMLInputElement, { target: { value: "200" } });
    fireEvent.blur(document.getElementById("reverse-amount") as HTMLInputElement);
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnReversePayment }));
    expect(await within(dialog).findByText(st.errorReasonRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(st.placeholderReverseReason), { target: { value: "Wrong guest" } });
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnReversePayment }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: st.btnReversePayment }));
    await waitFor(() => expect(reverse).toHaveBeenCalledWith(expect.any(String), "st1", { amount: 200, paymentMethod: "Cash", reason: "Wrong guest" }));
    expect(await screen.findByTestId("shift-not-open-alert")).toBeInTheDocument();
  });
});

describe("PM-05 check-out and key deposit settlement", () => {
  it("checks out a settled stay with a deposit deduction and its reason, then returns to the list", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay({}, 0));
    const out = vi.spyOn(apiClient, "checkOutAdminStay").mockResolvedValue(stay({ status: "CheckedOut" }, 0));
    const { queryClient } = renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.actionCheckOut }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(st.modalTitleCheckOut.split(":")[0]) });
    expect(screen.queryByTestId("unsettled-warning")).not.toBeInTheDocument();
    fireEvent.change(document.getElementById("checkout-deduction") as HTMLInputElement, { target: { value: "100" } });
    fireEvent.blur(document.getElementById("checkout-deduction") as HTMLInputElement);
    fireEvent.change(within(dialog).getByPlaceholderText(st.deductionReasonPlaceholder), { target: { value: "Broken lamp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: st.saveCheckOut }));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: st.saveCheckOut }));
    await waitFor(() => expect(out).toHaveBeenCalledWith(expect.any(String), "st1", { keyDepositDeductionAmount: 100, deductionOrRefundReason: "Broken lamp" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/stays"));
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    for (const k of [queryKeys.stays.all, queryKeys.housekeeping.all, queryKeys.depositLedgers.all]) expect(keys).toContain(JSON.stringify(k));
  });

  it("hides check-out without admin.stay.checkout and offers nothing on a CheckedOut stay", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const first = renderAdmin(<StayDetailEditor stayId="st1" />, ["admin.stay.checkin"]);
    await screen.findByTestId("folio-balance");
    expect(screen.queryByRole("button", { name: st.actionCheckOut })).not.toBeInTheDocument();
    first.unmount();
    vi.mocked(apiClient.getAdminStay).mockResolvedValue(stay({ status: "CheckedOut" }, 0));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    await screen.findByTestId("folio-balance");
    expect(screen.queryByRole("button", { name: st.actionCheckOut })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: st.saveRecordPayment })).not.toBeInTheDocument();
  });

  it("maps the unsettled folio rejection to the readable message", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    vi.spyOn(apiClient, "checkOutAdminStay").mockRejectedValue(new ApiError({ status: 409, errorCode: "stay.folio_unsettled", message: "x" }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.actionCheckOut }));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(st.modalTitleCheckOut.split(":")[0]) });
    fireEvent.click(within(dialog).getByRole("button", { name: st.saveCheckOut }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: st.saveCheckOut }));
    await waitFor(() => expect(toastMessages()).toContain(thMessages.errors.stay_folio_unsettled));
  });
});

describe("PM-05 regulatory export (RR4 and TM30)", () => {
  const exportResponse = (reportType: "RR4" | "TM30", unmask: boolean) => ({
    property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
    reportType,
    generatedAt: "2026-11-07T00:00:00Z",
    isPiiUnmasked: unmask,
    csvContent: `${reportType},csv`,
    rows: [{ occupantId: "o1", sourceDocumentNumber: "STY-1", unitNumber: "A-101", fullName: "Alice", nationalityCode: "USA", identityNumber: unmask ? "US-12345678" : "US-XXXX", isPrimaryOccupant: true, checkInAt: "2026-11-07T01:00:00Z", stayMode: "Hourly" }],
  });

  it("switches RR4 to TM30, stays masked without the PII permission and copies the CSV", async () => {
    vi.spyOn(apiClient, "getAdminStays").mockResolvedValue({ items: [] });
    const exp = vi.spyOn(apiClient, "getAdminRegulatoryExports").mockImplementation(async (_p, params) => exportResponse(params.reportType, Boolean(params.unmaskPii)));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderAdmin(<FrontDeskStaysSection />, ["admin.regulatory.export"]);
    fireEvent.click(await screen.findByRole("button", { name: st.btnRegulatory }));
    expect(await screen.findByText("US-XXXX")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: st.unmaskPiiButton })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: st.tabTM30 }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: st.tabTM30 }));
    await waitFor(() => expect(exp).toHaveBeenLastCalledWith(expect.any(String), { reportType: "TM30", unmaskPii: false }));
    fireEvent.click(await screen.findByRole("button", { name: st.copyCsv }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("TM30,csv"));
  });

  it("unmasks only after the confirmation and masks again on request", async () => {
    vi.spyOn(apiClient, "getAdminStays").mockResolvedValue({ items: [] });
    const exp = vi.spyOn(apiClient, "getAdminRegulatoryExports").mockImplementation(async (_p, params) => exportResponse(params.reportType, Boolean(params.unmaskPii)));
    renderAdmin(<FrontDeskStaysSection />);
    fireEvent.click(await screen.findByRole("button", { name: st.btnRegulatory }));
    await screen.findByText("US-XXXX");
    fireEvent.click(screen.getByRole("button", { name: st.unmaskPiiButton }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: tc.cancel }));
    expect(exp).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: st.unmaskPiiButton }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: st.confirmUnmaskBtn }));
    expect(await screen.findByText("US-12345678")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: st.btnMaskPii }));
    expect(await screen.findByText("US-XXXX")).toBeInTheDocument();
  });

  it("shows an error with retry when the export fails", async () => {
    vi.spyOn(apiClient, "getAdminStays").mockResolvedValue({ items: [] });
    const exp = vi.spyOn(apiClient, "getAdminRegulatoryExports").mockRejectedValue(new Error("boom"));
    renderAdmin(<FrontDeskStaysSection />);
    fireEvent.click(await screen.findByRole("button", { name: st.btnRegulatory }));
    expect(await screen.findByText(st.regulatoryLoadError)).toBeInTheDocument();
    exp.mockImplementation(async (_p, params) => exportResponse(params.reportType, false));
    fireEvent.click(screen.getByRole("button", { name: tc.retry }));
    expect(await screen.findByText("US-XXXX")).toBeInTheDocument();
  });

  it("hides cancel-stay reason prompt text bugs: reason dialog is required to cancel a stay", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay());
    const cancel = vi.spyOn(apiClient, "cancelAdminStay").mockResolvedValue(stay({ status: "Cancelled" }));
    renderAdmin(<StayDetailEditor stayId="st1" />);
    fireEvent.click(await screen.findByRole("button", { name: st.btnCancelStay }));
    const dialog = await screen.findByRole("dialog", { name: st.cancelStayTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: st.btnCancelStay }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
  });
});
