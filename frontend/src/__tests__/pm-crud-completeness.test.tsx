import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { LeaseDetailEditor } from "@/features/leases/components/LeaseDetailEditor";
import { BulkMeterReadingSection } from "@/features/meters/components/BulkMeterReadingSection";
import { BillingSection } from "@/features/billing/components/BillingSection";
import { CashierShiftSection } from "@/features/cashier/components/CashierShiftSection";
import { PaymentSlipQueueSection } from "@/features/payments/components/PaymentSlipQueueSection";
import { DepositRegisterSection } from "@/features/deposits/components/DepositRegisterSection";
import type { LeaseItemDto } from "@/features/leases/types";
import type { InvoiceItemDto, MeterReadingSheetResponse } from "@/features/billing/types";
import type { CashierShiftDto } from "@/features/cashier/types";
import type { AdminPaymentSlipDto } from "@/features/payments/types";
import { renderAdmin, unitRef, customerRef } from "./test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin",
}));

const l = thMessages.admin.leases;
const m = thMessages.admin.meters;
const b = thMessages.admin.billing;
const c = thMessages.admin.cashier;
const p = thMessages.admin.payments;
const d = thMessages.admin.deposits;
const rd = thMessages.common.reasonDialog;
const tc = thMessages.common;

const lease = (over: Partial<LeaseItemDto> = {}): LeaseItemDto => ({
  id: "l1",
  documentNumber: "LSE-0001",
  status: "Active",
  unit: unitRef,
  customer: customerRef,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  monthlyRentAmount: 8500,
  securityDepositAmount: 17000,
  securityDepositBalance: 17000,
  initialWaterMeterReading: 10,
  initialElectricMeterReading: 100,
  occupants: [{ id: "o1", fullName: "Mali Dee", nationalityCode: "THA", maskedIdentityNumber: "1-XXXX", isPrimaryOccupant: true }],
  vehicles: [{ id: "v1", licensePlate: "AB-1234", province: "Bangkok", vehicleBrandModel: "Honda" }],
  ...over,
});

const invoice = (status: string, over: Partial<InvoiceItemDto> = {}): InvoiceItemDto => ({
  id: "i1",
  documentNumber: "INV-0001",
  status,
  billingPeriodYearMonth: "2026-11",
  customer: customerRef,
  unit: unitRef,
  leaseDocumentNumber: "LSE-0001",
  lines: [
    { id: "ln1", description: { th: "ค่าเช่า", en: "Rent" }, taxMode: "VatIncluded", lineAmount: 100, subTotal: 93, vatAmount: 7, netAmount: 100 },
  ],
  subTotal: 93,
  totalVatAmount: 7,
  totalAmount: 100,
  ...over,
});

const reading = (previous: number, current: number | null) => ({
  meterMaxDigits: 4,
  previousReading: previous,
  currentReading: current,
  usageUnits: current == null ? null : current - previous,
  chargeAmount: null,
  isRolloverConfirmed: false,
});
const sheet: MeterReadingSheetResponse = {
  period: "2026-11",
  rows: [
    { unit: unitRef, leaseId: "l1", leaseDocumentNumber: "LSE-1", customer: customerRef, occupantCount: 1, isLocked: false, water: reading(100, 110), electric: reading(500, 520) },
    {
      unit: { ...unitRef, id: "u-b", unitNumber: "B-202" },
      leaseId: "l2",
      leaseDocumentNumber: "LSE-2",
      customer: customerRef,
      occupantCount: 1,
      isLocked: true,
      water: reading(200, 210),
      electric: reading(900, 950),
    },
  ],
};

const shift = (status: string, over: Partial<CashierShiftDto> = {}): CashierShiftDto => ({
  id: "s1",
  documentNumber: "SHF-0001",
  cashierUserId: "u1",
  cashier: { id: "u1", fullName: "Cashier One" },
  status,
  openingFloatCash: 1000,
  cashReceiptsInShift: 0,
  cashDepositsReceivedInShift: 0,
  cashDepositsRefundedInShift: 0,
  expectedDrawerCash: 1000,
  openedAt: "2026-11-07T01:00:00Z",
  ...over,
});

