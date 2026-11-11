import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { daysOverdue } from "@/lib/due-date";
import { clearAllToasts, getActiveToasts } from "@/components/ui/toast";
import { BillingSection } from "@/features/billing/components/BillingSection";
import { PaymentSlipQueueSection } from "@/features/payments/components/PaymentSlipQueueSection";
import { WorkOrdersListSection } from "@/features/work-orders/components/WorkOrdersListSection";
import { ParcelsListSection } from "@/features/parcels/components/ParcelsListSection";
import { AdminRbacUsersSection } from "@/features/users/components/AdminRbacUsersSection";
import { ClientInvoicesSection } from "@/features/client/components/ClientInvoicesSection";
import { ClientInvoiceDetail } from "@/features/client/components/ClientInvoiceDetail";
import { ClientParcelDetail } from "@/features/client/components/ClientParcelDetail";
import { ClientDashboardSection } from "@/features/client/components/ClientDashboardSection";
import { ClientNotificationsSection } from "@/features/notifications/components/ClientNotificationsSection";
import { LeaseCreateEditor } from "@/features/leases/components/LeaseCreateEditor";
import { LeaseDetailEditor } from "@/features/leases/components/LeaseDetailEditor";
import { DepositRegisterSection } from "@/features/deposits/components/DepositRegisterSection";
import { StayDetailEditor } from "@/features/stays/components/StayDetailEditor";
import ClientLayout from "@/app/(client)/client/layout";
import { LocaleProvider } from "@/components/shared/locale-provider";
import type { InvoiceItemDto } from "@/features/billing/types";
import type { LeaseItemDto } from "@/features/leases/types";
import type { StayDetailDto } from "@/generated/api";
import type { ReceiptItemDto } from "@/features/files/types";
import { resetSessionForTests, REFRESH_TOKEN_STORAGE_KEY } from "@/lib/auth/session-store";
import { renderAdmin, signInAs, customerRef, unitRef, hierarchy } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/client/dashboard",
}));

const tc = thMessages.common;
const bl = thMessages.admin.billing;
const cp = thMessages.client.portal;
const ls = thMessages.admin.leases;
const st = thMessages.admin.stays;
const rd = thMessages.common.reasonDialog;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const pagination = (page: number, pageSize = 25, totalCount = 60) => ({ page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) });

const invoice = (over: Partial<InvoiceItemDto> = {}): InvoiceItemDto => ({
  id: "i1",
  documentNumber: "INV-0001",
  status: "Overdue",
  billingPeriodYearMonth: "2026-11",
  customer: customerRef,
  unit: unitRef,
  lines: [],
  subTotal: 93,
  totalVatAmount: 7,
  totalAmount: 100,
  dueDate: daysAgo(3),
  ...over,
});

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
  occupants: [],
  vehicles: [],
  ...over,
});

beforeEach(() => {
  push.mockClear();
  clearAllToasts();
});
afterEach(() => vi.restoreAllMocks());

