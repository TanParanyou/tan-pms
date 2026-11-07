import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { AdminWorkspaceProvider } from "@/components/shared/admin-workspace-provider";
import { PermissionProvider } from "@/hooks/use-permission";
import { CashierShiftSection } from "@/features/cashier/components/CashierShiftSection";
import { PaymentSlipQueueSection } from "@/features/payments/components/PaymentSlipQueueSection";
import { DepositRegisterSection } from "@/features/deposits/components/DepositRegisterSection";
import type { CashierShiftDto } from "@/features/cashier/types";
import type { AdminPaymentSlipDto } from "@/features/payments/types";
import type { DepositLedgerListResponse } from "@/features/deposits/types";

const c = thMessages.admin.cashier;
const p = thMessages.admin.payments;
const d = thMessages.admin.deposits;

const shift = (over: Partial<CashierShiftDto> = {}): CashierShiftDto => ({
  id: "s1",
  documentNumber: "BKK01-SHF-2611-0001",
  cashierUserId: "u1",
  status: "Open",
  openingFloatCash: 1000,
  cashReceiptsInShift: 500,
  cashDepositsReceivedInShift: 200,
  cashDepositsRefundedInShift: 100,
  expectedDrawerCash: 1600,
  openedAt: "2026-11-07T01:00:00Z",
  ...over,
});

const unitRef = {
  id: "u-a",
  unitNumber: "A-101",
  buildingName: { th: "อาคาร A", en: "Building A" },
  floorNumber: 1,
  unitTypeName: { th: "สตูดิโอ", en: "Studio" },
};
const customer = { id: "c1", fullName: "Somchai Jaidee", maskedNationalId: "1-XXXX" };
const slip = (id: string, status: string, over: Partial<AdminPaymentSlipDto> = {}): AdminPaymentSlipDto => ({
  id,
  invoiceId: "inv1",
  invoiceDocumentNumber: `INV-${id}`,
  invoiceStatus: "Issued",
  invoiceTotalAmount: 1000,
  invoiceOutstandingAmount: 1000,
  customer,
  unit: unitRef,
  amount: 1000,
  slipFileKey: `slips/${id}.png`,
  status,
  submittedAt: "2026-11-07T02:00:00Z",
  ...over,
});

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

beforeEach(() => {
  vi.spyOn(apiClient, "getAdminCurrentCashierShift").mockResolvedValue({ shift: shift() });
  vi.spyOn(apiClient, "getAdminCashierShifts").mockResolvedValue({
    items: [shift(), shift({ id: "s2", documentNumber: "SHF-2", status: "Closed", actualCashCounted: 1600, cashVariance: 0 })],
  });
  vi.spyOn(apiClient, "getAdminPaymentSlips").mockImplementation(async (_pid, params) => ({
    items: params?.status === "Approved"
      ? [slip("ap", "Approved", { reviewedByUserId: "rev1", reviewedAt: "2026-11-07T03:00:00Z", receiptDocumentNumber: "RCT-9" })]
      : [slip("pd", "Pending")],
  }));
});
afterEach(() => vi.restoreAllMocks());

describe("PM-08: Cashier shifts", () => {
  it("renders the current shift expected drawer cash", async () => {
    renderWith(<CashierShiftSection />);
    expect(await screen.findByTestId("shift-expected-cash")).toHaveTextContent("1,600 THB");
  });

  it("shows an open prompt when there is no open shift and opens a shift", async () => {
    vi.mocked(apiClient.getAdminCurrentCashierShift).mockResolvedValue({ shift: null });
    const open = vi.spyOn(apiClient, "openAdminCashierShift").mockResolvedValue(shift());
    renderWith(<CashierShiftSection />);
    expect(await screen.findByText(c.openPrompt)).toBeInTheDocument();
    fireEvent.click(screen.getByText(c.openDrawer));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(c.openingFloat), { target: { value: "500" } });
    fireEvent.click(within(dialog).getAllByText(c.openDrawer)[0]);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
  });

  it("requires a remark only when variance is not zero", async () => {
    const close = vi.spyOn(apiClient, "closeAdminCashierShift").mockResolvedValue(shift({ status: "Closed" }));
    renderWith(<CashierShiftSection />);
    await screen.findByTestId("shift-expected-cash");
    fireEvent.click(screen.getByText(c.closeDrawer));
    const dialog = await screen.findByRole("dialog");
    const counted = within(dialog).getByPlaceholderText(c.actualCashCounted);
    fireEvent.change(counted, { target: { value: "1500" } });
    expect(within(dialog).getByTestId("close-variance")).toHaveTextContent("-100 THB");
    fireEvent.click(within(dialog).getByText(c.closeDrawer));
    expect(await within(dialog).findByText(c.errorRemarkRequired)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();

    fireEvent.change(counted, { target: { value: "1600" } });
    fireEvent.click(within(dialog).getByText(c.closeDrawer));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByText(c.closeDrawer));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it("offers reconcile only for Closed shifts with permission", async () => {
    const { unmount } = renderWith(<CashierShiftSection />);
    await screen.findByText("SHF-2");
    expect(screen.getAllByText(c.btnReconcile)).toHaveLength(1);
    unmount();
    renderWith(<CashierShiftSection />, ["admin.cashier.operate_shift"]);
    await screen.findByText("SHF-2");
    expect(screen.queryByText(c.btnReconcile)).not.toBeInTheDocument();
  });

  it("hides open/close actions without operate permission", async () => {
    renderWith(<CashierShiftSection />, []);
    await screen.findByTestId("shift-expected-cash");
    expect(screen.queryByText(c.closeDrawer)).not.toBeInTheDocument();
  });

  it("guards double close submit", async () => {
    let resolve: (v: CashierShiftDto) => void = () => undefined;
    const close = vi.spyOn(apiClient, "closeAdminCashierShift").mockImplementation(
      () => new Promise<CashierShiftDto>((r) => { resolve = r; })
    );
    renderWith(<CashierShiftSection />);
    await screen.findByTestId("shift-expected-cash");
    fireEvent.click(screen.getByText(c.closeDrawer));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(c.actualCashCounted), { target: { value: "1600" } });
    fireEvent.click(within(dialog).getByText(c.closeDrawer));
    const confirm = await screen.findByRole("alertdialog");
    const btn = within(confirm).getByText(c.closeDrawer).closest("button")!;
    fireEvent.click(btn);
    fireEvent.click(btn);
    await act(async () => { await Promise.resolve(); });
    expect(close).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(shift({ status: "Closed" })); });
  });
});