const slip: AdminPaymentSlipDto = {
  id: "sl1",
  invoiceId: "i1",
  invoiceDocumentNumber: "INV-S1",
  invoiceStatus: "Issued",
  invoiceTotalAmount: 1000,
  invoiceOutstandingAmount: 1000,
  customer: customerRef,
  unit: unitRef,
  amount: 1000,
  slipFileKey: "slips/detail-key.png",
  status: "Pending",
  submittedAt: "2026-11-07T02:00:00Z",
};

beforeEach(() => {
  vi.spyOn(apiClient, "getAdminLease").mockResolvedValue(lease());
  vi.spyOn(apiClient, "getAdminMeterReadingSheet").mockResolvedValue(sheet);
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue({ property: { id: "p1" }, buildings: [], unitTypes: [], units: [] } as never);
  vi.spyOn(apiClient, "getAdminInvoices").mockResolvedValue({ items: [invoice("Draft"), invoice("Issued", { id: "i2", documentNumber: "INV-0002" })] });
  vi.spyOn(apiClient, "getAdminInvoice").mockImplementation(async (_pid, id) =>
    id === "i2" ? invoice("Issued", { id: "i2", documentNumber: "INV-0002" }) : invoice("Draft")
  );
  vi.spyOn(apiClient, "getAdminCurrentCashierShift").mockResolvedValue({ shift: null });
  vi.spyOn(apiClient, "getAdminCashierShifts").mockResolvedValue({
    items: [shift("Open"), shift("Closed", { id: "s2", documentNumber: "SHF-0002", actualCashCounted: 900, cashVariance: -100 })],
  });
  vi.spyOn(apiClient, "getAdminCashierShift").mockImplementation(async (_pid, id) =>
    id === "s2" ? shift("Closed", { id: "s2", documentNumber: "SHF-0002", actualCashCounted: 900, cashVariance: -100 }) : shift("Open")
  );
  vi.spyOn(apiClient, "getAdminPaymentSlips").mockResolvedValue({ items: [slip] });
  vi.spyOn(apiClient, "getAdminPaymentSlip").mockResolvedValue(slip);
  const ledger = {
    id: "d1",
    depositType: "LeaseSecurityDeposit",
    ownerDocumentNumber: "LSE-1",
    customer: customerRef,
    unit: unitRef,
    currentBalance: 500,
    transactions: [{ id: "t1", documentNumber: "DEP-DETAIL", transactionType: "Received", amount: 500, createdAt: "2026-11-01T00:00:00Z" }],
  };
  vi.spyOn(apiClient, "getAdminDepositLedgers").mockResolvedValue({ totalHeldBalance: 500, items: [ledger] });
  vi.spyOn(apiClient, "getAdminDepositLedger").mockResolvedValue(ledger);
});
afterEach(() => vi.restoreAllMocks());