describe("F4 due dates and overdue", () => {
  it("computes overdue days only from backend status and due date", () => {
    expect(daysOverdue("Overdue", daysAgo(3))).toBe(3);
    expect(daysOverdue("Issued", daysAgo(3))).toBeNull();
    expect(daysOverdue("Overdue", null)).toBeNull();
    expect(daysOverdue("Overdue", daysAgo(-2))).toBeNull();
  });

  it("shows the due date and the overdue badge in the admin billing list, plus a plain date for issued invoices", async () => {
    vi.spyOn(apiClient, "getAdminInvoices").mockResolvedValue({ items: [invoice(), invoice({ id: "i2", documentNumber: "INV-0002", status: "Issued", dueDate: daysAgo(-5) })], pagination: pagination(1, 25, 2) });
    renderAdmin(<BillingSection />);
    expect(await screen.findByText("INV-0001")).toBeInTheDocument();
    const badges = screen.getAllByTestId("invoice-overdue-badge");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("3");
    expect(screen.getAllByTestId("invoice-due-date")).toHaveLength(2);
  });

  it("shows the due date on the payment slip queue", async () => {
    const slip = {
      id: "s1", invoiceId: "i1", invoiceDocumentNumber: "INV-S1", invoiceStatus: "Overdue", invoiceTotalAmount: 100, invoiceOutstandingAmount: 100,
      customer: customerRef, unit: unitRef, amount: 100, slipFileKey: "files/s1", status: "Pending", submittedAt: "2026-11-07T00:00:00Z", invoiceDueDate: daysAgo(2),
    };
    vi.spyOn(apiClient, "getAdminPaymentSlips").mockResolvedValue({ items: [slip], pagination: pagination(1, 25, 1) });
    renderAdmin(<PaymentSlipQueueSection />);
    expect(await screen.findByText("INV-S1")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-due-date")).toHaveTextContent(daysAgo(2));
    expect(screen.getByTestId("invoice-overdue-badge")).toBeInTheDocument();
  });

  it("shows due date and overdue state on the client invoice detail and on dashboard cards", async () => {
    vi.spyOn(apiClient, "getClientInvoice").mockResolvedValue({ invoice: invoice(), paidAmount: 0, outstandingAmount: 100, receipts: [], slips: [] });
    const first = renderAdmin(<ClientInvoiceDetail invoiceId="i1" />);
    expect(await screen.findByTestId("invoice-due-date")).toHaveTextContent(daysAgo(3));
    expect(screen.getByTestId("invoice-overdue-badge")).toBeInTheDocument();
    first.unmount();
    vi.spyOn(apiClient, "getClientNotifications").mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, "getClientDashboard").mockResolvedValue({
      customer: customerRef,
      activeHoldReservation: null,
      activeLease: null,
      unpaidInvoices: [{ id: "i1", documentNumber: "INV-0001", totalAmount: 100, status: "Overdue" }],
      pendingParcels: [],
    });
    renderAdmin(<ClientDashboardSection />);
    const badge = await screen.findByText(thMessages.admin.billing.status.Overdue);
    expect(badge.className).toContain("destructive");
  });
});

describe("F4 billing settings", () => {
  beforeEach(() => {
    vi.spyOn(apiClient, "getAdminInvoices").mockResolvedValue({ items: [], pagination: pagination(1, 25, 0) });
  });

  it("loads the effective terms, validates 0 to 365 and saves the value or null", async () => {
    vi.spyOn(apiClient, "getAdminBillingSettings").mockResolvedValue({ propertyId: "p1", paymentTermsDays: null, effectivePaymentTermsDays: 7 });
    const put = vi.spyOn(apiClient, "updateAdminBillingSettings").mockResolvedValue({ propertyId: "p1", paymentTermsDays: 30, effectivePaymentTermsDays: 30 });
    renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByRole("button", { name: bl.btnSettings }));
    const dialog = await screen.findByRole("dialog", { name: bl.settingsTitle });
    expect(await within(dialog).findByTestId("effective-terms")).toHaveTextContent("7");
    const input = document.getElementById("billing-terms") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "400" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    expect(await within(dialog).findByText(bl.errorPaymentTerms)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.any(String), { paymentTermsDays: 30 }));
  });

  it("sends null when cleared, and is read-only without admin.properties.manage", async () => {
    vi.spyOn(apiClient, "getAdminBillingSettings").mockResolvedValue({ propertyId: "p1", paymentTermsDays: 14, effectivePaymentTermsDays: 14 });
    const put = vi.spyOn(apiClient, "updateAdminBillingSettings").mockResolvedValue({ propertyId: "p1", paymentTermsDays: null, effectivePaymentTermsDays: 7 });
    const first = renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByRole("button", { name: bl.btnSettings }));
    const dialog = await screen.findByRole("dialog", { name: bl.settingsTitle });
    await within(dialog).findByTestId("effective-terms");
    fireEvent.change(document.getElementById("billing-terms") as HTMLInputElement, { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.any(String), { paymentTermsDays: null }));
    first.unmount();
    renderAdmin(<BillingSection />, ["admin.billing.issue_batch"]);
    fireEvent.click(await screen.findByRole("button", { name: bl.btnSettings }));
    const ro = await screen.findByRole("dialog", { name: bl.settingsTitle });
    await within(ro).findByTestId("effective-terms");
    expect(document.getElementById("billing-terms")).toBeDisabled();
    expect(within(ro).queryByRole("button", { name: tc.save })).not.toBeInTheDocument();
  });

  it("shows an error with retry when settings cannot be loaded", async () => {
    vi.spyOn(apiClient, "getAdminBillingSettings").mockRejectedValue(new Error("boom"));
    renderAdmin(<BillingSection />);
    fireEvent.click(await screen.findByRole("button", { name: bl.btnSettings }));
    expect(await screen.findByText(bl.settingsLoadError)).toBeInTheDocument();
  });
});

