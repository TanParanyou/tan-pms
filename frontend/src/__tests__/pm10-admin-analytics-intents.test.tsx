import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { LeaseIntentsSection } from "@/features/lease-intents/components/LeaseIntentsSection";
import { PaymentSlipQueueSection } from "@/features/payments/components/PaymentSlipQueueSection";
import { UnitMasterEditor } from "@/features/properties/components/UnitMasterEditor";
import { AnalyticsSection } from "@/features/analytics/components/AnalyticsSection";
import { ADMIN_NAV_GROUPS } from "@/components/layout/admin-sidebar";
import type { LeaseIntentDto } from "@/features/client/types";
import { renderAdmin, unitRef, customerRef, hierarchy } from "./test-utils";

const li = thMessages.admin.leaseIntents;
const an = thMessages.admin.analytics;
const ci = thMessages.client.portal.intent;
const rd = thMessages.common.reasonDialog;

const intent = (over: Partial<LeaseIntentDto> = {}): LeaseIntentDto => ({
  id: "in1",
  propertyId: "p1",
  leaseId: "l1",
  leaseDocumentNumber: "LSE-0001",
  unit: unitRef,
  customer: customerRef,
  intentType: "Renew",
  desiredDate: "2027-06-30",
  status: "Pending",
  createdAt: "2026-11-07T01:00:00Z",
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("PM-10 admin lease intents queue", () => {
  it("defaults to Pending, filters through the API, and has empty and error states", async () => {
    const spy = vi.spyOn(apiClient, "getAdminLeaseIntents").mockResolvedValue({ items: [intent()] });
    renderAdmin(<LeaseIntentsSection />);
    expect(await screen.findByText("LSE-0001")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(expect.any(String), { status: "Pending", page: 1, pageSize: 25 });
    spy.mockResolvedValue({ items: [] });
    fireEvent.change(screen.getByLabelText(li.colStatus), { target: { value: "Approved" } });
    expect(await screen.findByText(li.emptyTitle)).toBeInTheDocument();
    spy.mockRejectedValue(new Error("boom"));
    fireEvent.change(screen.getByLabelText(li.colStatus), { target: { value: "Rejected" } });
    expect(await screen.findByText(li.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: li.colLease }).length).toBeGreaterThan(0);
  });

  it("explains Renew versus MoveOut and approves only after confirmation, then invalidates operational caches", async () => {
    vi.spyOn(apiClient, "getAdminLeaseIntents").mockResolvedValue({
      items: [intent(), intent({ id: "in2", leaseDocumentNumber: "LSE-0002", intentType: "MoveOut" })],
    });
    const approve = vi.spyOn(apiClient, "approveAdminLeaseIntent").mockResolvedValue(intent({ status: "Approved" }));
    const { queryClient } = renderAdmin(<LeaseIntentsSection />);
    await screen.findByText("LSE-0002");
    fireEvent.click(screen.getByRole("button", { name: `${li.btnApprove} LSE-0002` }));
    const moveOut = await screen.findByRole("alertdialog");
    expect(within(moveOut).getByText(li.confirmApproveMoveOut)).toBeInTheDocument();
    fireEvent.click(within(moveOut).getByRole("button", { name: li.btnApprove }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith(expect.any(String), "in2"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: `${li.btnApprove} LSE-0001` }));
    const renew = await screen.findByRole("alertdialog");
    expect(within(renew).getByText(li.confirmApproveRenew)).toBeInTheDocument();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(within(renew).getByRole("button", { name: li.btnApprove }));
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.leaseIntents.all));
      expect(keys).toContain(JSON.stringify(queryKeys.leases.all));
    });
  });

  it("requires a reason then a confirmation to reject", async () => {
    vi.spyOn(apiClient, "getAdminLeaseIntents").mockResolvedValue({ items: [intent()] });
    const reject = vi.spyOn(apiClient, "rejectAdminLeaseIntent").mockResolvedValue(intent({ status: "Rejected" }));
    renderAdmin(<LeaseIntentsSection />);
    fireEvent.click(await screen.findByRole("button", { name: `${li.btnReject} LSE-0001` }));
    const dialog = await screen.findByRole("dialog", { name: li.rejectTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: li.btnReject }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    expect(reject).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Policy conflict" } });
    fireEvent.click(within(dialog).getByRole("button", { name: li.btnReject }));
    const confirm = await screen.findByRole("alertdialog");
    expect(reject).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: li.btnReject }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith(expect.any(String), "in1", "Policy conflict"));
  });

  it("offers no actions for reviewed requests and shows the reject reason", async () => {
    vi.spyOn(apiClient, "getAdminLeaseIntents").mockResolvedValue({
      items: [intent({ status: "Rejected", rejectReason: "Policy conflict", reviewedBy: { id: "u1", fullName: "Manager Mali" } })],
    });
    renderAdmin(<LeaseIntentsSection />);
    expect(await screen.findByText("Policy conflict")).toBeInTheDocument();
    expect(screen.getByText("Manager Mali")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText(ci.status.Rejected)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(li.btnApprove) })).not.toBeInTheDocument();
  });

  it("hides the queue and does not call the API without admin.leases.manage", async () => {
    const spy = vi.spyOn(apiClient, "getAdminLeaseIntents").mockResolvedValue({ items: [] });
    renderAdmin(<LeaseIntentsSection />, []);
    expect(await screen.findByText(li.noPermission)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("PM-10 admin analytics", () => {
  const occupancy = {
    from: "2026-10-01",
    to: "2026-10-31",
    nights: 30,
    totalUnits: 10,
    availableUnitNights: 300,
    occupiedUnitNights: 150,
    occupancyRate: 0.5,
    byStayMode: [{ stayMode: "Daily", occupiedUnitNights: 90, occupancyRate: 0.3 }],
    byBuilding: [{ buildingId: "b1", buildingName: { th: "อาคาร B", en: "Building B" }, units: 10, availableUnitNights: 300, occupiedUnitNights: 150, occupancyRate: 0.5 }],
  };
  const revpar = { from: "2026-10-01", to: "2026-10-31", availableUnitNights: 300, folioRoomRevenue: 30000, leaseRentRevenue: 20000, roomRevenue: 50000, revPar: 166.67 };
  const bucket = { current: 100, days1To30: 200, days31To60: 0, days61To90: 0, days90Plus: 0, total: 300 };
  const aging = { asOf: "2026-10-31", totals: bucket, customers: [{ customer: customerRef, invoiceCount: 2, buckets: bucket }] };
  const cashier = {
    from: "2026-10-01", to: "2026-10-31", shiftCount: 3, openCount: 0, closedCount: 3, reconciledCount: 0, cancelledCount: 0,
    cashReceiptsTotal: 9000, depositsReceivedTotal: 500, depositsRefundedTotal: 0, varianceTotal: -50, shiftsWithVariance: 1, receiptCount: 5, receiptNetTotal: 9000,
    cashiers: [{ cashier: { id: "u1", fullName: "Cashier Somsri" }, shiftCount: 3, cashReceiptsTotal: 9000, varianceTotal: -50 }],
  };
  const deposits = {
    from: "2026-10-01", to: "2026-10-31", classification: "Liability", totalHeldBalance: 17500,
    byType: [{ depositType: "LeaseSecurityDeposit", ledgerCount: 1, heldBalance: 17000, receivedInPeriod: 0, deductedInPeriod: 0, refundedInPeriod: 0 }],
  };

  const mockAll = () => ({
    occ: vi.spyOn(apiClient, "getAdminAnalytics").mockImplementation(async (_p, report) => {
      const map = { occupancy, revpar, "receivables-aging": aging, "cashier-shifts": cashier, deposits } as const;
      return map[report] as never;
    }),
  });

  it("renders every section with one inverted card and a liability-labelled deposit summary", async () => {
    const { occ } = mockAll();
    const { container } = renderAdmin(<AnalyticsSection />);
    expect(await screen.findByText("Cashier Somsri")).toBeInTheDocument();
    expect(screen.getAllByText("50.0%").length).toBeGreaterThan(0);
    expect(screen.getByTestId("aging-total")).toHaveTextContent("300");
    expect(screen.getByText(an.depositLiabilityLabel)).toBeInTheDocument();
    expect(container.querySelectorAll(".inverted-card")).toHaveLength(1);
    expect(occ).toHaveBeenCalledTimes(5);
    const range = occ.mock.calls[0]?.[2];
    expect(range && range.from !== undefined && range.to !== undefined && range.from <= range.to).toBe(true);
  });

  it("keeps each section table with an error and retry when one report fails", async () => {
    vi.spyOn(apiClient, "getAdminAnalytics").mockImplementation(async (_p, report) => {
      if (report === "receivables-aging") throw new Error("boom");
      const map = { occupancy, revpar, "cashier-shifts": cashier, deposits } as const;
      return map[report as keyof typeof map] as never;
    });
    renderAdmin(<AnalyticsSection />);
    expect(await screen.findByText("Cashier Somsri")).toBeInTheDocument();
    expect(await screen.findByText(an.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: an.colCustomer }).length).toBeGreaterThan(0);
  });

  it("does not call the API for an invalid range", async () => {
    const { occ } = mockAll();
    renderAdmin(<AnalyticsSection />);
    await screen.findByText("Cashier Somsri");
    occ.mockClear();
    fireEvent.change(document.getElementById("analytics-from") as HTMLInputElement, { target: { value: "2099-01-01" } });
    expect(await screen.findByText(an.errorRange)).toBeInTheDocument();
    expect(occ).not.toHaveBeenCalled();
  });

  it("hides the page and skips the API without admin.analytics.read", async () => {
    const { occ } = mockAll();
    renderAdmin(<AnalyticsSection />, []);
    expect(await screen.findByText(an.noPermission)).toBeInTheDocument();
    expect(occ).not.toHaveBeenCalled();
  });
});

describe("PM-10 admin navigation", () => {
  it("lists lease requests and analytics in the sidebar", () => {
    const hrefs = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/admin/lease-intents");
    expect(hrefs).toContain("/admin/analytics");
  });
});

describe("PM-10 leftovers", () => {
  it("shows receipts with a PDF download in the detail of an approved slip", async () => {
    const approved = {
      id: "sl1", invoiceId: "i1", invoiceDocumentNumber: "INV-S1", invoiceStatus: "Paid", invoiceTotalAmount: 1000, invoiceOutstandingAmount: 0,
      customer: customerRef, unit: unitRef, amount: 1000, slipFileKey: "files/s1", status: "Approved", submittedAt: "2026-11-07T02:00:00Z", receiptDocumentNumber: "RCT-1",
    };
    vi.spyOn(apiClient, "getAdminPaymentSlips").mockResolvedValue({ items: [approved] });
    vi.spyOn(apiClient, "getAdminPaymentSlip").mockResolvedValue(approved);
    vi.spyOn(apiClient, "downloadAdminFile").mockResolvedValue(new Blob(["x"], { type: "image/png" }));
    const receipts = vi.spyOn(apiClient, "listAdminReceipts").mockResolvedValue({
      items: [{ id: "r1", documentNumber: "RCT-1", invoiceId: "i1", invoiceDocumentNumber: "INV-S1", customer: customerRef, invoiceTotalAmount: 1000, withholdingTaxAmount: 0, netPayableAmount: 1000, isCashPayment: false, issuedAt: "2026-11-07T03:00:00Z" }],
    });
    const pdf = vi.spyOn(apiClient, "downloadAdminReceiptPdf").mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    vi.spyOn(window, "open").mockReturnValue(null);
    renderAdmin(<PaymentSlipQueueSection />);
    fireEvent.click(await screen.findByText(thMessages.admin.payments.status.Approved));
    fireEvent.click(await screen.findByText("INV-S1"));
    await waitFor(() => expect(receipts).toHaveBeenCalledWith(expect.any(String), { invoiceId: "i1" }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(thMessages.admin.billing.btnDownloadReceipt.replace(/[()]/g, "\\$&")) }));
    await waitFor(() => expect(pdf).toHaveBeenCalledWith(expect.any(String), "r1"));
  });

  it("shows an error state instead of a sample unit when the single-unit GET fails", async () => {
    vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
    vi.spyOn(apiClient, "getAdminUnit").mockRejectedValue(new Error("boom"));
    renderAdmin(<UnitMasterEditor unitId="missing-unit" />);
    expect(await screen.findByText(thMessages.admin.properties.loadUnitError)).toBeInTheDocument();
  });

  it("shows an error with retry instead of a sample unit when the API fails", async () => {
    vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockRejectedValue(new Error("boom"));
    renderAdmin(<UnitMasterEditor unitId={unitRef.id} />);
    expect(await screen.findByText(thMessages.admin.properties.loadHierarchyError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: thMessages.common.retry })).toBeInTheDocument();
  });
});