describe("CRUD completeness: Leases", () => {
  it("edits an Active lease only after a reason and a confirmation, then invalidates caches", async () => {
    const update = vi.spyOn(apiClient, "updateAdminLease").mockResolvedValue(lease());
    const { queryClient } = renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByRole("button", { name: l.btnEditLease }));
    const dialog = await screen.findByRole("dialog", { name: l.editLeaseTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    expect(await within(dialog).findByText(l.errorReasonRequired)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.change(within(dialog).getByPlaceholderText(l.placeholderEditReason), { target: { value: "Rent corrected" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    const confirm = await screen.findByRole("alertdialog");
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: tc.save }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(expect.any(String), "l1", expect.objectContaining({ reason: "Rent corrected", monthlyRentAmount: 8500 }))
    );
    await waitFor(() => expect(spy.mock.calls.map((x) => JSON.stringify(x[0]?.queryKey))).toContain(JSON.stringify(queryKeys.leases.all)));
  });

  it("disables edit and cancel for non-Active leases", async () => {
    vi.mocked(apiClient.getAdminLease).mockResolvedValue(lease({ status: "MoveOutNotice" }));
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    expect(await screen.findByRole("button", { name: l.btnEditLease })).toBeDisabled();
    expect(screen.getByRole("button", { name: l.btnCancelLease })).toBeDisabled();
  });

  it("hides cancel without the settle permission and edit without manage permission", async () => {
    renderAdmin(<LeaseDetailEditor leaseId="l1" />, []);
    await screen.findByText("LSE-0001");
    expect(screen.queryByRole("button", { name: l.btnCancelLease })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: l.btnEditLease })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(new RegExp(tc.delete))).not.toBeInTheDocument();
  });

  it("cancels a lease with a required reason plus confirmation", async () => {
    const cancel = vi.spyOn(apiClient, "cancelAdminLease").mockResolvedValue({} as never);
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByRole("button", { name: l.btnCancelLease }));
    const dialog = await screen.findByRole("dialog", { name: l.cancelLeaseTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: l.btnCancelLease }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Tenant withdrew" } });
    fireEvent.click(within(dialog).getByRole("button", { name: l.btnCancelLease }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: l.btnCancelLease }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.any(String), "l1", "Tenant withdrew", "Cash"));
  });

  it("keeps the cancel dialog open when the API fails", async () => {
    vi.spyOn(apiClient, "cancelAdminLease").mockRejectedValue(new Error("billed"));
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByRole("button", { name: l.btnCancelLease }));
    const dialog = await screen.findByRole("dialog", { name: l.cancelLeaseTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Tenant withdrew" } });
    fireEvent.click(within(dialog).getByRole("button", { name: l.btnCancelLease }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: l.btnCancelLease }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: l.cancelLeaseTitle })).toBeInTheDocument();
  });

  it("edits an occupant inline and sends a blank identity as undefined", async () => {
    const update = vi.spyOn(apiClient, "updateAdminLeaseOccupant").mockResolvedValue(lease());
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByLabelText(`${tc.edit} Mali Dee`));
    const name = await screen.findByPlaceholderText(l.fieldFullName);
    fireEvent.change(name, { target: { value: "Mali Rak" } });
    fireEvent.click(screen.getByLabelText(tc.save));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(expect.any(String), "l1", "o1", expect.objectContaining({ fullName: "Mali Rak", identityNumber: undefined }))
    );
  });

  it("deletes an occupant and a vehicle only after confirmation", async () => {
    const delOcc = vi.spyOn(apiClient, "deleteAdminLeaseOccupant").mockResolvedValue(lease());
    const delVeh = vi.spyOn(apiClient, "deleteAdminLeaseVehicle").mockResolvedValue(lease());
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByLabelText(`${tc.delete} Mali Dee`));
    expect(delOcc).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: tc.delete }));
    await waitFor(() => expect(delOcc).toHaveBeenCalledWith(expect.any(String), "l1", "o1"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(`${tc.delete} AB-1234`));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: tc.delete }));
    await waitFor(() => expect(delVeh).toHaveBeenCalledWith(expect.any(String), "l1", "v1"));
  });
});

describe("CRUD completeness: Meters", () => {
  it("deletes an unlocked reading with confirmation and optional reason", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminMeterReading").mockResolvedValue(sheet.rows[0]);
    renderAdmin(<BulkMeterReadingSection />);
    fireEvent.click(await screen.findByLabelText(`${m.btnDeleteReading} B-201`));
    const dialog = await screen.findByRole("dialog", { name: m.deleteReadingTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: m.btnDeleteReading }));
    const confirm = await screen.findByRole("alertdialog");
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: m.btnDeleteReading }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "22222222-2222-2222-2222-222222222222", expect.objectContaining({ overrideReason: undefined })));
  });

  it("requires a reason for a locked row and hides it without override permission", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminMeterReading").mockResolvedValue(sheet.rows[1]);
    const { unmount } = renderAdmin(<BulkMeterReadingSection />);
    fireEvent.click(await screen.findByLabelText(`${m.btnDeleteReading} B-202`));
    const dialog = await screen.findByRole("dialog", { name: m.deleteReadingTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: m.btnDeleteReading }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
    unmount();
    renderAdmin(<BulkMeterReadingSection />, ["admin.meters.record"]);
    await screen.findByLabelText(`${m.btnDeleteReading} B-201`);
    expect(screen.queryByLabelText(`${m.btnDeleteReading} B-202`)).not.toBeInTheDocument();
  });
});