describe("F4 server-side pagination", () => {
  const nextBtn = () => screen.getByRole("button", { name: tc.table.next });
  const wo = (id: string) => ({ id, propertyId: "p1", documentNumber: `WKO-${id}`, status: "Open", priority: "Normal", unit: unitRef, issueSummary: "Leak", tenantChargeAmount: 0, createdAt: "2026-11-07T00:00:00Z" });

  it("admin work orders: sends page and pageSize, goes to the next page, resets on filter change and honours page size", async () => {
    const spy = vi.spyOn(apiClient, "getAdminWorkOrders").mockImplementation(async (_p, params) => ({
      items: [wo(`p${params?.page ?? 1}`)],
      pagination: pagination(params?.page ?? 1, params?.pageSize ?? 25, 60),
    }));
    renderAdmin(<WorkOrdersListSection />);
    expect(await screen.findByText("WKO-p1")).toBeInTheDocument();
    expect(spy).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ page: 1, pageSize: 25 }));
    expect(screen.getByRole("navigation", { name: tc.table.pagination })).toBeInTheDocument();
    fireEvent.click(nextBtn());
    expect(await screen.findByText("WKO-p2")).toBeInTheDocument();
    expect(spy).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ page: 2 }));
    fireEvent.change(screen.getByLabelText(thMessages.admin.workOrders.colStatus), { target: { value: "Completed" } });
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ status: "Completed", page: 1 })));
    expect(spy.mock.calls.some((c) => c[1]?.status === "Completed" && c[1]?.page === 2)).toBe(false);
    fireEvent.change(screen.getByLabelText(tc.table.rowsPerPage), { target: { value: "50" } });
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ pageSize: 50, page: 1 })));
  });

  it("admin parcels: previous is disabled on page 1 and the last page disables next", async () => {
    const spy = vi.spyOn(apiClient, "getAdminParcels").mockImplementation(async (_p, params) => ({
      items: [{ id: `pc${params?.page}`, propertyId: "p1", documentNumber: `PCL-${params?.page}`, status: "Arrived", unit: unitRef, customer: customerRef, carrierName: "Kerry", arrivedAt: "2026-11-07T00:00:00Z" }],
      pagination: pagination(params?.page ?? 1, 25, 30),
    }));
    renderAdmin(<ParcelsListSection />);
    await screen.findByText("PCL-1");
    expect(screen.getByRole("button", { name: tc.table.previous })).toBeDisabled();
    fireEvent.click(nextBtn());
    await screen.findByText("PCL-2");
    expect(nextBtn()).toBeDisabled();
    expect(spy).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ page: 2 }));
  });

  it("users: paginates through the API and keeps the table header on error", async () => {
    const spy = vi.spyOn(apiClient, "getAdminUsers").mockImplementation(async (params) => ({
      items: [{ id: `u${params?.page}`, username: `user${params?.page}`, fullName: `User ${params?.page}`, email: "u@x.io", roleCode: "A", roleName: { th: "บทบาท", en: "Role" }, isActive: true, allowedProperties: [], permissions: [] }],
      pagination: pagination(params?.page ?? 1, 25, 80),
    }));
    vi.spyOn(apiClient, "getAdminRoles").mockResolvedValue({ roles: [], permissions: [] });
    renderAdmin(<AdminRbacUsersSection />);
    await screen.findByText("User 1");
    fireEvent.click(nextBtn());
    await screen.findByText("User 2");
    expect(spy).toHaveBeenLastCalledWith({ page: 2, pageSize: 25 });
    spy.mockRejectedValue(new Error("boom"));
    fireEvent.click(nextBtn());
    expect(await screen.findByText(thMessages.admin.rbac.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: thMessages.admin.rbac.colUser }).length).toBeGreaterThan(0);
  });

  it("client invoices: page params, reset when the status filter changes", async () => {
    const dto = (n: number) => ({ invoice: invoice({ id: `i${n}`, documentNumber: `INV-${n}`, status: "Issued" }), paidAmount: 0, outstandingAmount: 100, receipts: [], slips: [] });
    const spy = vi.spyOn(apiClient, "getClientInvoices").mockImplementation(async (params) => ({ items: [dto(params?.page ?? 1)], pagination: pagination(params?.page ?? 1, 25, 60) }));
    renderAdmin(<ClientInvoicesSection />);
    await screen.findByText("INV-1");
    fireEvent.click(nextBtn());
    await screen.findByText("INV-2");
    expect(spy).toHaveBeenLastCalledWith({ page: 2, pageSize: 25, status: undefined });
    fireEvent.change(screen.getByLabelText(cp.invoices.colStatus), { target: { value: "Paid" } });
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith({ status: "Paid", page: 1, pageSize: 25 }));
  });

  it("client notifications show pagination controls from the response", async () => {
    const spy = vi.spyOn(apiClient, "getClientNotifications").mockImplementation(async (params) => ({
      items: [{ id: `n${params?.page}`, channel: "InApp", templateKey: "custom", title: { th: `แจ้งเตือน ${params?.page}`, en: "n" }, body: { th: "b", en: "b" }, isRead: true, createdAt: "2026-11-07T00:00:00Z" }],
      pagination: pagination(params?.page ?? 1, 25, 40),
    }));
    renderAdmin(<ClientNotificationsSection />);
    await screen.findByText("แจ้งเตือน 1");
    fireEvent.click(nextBtn());
    await screen.findByText("แจ้งเตือน 2");
    expect(spy).toHaveBeenLastCalledWith({ page: 2, pageSize: 25 });
  });
});