describe("PM-08: Payment slip queue", () => {
  it("defaults to Pending and shows slip rows", async () => {
    renderWith(<PaymentSlipQueueSection />);
    expect(await screen.findByText("INV-pd")).toBeInTheDocument();
    expect(apiClient.getAdminPaymentSlips).toHaveBeenCalledWith(expect.any(String), { status: "Pending" });
  });

  it("requires confirmation to approve and invalidates operational caches", async () => {
    const approve = vi.spyOn(apiClient, "approveAdminPaymentSlip").mockResolvedValue(slip("pd", "Approved"));
    const { queryClient } = renderWith(<PaymentSlipQueueSection />);
    fireEvent.click(await screen.findByText("INV-pd"));
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(await screen.findByText(p.btnApprove));
    expect(approve).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByText(p.btnApprove));
    await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const keys = spy.mock.calls.map((x) => JSON.stringify(x[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.payments.all));
      expect(keys).toContain(JSON.stringify(queryKeys.billing.all));
      expect(keys).toContain(JSON.stringify(queryKeys.cashier.all));
      expect(keys).toContain(JSON.stringify(queryKeys.depositLedgers.all));
    });
  });

  it("requires a reason to reject", async () => {
    const reject = vi.spyOn(apiClient, "rejectAdminPaymentSlip").mockResolvedValue(slip("pd", "Rejected"));
    renderWith(<PaymentSlipQueueSection />);
    fireEvent.click(await screen.findByText("INV-pd"));
    fireEvent.click(await screen.findByText(p.btnReject));
    const dialog = await screen.findByRole("dialog", { name: p.rejectTitle });
    fireEvent.click(within(dialog).getByText(p.btnReject));
    expect(await within(dialog).findByText(p.errorReasonRequired)).toBeInTheDocument();
    expect(reject).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByPlaceholderText(p.placeholderRejectReason), { target: { value: "Wrong amount" } });
    fireEvent.click(within(dialog).getByText(p.btnReject));
    await waitFor(() => expect(reject).toHaveBeenCalledWith(expect.any(String), "pd", { reason: "Wrong amount" }));
  });

  it("hides approve and reject without verify permission", async () => {
    renderWith(<PaymentSlipQueueSection />, []);
    fireEvent.click(await screen.findByText("INV-pd"));
    await screen.findByText(p.detailTitle);
    expect(screen.queryByText(p.btnApprove)).not.toBeInTheDocument();
    expect(screen.queryByText(p.btnReject)).not.toBeInTheDocument();
  });

  it("shows reviewer info and receipt for approved slips", async () => {
    renderWith(<PaymentSlipQueueSection />);
    await screen.findByText("INV-pd");
    fireEvent.click(screen.getByText(p.status.Approved));
    fireEvent.click(await screen.findByText("INV-ap"));
    const info = await screen.findByTestId("slip-review-info");
    expect(info).toHaveTextContent("rev1");
    expect(info).toHaveTextContent("RCT-9");
  });
});

describe("PM-08: Deposit register", () => {
  const ledgers: DepositLedgerListResponse = {
    totalHeldBalance: 12500,
    items: [
      {
        id: "d1",
        depositType: "LeaseSecurityDeposit",
        ownerDocumentNumber: "LSE-1",
        customer,
        unit: unitRef,
        currentBalance: 12500,
        transactions: [
          { id: "t1", documentNumber: "DEP-1", transactionType: "Received", amount: 12500, createdAt: "2026-11-01T00:00:00Z" },
        ],
      },
    ],
  };

  it("shows total held balance labelled as not revenue, filters by type and expands transactions", async () => {
    const get = vi.spyOn(apiClient, "getAdminDepositLedgers").mockResolvedValue(ledgers);
    renderWith(<DepositRegisterSection />);
    expect(await screen.findByText("LSE-1")).toBeInTheDocument();
    expect(screen.getAllByText("12,500 THB").length).toBeGreaterThan(0);
    expect(screen.getByText(d.notRevenue)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(d.colType), { target: { value: "KeyDeposit" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.any(String), { type: "KeyDeposit" }));
    fireEvent.change(screen.getByLabelText(d.colType), { target: { value: "" } });
    fireEvent.click(await screen.findByLabelText(`${d.colTransactions} LSE-1`));
    expect(await screen.findByTestId("deposit-transactions")).toHaveTextContent("DEP-1");
  });
});