describe("CRUD completeness: Billing", () => {
  it("opens the invoice detail through the single GET and edits only Draft lines", async () => {
    renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByLabelText(`${b.btnView} INV-0001`));
    expect(await screen.findByTestId("invoice-total")).toHaveTextContent("100 THB");
    expect(apiClient.getAdminInvoice).toHaveBeenCalledWith(expect.any(String), "i1");
    expect(screen.getByRole("button", { name: b.btnAddLine })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: b.btnVoid })).not.toBeInTheDocument();
  });

  it("validates a new line requires a Thai description", async () => {
    const add = vi.spyOn(apiClient, "addAdminInvoiceLine");
    renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByLabelText(`${b.btnView} INV-0001`));
    fireEvent.click(await screen.findByRole("button", { name: b.btnAddLine }));
    const dialog = await screen.findByRole("dialog", { name: b.addLineTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    expect(await within(dialog).findByText(b.errorDescriptionRequired)).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
  });

  it("adds a line with localized description", async () => {
    const add = vi.spyOn(apiClient, "addAdminInvoiceLine").mockResolvedValue(invoice("Draft"));
    renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByLabelText(`${b.btnView} INV-0001`));
    fireEvent.click(await screen.findByRole("button", { name: b.btnAddLine }));
    const dialog = await screen.findByRole("dialog", { name: b.addLineTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(b.placeholderDescriptionTh), { target: { value: "ค่าซ่อม" } });
    fireEvent.change(within(dialog).getByPlaceholderText(b.fieldLineAmount), { target: { value: "250" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith(expect.any(String), "i1", { description: { th: "ค่าซ่อม", en: undefined }, lineAmount: 250, taxMode: "VatIncluded" })
    );
  });

  it("deletes a Draft line only after confirmation", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminInvoiceLine").mockResolvedValue(invoice("Draft"));
    renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByLabelText(`${b.btnView} INV-0001`));
    fireEvent.click(await screen.findByLabelText(`${tc.delete} ค่าเช่า`));
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: tc.delete }));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "i1", "ln1"));
  });

  it("voids an Issued invoice with reason + confirmation and hides void without permission", async () => {
    const voidSpy = vi.spyOn(apiClient, "voidAdminInvoice").mockResolvedValue(invoice("Voided"));
    const { unmount } = renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByLabelText(`${b.btnView} INV-0002`));
    expect(screen.queryByRole("button", { name: b.btnAddLine })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: b.btnVoid }));
    const dialog = await screen.findByRole("dialog", { name: b.voidTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: b.btnVoid }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Wrong amount" } });
    fireEvent.click(within(dialog).getByRole("button", { name: b.btnVoid }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: b.btnVoid }));
    await waitFor(() => expect(voidSpy).toHaveBeenCalledWith(expect.any(String), "i2", "Wrong amount"));
    unmount();
    renderAdmin(<BillingSection />, ["admin.billing.issue_batch"]);
    fireEvent.click(await screen.findByLabelText(`${b.btnView} INV-0002`));
    await screen.findByTestId("invoice-total");
    expect(screen.queryByRole("button", { name: b.btnVoid })).not.toBeInTheDocument();
  });

  it("shows refreshed invoices from a batch run", async () => {
    vi.spyOn(apiClient, "runAdminBatchInvoices").mockResolvedValue({
      period: "2026-11",
      created: [],
      refreshed: [invoice("Draft", { id: "i9", documentNumber: "INV-REFRESHED" })],
      skipped: [],
    });
    renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByRole("button", { name: b.btnRunBatch }));
    expect(await screen.findByTestId("batch-refreshed")).toHaveTextContent("INV-REFRESHED");
  });
});