describe("F4 payment methods", () => {
  it("lease creation sends the deposit payment method (Cash by default, selectable)", async () => {
    vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
    vi.spyOn(apiClient, "searchAdminCustomers").mockResolvedValue({ items: [customerRef] });
    const create = vi.spyOn(apiClient, "createAdminLease").mockResolvedValue(lease());
    renderAdmin(<LeaseCreateEditor />);
    await waitFor(() => expect(screen.getByText(ls.btnSaveLease).closest("button")).not.toBeDisabled());
    expect((document.getElementById("lease-payment-method") as HTMLSelectElement).value).toBe("Cash");
    fireEvent.click(screen.getByLabelText(ls.fieldUnit, { exact: false }));
    fireEvent.click(await screen.findByText(/สตูดิโอ \(B-201\)/));
    fireEvent.click(screen.getByLabelText(ls.fieldCustomer, { exact: false }));
    fireEvent.click(await screen.findByText(/Somchai Jaidee/));
    fireEvent.change(screen.getByLabelText(ls.fieldStartDate, { exact: false }), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(ls.fieldEndDate, { exact: false }), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText(ls.fieldMonthlyRent, { exact: false }), { target: { value: "8500" } });
    fireEvent.blur(screen.getByLabelText(ls.fieldMonthlyRent, { exact: false }));
    fireEvent.change(document.getElementById("lease-payment-method") as HTMLSelectElement, { target: { value: "PromptPay" } });
    fireEvent.click(screen.getByText(ls.btnSaveLease));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByText(ls.btnSaveLease));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ paymentMethod: "PromptPay" })));
  });

  it("lease cancel sends the chosen refund method with the reason", async () => {
    vi.spyOn(apiClient, "getAdminLease").mockResolvedValue(lease());
    const cancel = vi.spyOn(apiClient, "cancelAdminLease").mockResolvedValue({} as never);
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByRole("button", { name: ls.btnCancelLease }));
    const dialog = await screen.findByRole("dialog", { name: ls.cancelLeaseTitle });
    expect((document.getElementById("cancel-refund-method") as HTMLSelectElement).value).toBe("Cash");
    fireEvent.change(document.getElementById("cancel-refund-method") as HTMLSelectElement, { target: { value: "BankTransfer" } });
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Tenant withdrew" } });
    fireEvent.click(within(dialog).getByRole("button", { name: ls.btnCancelLease }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: ls.btnCancelLease }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.any(String), "l1", "Tenant withdrew", "BankTransfer"));
  });

  it("settle move-out sends the refund payment method", async () => {
    vi.spyOn(apiClient, "getAdminLease").mockResolvedValue(lease({ status: "MoveOutNotice" }));
    const settle = vi.spyOn(apiClient, "settleAdminLeaseMoveOut").mockResolvedValue({ lease: lease(), deductedAmount: 0, refundedAmount: 17000 } as never);
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByRole("button", { name: ls.btnSettleMoveOut }));
    await screen.findByRole("dialog", { name: ls.settleTitle });
    fireEvent.change(document.getElementById("settle-refund-method") as HTMLSelectElement, { target: { value: "PromptPay" } });
    fireEvent.change(document.getElementById("settle-reason") as HTMLTextAreaElement, { target: { value: "Move out settled" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: ls.settleTitle })).getByRole("button", { name: ls.btnSettleMoveOut }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: ls.btnSettleMoveOut }));
    await waitFor(() => expect(settle).toHaveBeenCalledWith(expect.any(String), "l1", expect.objectContaining({ refundPaymentMethod: "PromptPay", reason: "Move out settled" })));
  });

  it("deposit register shows the payment method of each transaction", async () => {
    const ledger = {
      id: "d1", depositType: "LeaseSecurityDeposit", ownerDocumentNumber: "LSE-1", customer: customerRef, unit: unitRef, currentBalance: 500,
      transactions: [{ id: "t1", documentNumber: "DEP-1", transactionType: "Received", amount: 500, createdAt: "2026-11-01T00:00:00Z", paymentMethod: "PromptPay" }, { id: "t2", documentNumber: "DEP-2", transactionType: "Refunded", amount: 100, createdAt: "2026-11-02T00:00:00Z" }],
    };
    vi.spyOn(apiClient, "getAdminDepositLedgers").mockResolvedValue({ totalHeldBalance: 500, items: [ledger], pagination: pagination(1, 25, 1) });
    vi.spyOn(apiClient, "getAdminDepositLedger").mockResolvedValue(ledger);
    renderAdmin(<DepositRegisterSection />);
    fireEvent.click(await screen.findByLabelText(`${thMessages.admin.deposits.colTransactions} LSE-1`));
    const cells = await screen.findAllByTestId("tx-payment-method");
    expect(cells[0]).toHaveTextContent(st.methodPromptPay);
    expect(cells[1]).toHaveTextContent("-");
  });
});

describe("F4 stay and client receipts", () => {
  const receipt = (over: Partial<ReceiptItemDto> = {}): ReceiptItemDto => ({
    id: "r1", documentNumber: "RCT-0001", invoiceId: null, invoiceDocumentNumber: null, customer: customerRef, invoiceTotalAmount: 450, withholdingTaxAmount: 0,
    netPayableAmount: 450, isCashPayment: true, issuedAt: "2026-11-07T02:00:00Z", stayId: "st1", stayDocumentNumber: "STY-1", paymentMethod: "Cash", ...over,
  });
  const stay: StayDetailDto = {
    id: "st1", documentNumber: "STY-1", property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "B" } }, unit: unitRef, customer: customerRef, stayMode: "Hourly", status: "Active",
    checkInAt: "2026-11-07T01:00:00Z", isOvertime: false, keyDepositAmount: 500, keyDepositBalance: 500, folio: { id: "f", charges: [], totalCharges: 0, totalPayments: 0, balanceDue: 0 }, occupants: [],
  };

  it("lists only receipts tagged with the stay id, handles null invoice fields and downloads the PDF", async () => {
    vi.spyOn(apiClient, "getAdminStay").mockResolvedValue(stay);
    const list = vi.spyOn(apiClient, "listAdminReceipts").mockResolvedValue({ items: [receipt(), receipt({ id: "r2", documentNumber: "RCT-OTHER", stayId: "other" }), receipt({ id: "r3", documentNumber: "RCT-NOSTAY", stayId: null })] });
    const pdf = vi.spyOn(apiClient, "downloadAdminReceiptPdf").mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    vi.spyOn(window, "open").mockReturnValue(null);
    renderAdmin(<StayDetailEditor stayId="st1" />);
    const panel = await screen.findByTestId("stay-receipts");
    expect(await within(panel).findByText("RCT-0001")).toBeInTheDocument();
    expect(within(panel).queryByText("RCT-OTHER")).not.toBeInTheDocument();
    expect(within(panel).queryByText("RCT-NOSTAY")).not.toBeInTheDocument();
    expect(within(panel).getAllByText("-").length).toBeGreaterThan(0);
    expect(list).toHaveBeenCalledWith(expect.any(String));
    fireEvent.click(within(panel).getByRole("button", { name: st.btnDownloadReceipt }));
    await waitFor(() => expect(pdf).toHaveBeenCalledWith(expect.any(String), "r1"));
  });

  it("client receipts tab shows stay-linked receipts with PDF buttons and dashes for null invoices", async () => {
    vi.spyOn(apiClient, "getClientInvoices").mockResolvedValue({ items: [], pagination: pagination(1, 25, 0) });
    vi.spyOn(apiClient, "getClientReceipts").mockResolvedValue({ items: [receipt()] });
    const pdf = vi.spyOn(apiClient, "downloadClientReceiptPdf").mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    vi.spyOn(window, "open").mockReturnValue(null);
    renderAdmin(<ClientInvoicesSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: cp.invoices.tabReceipts }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: cp.invoices.tabReceipts }));
    expect(await screen.findByText("RCT-0001")).toBeInTheDocument();
    expect(screen.getByText("STY-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: cp.invoices.btnDownloadReceipt }));
    await waitFor(() => expect(pdf).toHaveBeenCalledWith("r1"));
  });
});