describe("CRUD completeness: Cashier", () => {
  it("cancels an Open shift with no activity using reason + confirmation", async () => {
    const cancel = vi.spyOn(apiClient, "cancelAdminCashierShift").mockResolvedValue(shift("Cancelled"));
    renderAdmin(<CashierShiftSection />);
    fireEvent.click(await screen.findByLabelText(`${c.btnViewShift} SHF-0001`));
    fireEvent.click(await screen.findByRole("button", { name: c.btnCancelShift }));
    const dialog = await screen.findByRole("dialog", { name: c.cancelTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: c.btnCancelShift }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Opened by mistake" } });
    fireEvent.click(within(dialog).getByRole("button", { name: c.btnCancelShift }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: c.btnCancelShift }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.any(String), "s1", "Opened by mistake"));
  });

  it("blocks cancel when the shift has cash activity", async () => {
    vi.mocked(apiClient.getAdminCashierShift).mockResolvedValue(shift("Open", { cashReceiptsInShift: 300 }));
    renderAdmin(<CashierShiftSection />);
    fireEvent.click(await screen.findByLabelText(`${c.btnViewShift} SHF-0001`));
    expect(await screen.findByText(c.cancelBlockedHint)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.btnCancelShift })).not.toBeInTheDocument();
  });

  it("edits the variance remark of a Closed shift and never offers delete", async () => {
    const remark = vi.spyOn(apiClient, "updateAdminCashierShiftRemark").mockResolvedValue(shift("Closed"));
    renderAdmin(<CashierShiftSection />);
    fireEvent.click(await screen.findByLabelText(`${c.btnViewShift} SHF-0002`));
    expect(await screen.findByTestId("shift-no-delete-hint")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.btnCancelShift })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: c.btnEditRemark }));
    const dialog = await screen.findByRole("dialog", { name: c.editRemarkTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(c.placeholderVarianceRemark), { target: { value: "Counted twice" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(remark).toHaveBeenCalledWith(expect.any(String), "s2", { varianceRemark: "Counted twice" }));
  });

  it("hides cancel and remark actions without cashier permissions", async () => {
    renderAdmin(<CashierShiftSection />, []);
    fireEvent.click(await screen.findByLabelText(`${c.btnViewShift} SHF-0001`));
    await screen.findByText(c.detailTitle);
    expect(screen.queryByRole("button", { name: c.btnCancelShift })).not.toBeInTheDocument();
  });
});

describe("CRUD completeness: Payments and Deposits", () => {
  it("loads the slip detail through the single GET", async () => {
    const download = vi.spyOn(apiClient, "downloadAdminFile").mockResolvedValue(new Blob(["x"], { type: "application/pdf" }));
    renderAdmin(<PaymentSlipQueueSection />);
    fireEvent.click(await screen.findByText("INV-S1"));
    await waitFor(() => expect(download).toHaveBeenCalledWith("slips/detail-key.png"));
    expect(apiClient.getAdminPaymentSlip).toHaveBeenCalledWith(expect.any(String), "sl1");
    expect(p.title).toBeTruthy();
  });

  it("explains that deposits are read-only and loads ledger detail via GET", async () => {
    renderAdmin(<DepositRegisterSection />);
    expect(await screen.findByTestId("deposit-readonly-hint")).toHaveTextContent(d.readOnlyHint);
    fireEvent.click(await screen.findByLabelText(`${d.colTransactions} LSE-1`));
    expect(await screen.findByTestId("deposit-transactions")).toHaveTextContent("DEP-DETAIL");
    expect(apiClient.getAdminDepositLedger).toHaveBeenCalledWith(expect.any(String), "d1");
    expect(screen.queryByLabelText(new RegExp(tc.delete))).not.toBeInTheDocument();
  });
});