describe("F4 client parcel detail", () => {
  it("loads a parcel via GET, shows its fields and an error state with retry", async () => {
    const spy = vi.spyOn(apiClient, "getClientParcel").mockResolvedValue({
      id: "pc1", propertyId: "p1", documentNumber: "PCL-0001", status: "PickedUp", unit: unitRef, customer: customerRef, carrierName: "Kerry", trackingNumber: "TH123",
      arrivedAt: "2026-11-07T01:00:00Z", pickedUpAt: "2026-11-07T05:00:00Z", recipientName: "Mali",
    });
    const first = renderAdmin(<ClientParcelDetail parcelId="pc1" />);
    expect(await screen.findByText("PCL-0001")).toBeInTheDocument();
    expect(screen.getByText("TH123")).toBeInTheDocument();
    expect(screen.getByText("Mali")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("pc1");
    first.unmount();
    spy.mockRejectedValue(new Error("boom"));
    renderAdmin(<ClientParcelDetail parcelId="pc1" />);
    expect(await screen.findByText(cp.parcels.detailLoadError)).toBeInTheDocument();
  });
});

describe("F4 sign-out and notification templates", () => {
  const renderLayout = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["secret"], { token: "x" });
    signInAs("client");
    const result = render(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="th" messages={thMessages}>
          <LocaleProvider>
            <ClientLayout>
              <div />
            </ClientLayout>
          </LocaleProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    return { queryClient, ...result };
  };

  it("calls the logout endpoint, clears browser storage and the query cache, then routes to /login", async () => {
    const logout = vi.spyOn(apiClient, "logout").mockResolvedValue(undefined);
    const { queryClient } = renderLayout();
    expect(screen.getByText(thMessages.client.portal.nav.badge)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: tc.logout }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login?scope=client"));
    expect(logout).toHaveBeenCalledWith("refresh-token-1");
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(queryClient.getQueryData(["secret"])).toBeUndefined();
  });

  it("still ends the local session when the logout call fails", async () => {
    vi.spyOn(apiClient, "logout").mockRejectedValue(new Error("offline"));
    const { queryClient } = renderLayout();
    fireEvent.click(screen.getByRole("button", { name: tc.logout }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login?scope=client"));
    expect(queryClient.getQueryData(["secret"])).toBeUndefined();
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("renders template titles through i18n and never shows raw template codes", async () => {
    const item = (id: string, templateKey: string) => ({ id, channel: "InApp" as const, templateKey, title: { th: `ชื่อจากเซิร์ฟเวอร์ ${templateKey}`, en: "srv" }, body: { th: `เนื้อหา ${id}`, en: "b" }, isRead: false, createdAt: "2026-11-07T00:00:00Z" });
    vi.spyOn(apiClient, "getClientNotifications").mockResolvedValue({
      items: [item("1", "invoice.overdue"), item("2", "parcel.arrived"), item("3", "lease.intent_approved"), item("4", "lease.intent_rejected"), item("5", "custom.unknown")],
      pagination: pagination(1, 25, 5),
    });
    renderAdmin(<ClientNotificationsSection />);
    expect(await screen.findByText(thMessages.client.notifications.templates.invoiceOverdue)).toBeInTheDocument();
    expect(screen.getByText(thMessages.client.notifications.templates.parcelArrived)).toBeInTheDocument();
    expect(screen.getByText(thMessages.client.notifications.templates.leaseIntentApproved)).toBeInTheDocument();
    expect(screen.getByText(thMessages.client.notifications.templates.leaseIntentRejected)).toBeInTheDocument();
    expect(screen.queryByText(/invoice\.overdue|parcel\.arrived|lease\.intent_/)).not.toBeInTheDocument();
    expect(screen.getByText("ชื่อจากเซิร์ฟเวอร์ custom.unknown")).toBeInTheDocument();
    expect(getActiveToasts()).toHaveLength(0);
  });
});
