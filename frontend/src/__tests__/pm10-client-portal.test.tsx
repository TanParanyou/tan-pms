import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { ClientDashboardSection } from "@/features/client/components/ClientDashboardSection";
import { ClientLeasesSection } from "@/features/client/components/ClientLeasesSection";
import { ClientLeaseDetail } from "@/features/client/components/ClientLeaseDetail";
import { ClientInvoicesSection } from "@/features/client/components/ClientInvoicesSection";
import { ClientInvoiceDetail } from "@/features/client/components/ClientInvoiceDetail";
import { ClientUtilityUsageSection } from "@/features/client/components/ClientUtilityUsageSection";
import { ClientWorkOrderEditor } from "@/features/client/components/ClientWorkOrderEditor";
import { ClientWorkOrdersSection } from "@/features/client/components/ClientWorkOrdersSection";
import { ClientParcelsSection } from "@/features/client/components/ClientParcelsSection";
import { ClientReservationDetail } from "@/features/client/components/ClientReservationDetail";
import type { LeaseItemDto } from "@/features/leases/types";
import type { WorkOrderItemDto } from "@/features/work-orders/types";
import type {
  ClientInvoiceDto,
  ClientPaymentSlipDto,
  LeaseIntentDto,
  ClientDashboardResponse,
} from "@/features/client/types";
import type { ReservationItemDto } from "@/generated/api";
import { renderAdmin, unitRef, customerRef } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/client",
}));

const cp = thMessages.client.portal;
const tc = thMessages.common;
const rd = thMessages.common.reasonDialog;

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
  occupants: [{ id: "o1", fullName: "Mali Dee", nationalityCode: "THA", maskedIdentityNumber: "1-XXXX-9", isPrimaryOccupant: true }],
  vehicles: [{ id: "v1", licensePlate: "AB-1234", province: "Bangkok", vehicleBrandModel: "Honda" }],
  ...over,
});

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

const slip = (over: Partial<ClientPaymentSlipDto> = {}): ClientPaymentSlipDto => ({
  id: "s1",
  propertyId: "p1",
  invoiceId: "i1",
  invoiceDocumentNumber: "INV-0001",
  amount: 100,
  slipFileKey: "files/slip-1",
  status: "Pending",
  submittedAt: "2026-11-07T02:00:00Z",
  ...over,
});

const invoiceDto = (over: Partial<ClientInvoiceDto> = {}): ClientInvoiceDto => ({
  invoice: {
    id: "i1",
    documentNumber: "INV-0001",
    status: "Issued",
    billingPeriodYearMonth: "2026-11",
    customer: customerRef,
    unit: unitRef,
    lines: [{ id: "ln1", description: { th: "ค่าเช่า", en: "Rent" }, taxMode: "VatIncluded", lineAmount: 1000, subTotal: 934, vatAmount: 66, netAmount: 1000 }],
    subTotal: 934,
    totalVatAmount: 66,
    totalAmount: 1000,
  },
  paidAmount: 0,
  outstandingAmount: 1000,
  receipts: [],
  slips: [],
  ...over,
});

const workOrder = (status: string, over: Partial<WorkOrderItemDto> = {}): WorkOrderItemDto => ({
  id: "wo1",
  propertyId: "p1",
  documentNumber: "WKO-2611-0001",
  status,
  priority: "Normal",
  unit: unitRef,
  issueSummary: "Leaking tap",
  tenantChargeAmount: 0,
  createdAt: "2026-11-07T01:00:00Z",
  ...over,
});

const reservation = (status: string, over: Partial<ReservationItemDto> = {}): ReservationItemDto =>
  ({
    id: "r1",
    documentNumber: "RES-2611-0001",
    property: { id: "p1", code: "BKK01", name: { th: "สาขา", en: "Branch" } },
    customer: customerRef,
    unitType: { id: "ut1", code: "STD", name: { th: "สแตนดาร์ด", en: "Standard" }, areaSqm: 32 },
    stayMode: "Daily",
    slotStartAt: "2026-11-20T07:00:00Z",
    slotEndAt: "2026-11-22T05:00:00Z",
    effectiveBlockedEndAt: "2026-11-22T05:00:00Z",
    holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    depositAmount: 500,
    status,
    ...over,
  }) as ReservationItemDto;

const stored = { fileKey: "files/new-1", purpose: "x", contentType: "image/jpeg", size: 3, createdAt: "2026-11-07T01:00:00Z" };
const photoFile = () => new File(["img"], "photo.jpg", { type: "image/jpeg" });
const stageFile = () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [photoFile()] } });
};

beforeEach(() => {
  push.mockClear();
  vi.spyOn(apiClient, "getClientNotifications").mockResolvedValue({ items: [] });
  vi.spyOn(apiClient, "getClientLeases").mockResolvedValue({ items: [lease()] });
  vi.spyOn(apiClient, "getClientLeaseIntents").mockResolvedValue({ items: [] });
});
afterEach(() => vi.restoreAllMocks());

describe("PM-10 client dashboard", () => {
  const dashboard = (over: Partial<ClientDashboardResponse> = {}): ClientDashboardResponse => ({
    customer: customerRef,
    activeHoldReservation: {
      documentNumber: "RES-2611-0001",
      unitTypeName: { th: "สแตนดาร์ด", en: "Standard" },
      stayMode: "Daily",
      holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      depositAmount: 500,
    },
    activeLease: { documentNumber: "LSE-0001", unit: unitRef, monthlyRentAmount: 8500, securityDepositBalance: 17000 },
    unpaidInvoices: [{ id: "i1", documentNumber: "INV-0001", totalAmount: 1000, status: "Issued" }],
    pendingParcels: [{ id: "p1", documentNumber: "PCL-0001", carrierName: "Kerry", arrivedAt: "2026-11-07T01:00:00Z" }],
    ...over,
  });

  it("renders real data with exactly one inverted card and links to invoices", async () => {
    vi.spyOn(apiClient, "getClientDashboard").mockResolvedValue(dashboard());
    const { container } = renderAdmin(<ClientDashboardSection />);
    expect(await screen.findByText("INV-0001")).toBeInTheDocument();
    expect(screen.getByText("PCL-0001")).toBeInTheDocument();
    expect(container.querySelectorAll(".inverted-card")).toHaveLength(1);
    expect(screen.getByText("INV-0001").closest("a")).toHaveAttribute("href", "/client/invoices/i1");
  });

  it("shows no inverted card without an active hold and shows error with retry", async () => {
    const spy = vi.spyOn(apiClient, "getClientDashboard").mockRejectedValueOnce(new Error("boom"));
    const { container } = renderAdmin(<ClientDashboardSection />);
    expect(await screen.findByText(cp.dashboard.loadError)).toBeInTheDocument();
    spy.mockResolvedValue(dashboard({ activeHoldReservation: null }));
    fireEvent.click(screen.getByRole("button", { name: tc.retry }));
    expect(await screen.findByText("INV-0001")).toBeInTheDocument();
    expect(container.querySelectorAll(".inverted-card")).toHaveLength(0);
  });
});

describe("PM-10 client lease and intents", () => {
  it("lists leases and my requests with reject reason and status badge", async () => {
    vi.spyOn(apiClient, "getClientLeaseIntents").mockResolvedValue({
      items: [intent({ status: "Rejected", rejectReason: "Policy conflict" })],
    });
    renderAdmin(<ClientLeasesSection />);
    expect((await screen.findAllByText("LSE-0001")).length).toBeGreaterThan(0);
    expect(await screen.findByTestId("intent-reject-reason")).toHaveTextContent("Policy conflict");
    expect(screen.getByText(cp.intent.status.Rejected)).toBeInTheDocument();
  });

  it("shows leases error with retry and keeps the table header", async () => {
    vi.mocked(apiClient.getClientLeases).mockRejectedValue(new Error("boom"));
    renderAdmin(<ClientLeasesSection />);
    expect(await screen.findByText(cp.lease.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: cp.lease.colDocument }).length).toBeGreaterThan(0);
  });

  it("shows masked occupant identity and the deposit balance on the detail page", async () => {
    vi.spyOn(apiClient, "getClientLease").mockResolvedValue(lease());
    renderAdmin(<ClientLeaseDetail leaseId="l1" />);
    expect(await screen.findByText("1-XXXX-9")).toBeInTheDocument();
    expect(screen.getByText("AB-1234")).toBeInTheDocument();
  });

  it("creates a renewal request with validation and invalidates portal caches", async () => {
    vi.spyOn(apiClient, "getClientLease").mockResolvedValue(lease());
    const create = vi.spyOn(apiClient, "createClientLeaseIntent").mockResolvedValue(intent());
    const { queryClient } = renderAdmin(<ClientLeaseDetail leaseId="l1" />);
    const renew = await screen.findByRole("button", { name: cp.intent.btnRequestRenew });
    await waitFor(() => expect(renew).toBeEnabled());
    fireEvent.click(renew);
    const dialog = await screen.findByRole("dialog", { name: cp.intent.createTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: cp.intent.btnSubmit }));
    expect(await within(dialog).findByText(cp.intent.errorDateRequired)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.change(document.getElementById("intent-date") as HTMLInputElement, { target: { value: "2027-06-30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: cp.intent.btnSubmit }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("l1", expect.objectContaining({ intentType: "Renew", desiredDate: "2027-06-30" }))
    );
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.clientPortal.all));
      expect(keys).toContain(JSON.stringify(queryKeys.clientDashboard.all));
    });
  });

  it("blocks new requests while one is Pending and for non-Active leases", async () => {
    vi.spyOn(apiClient, "getClientLease").mockResolvedValue(lease());
    vi.mocked(apiClient.getClientLeaseIntents).mockResolvedValue({ items: [intent()] });
    const first = renderAdmin(<ClientLeaseDetail leaseId="l1" />);
    expect(await screen.findByText(cp.intent.pendingExistsHint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: cp.intent.btnRequestRenew })).toBeDisabled();
    first.unmount();
    vi.mocked(apiClient.getClientLease).mockResolvedValue(lease({ status: "MoveOutNotice" }));
    vi.mocked(apiClient.getClientLeaseIntents).mockResolvedValue({ items: [] });
    renderAdmin(<ClientLeaseDetail leaseId="l1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: cp.intent.btnRequestMoveOut })).toBeDisabled());
  });

  it("edits a Pending request and withdraws it only after confirmation", async () => {
    vi.mocked(apiClient.getClientLeaseIntents).mockResolvedValue({ items: [intent(), intent({ id: "in2", status: "Approved" })] });
    const update = vi.spyOn(apiClient, "updateClientLeaseIntent").mockResolvedValue(intent());
    const withdraw = vi.spyOn(apiClient, "withdrawClientLeaseIntent").mockResolvedValue(intent({ status: "Withdrawn" }));
    renderAdmin(<ClientLeasesSection />);
    // Only the Pending row offers edit and withdraw
    expect(await screen.findAllByRole("button", { name: new RegExp(cp.intent.btnEdit) })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(cp.intent.btnEdit) }));
    const dialog = await screen.findByRole("dialog", { name: cp.intent.editTitle });
    fireEvent.change(document.getElementById("intent-date") as HTMLInputElement, { target: { value: "2027-07-31" } });
    fireEvent.click(within(dialog).getByRole("button", { name: tc.save }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("in1", expect.objectContaining({ desiredDate: "2027-07-31" })));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: cp.intent.editTitle })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: new RegExp(cp.intent.btnWithdraw) }));
    const confirm = await screen.findByRole("alertdialog");
    expect(withdraw).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: cp.intent.btnWithdraw }));
    await waitFor(() => expect(withdraw).toHaveBeenCalledWith("in1"));
  });
});

describe("PM-10 client invoices and slips", () => {
  it("filters invoices by status through the API and shows empty and error states", async () => {
    const spy = vi.spyOn(apiClient, "getClientInvoices").mockResolvedValue({ items: [invoiceDto()] });
    renderAdmin(<ClientInvoicesSection />);
    expect(await screen.findByText("INV-0001")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(cp.invoices.colStatus), { target: { value: "Overdue" } });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ status: "Overdue" }));
    spy.mockResolvedValue({ items: [] });
    fireEvent.change(screen.getByLabelText(cp.invoices.colStatus), { target: { value: "Paid" } });
    expect(await screen.findByText(cp.invoices.emptyTitle)).toBeInTheDocument();
    spy.mockRejectedValue(new Error("boom"));
    fireEvent.change(screen.getByLabelText(cp.invoices.colStatus), { target: { value: "" } });
    expect(await screen.findByText(cp.invoices.loadError)).toBeInTheDocument();
  });

  it("loads all my slips on the slips tab", async () => {
    vi.spyOn(apiClient, "getClientInvoices").mockResolvedValue({ items: [] });
    const spy = vi.spyOn(apiClient, "getClientAllPaymentSlips").mockResolvedValue({
      items: [slip({ status: "Rejected", rejectReason: "Blurry image" })],
    });
    renderAdmin(<ClientInvoicesSection />);
    fireEvent.mouseDown(await screen.findByRole("tab", { name: cp.invoices.tabSlips }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: cp.invoices.tabSlips }));
    expect(await screen.findByText("Blurry image")).toBeInTheDocument();
    expect(spy).toHaveBeenCalled();
  });

  it("shows totals, receipts and downloads the receipt PDF", async () => {
    vi.spyOn(apiClient, "getClientInvoice").mockResolvedValue(
      invoiceDto({
        paidAmount: 400,
        outstandingAmount: 600,
        receipts: [
          { id: "r1", documentNumber: "RCT-0001", invoiceId: "i1", invoiceDocumentNumber: "INV-0001", customer: customerRef, invoiceTotalAmount: 1000, withholdingTaxAmount: 0, netPayableAmount: 400, isCashPayment: false, issuedAt: "2026-11-07T01:00:00Z" },
        ],
      })
    );
    const dl = vi.spyOn(apiClient, "downloadClientReceiptPdf").mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    vi.spyOn(window, "open").mockReturnValue(null);
    renderAdmin(<ClientInvoiceDetail invoiceId="i1" />);
    expect(await screen.findByText("RCT-0001")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-outstanding")).toHaveTextContent("600");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(cp.invoices.btnDownloadReceipt.replace(/[()]/g, "\\$&")) }));
    await waitFor(() => expect(dl).toHaveBeenCalledWith("r1"));
  });

  it("rejects an amount above the outstanding balance and uploads only on submit (once on double click)", async () => {
    vi.spyOn(apiClient, "getClientInvoice").mockResolvedValue(invoiceDto());
    let resolveUpload: (v: typeof stored) => void = () => undefined;
    const upload = vi.spyOn(apiClient, "uploadClientFile").mockImplementation(
      () => new Promise((r) => { resolveUpload = r; })
    );
    const submit = vi.spyOn(apiClient, "submitClientPaymentSlip").mockResolvedValue(slip());
    renderAdmin(<ClientInvoiceDetail invoiceId="i1" />);
    fireEvent.click(await screen.findByRole("button", { name: cp.slip.btnSubmitSlip }));
    const dialog = await screen.findByRole("dialog", { name: cp.slip.submitTitle });
    const amount = document.getElementById("slip-amount") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "5000" } });
    fireEvent.blur(amount);
    stageFile();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: cp.slip.btnSubmit }));
    expect(await within(dialog).findByText(cp.slip.errorAmount)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();

    fireEvent.change(amount, { target: { value: "600" } });
    fireEvent.blur(amount);
    const btn = within(dialog).getByRole("button", { name: cp.slip.btnSubmit });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    resolveUpload(stored);
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith("i1", expect.objectContaining({ amount: 600, slipFileKey: "files/new-1" }))
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("requires a slip image and keeps the form when the upload fails", async () => {
    vi.spyOn(apiClient, "getClientInvoice").mockResolvedValue(invoiceDto());
    const upload = vi.spyOn(apiClient, "uploadClientFile").mockRejectedValue(new Error("upload failed"));
    const submit = vi.spyOn(apiClient, "submitClientPaymentSlip");
    renderAdmin(<ClientInvoiceDetail invoiceId="i1" />);
    fireEvent.click(await screen.findByRole("button", { name: cp.slip.btnSubmitSlip }));
    const dialog = await screen.findByRole("dialog", { name: cp.slip.submitTitle });
    const amount = document.getElementById("slip-amount") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "300" } });
    fireEvent.blur(amount);
    fireEvent.click(within(dialog).getByRole("button", { name: cp.slip.btnSubmit }));
    expect(await within(dialog).findByText(cp.slip.errorSlipRequired)).toBeInTheDocument();
    stageFile();
    fireEvent.click(within(dialog).getByRole("button", { name: cp.slip.btnSubmit }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(submit).not.toHaveBeenCalled();
    expect((document.getElementById("slip-amount") as HTMLInputElement).value).toBe("300.00");
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it("disables slip submission when a slip is pending and for non-payable invoices", async () => {
    vi.spyOn(apiClient, "getClientInvoice").mockResolvedValue(invoiceDto({ slips: [slip()] }));
    const first = renderAdmin(<ClientInvoiceDetail invoiceId="i1" />);
    expect(await screen.findByText(cp.slip.pendingExistsHint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: cp.slip.btnSubmitSlip })).toBeDisabled();
    first.unmount();
    vi.mocked(apiClient.getClientInvoice).mockResolvedValue(invoiceDto({ outstandingAmount: 0, paidAmount: 1000 }));
    renderAdmin(<ClientInvoiceDetail invoiceId="i1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: cp.slip.btnSubmitSlip })).toBeDisabled());
  });

  it("withdraws a Pending slip only after confirmation and shows the reject reason of others", async () => {
    vi.spyOn(apiClient, "getClientInvoice").mockResolvedValue(
      invoiceDto({ slips: [slip(), slip({ id: "s2", status: "Rejected", rejectReason: "Wrong amount" })] })
    );
    const withdraw = vi.spyOn(apiClient, "withdrawClientPaymentSlip").mockResolvedValue(slip({ status: "Withdrawn" }));
    renderAdmin(<ClientInvoiceDetail invoiceId="i1" />);
    expect(await screen.findByTestId("slip-reject-reason")).toHaveTextContent("Wrong amount");
    expect(screen.getAllByRole("button", { name: new RegExp(cp.slip.btnWithdraw) })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(cp.slip.btnWithdraw) }));
    const confirm = await screen.findByRole("alertdialog");
    expect(withdraw).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: cp.slip.btnWithdraw }));
    await waitFor(() => expect(withdraw).toHaveBeenCalledWith("i1", "s1"));
  });
});

describe("PM-10 client utility usage", () => {
  const usage = {
    leaseId: "l1",
    leaseDocumentNumber: "LSE-0001",
    months: [
      { period: "2026-10", waterUsageUnits: 10, waterChargeAmount: 180, electricUsageUnits: 100, electricChargeAmount: 700 },
      { period: "2026-11", waterUsageUnits: null, waterChargeAmount: null, electricUsageUnits: 120, electricChargeAmount: 840 },
    ],
  };

  it("renders bars plus the accessible data table with dashes for missing data", async () => {
    const spy = vi.spyOn(apiClient, "getClientUtilityUsage").mockResolvedValue(usage);
    renderAdmin(<ClientUtilityUsageSection />);
    expect((await screen.findAllByText("2026-11")).length).toBe(3);
    expect(screen.getByTestId("usage-bars-m3")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThanOrEqual(5);
    fireEvent.change(screen.getByLabelText(cp.usage.fieldMonths), { target: { value: "6" } });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ leaseId: undefined, months: 6 }));
  });

  it("shows empty and error states", async () => {
    const spy = vi.spyOn(apiClient, "getClientUtilityUsage").mockResolvedValue({ ...usage, months: [] });
    const first = renderAdmin(<ClientUtilityUsageSection />);
    expect(await screen.findByText(cp.usage.emptyTitle)).toBeInTheDocument();
    first.unmount();
    spy.mockRejectedValue(new Error("boom"));
    renderAdmin(<ClientUtilityUsageSection />);
    expect(await screen.findByText(cp.usage.loadError)).toBeInTheDocument();
  });
});

describe("PM-10 client work orders and parcels", () => {
  it("lists work orders with status filter and a table-preserved error", async () => {
    const spy = vi.spyOn(apiClient, "getClientWorkOrders").mockResolvedValue({ items: [workOrder("Open")] });
    renderAdmin(<ClientWorkOrdersSection />);
    expect(await screen.findByText("Leaking tap")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(cp.workOrders.colStatus), { target: { value: "Completed" } });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ status: "Completed" }));
    spy.mockRejectedValue(new Error("boom"));
    fireEvent.change(screen.getByLabelText(cp.workOrders.colStatus), { target: { value: "" } });
    expect(await screen.findByText(cp.workOrders.loadError)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: cp.workOrders.colSummary }).length).toBeGreaterThan(0);
  });

  it("creates a work order with the photo uploaded only on submit", async () => {
    const upload = vi.spyOn(apiClient, "uploadClientFile").mockResolvedValue(stored);
    const create = vi.spyOn(apiClient, "createClientWorkOrder").mockResolvedValue(workOrder("Open"));
    renderAdmin(<ClientWorkOrderEditor workOrderId="create" />);
    await waitFor(() => expect(screen.getByRole("option", { name: new RegExp(unitRef.unitNumber) })).toBeInTheDocument());
    fireEvent.change(document.getElementById("cwo-unit") as HTMLSelectElement, { target: { value: unitRef.id } });
    fireEvent.change(screen.getByPlaceholderText(cp.workOrders.placeholderSummary), { target: { value: "Leaking tap" } });
    stageFile();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: cp.workOrders.btnSubmit }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith("WorkOrderPhoto", expect.any(File)));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ unitId: unitRef.id, beforePhotoFileKey: "files/new-1" }))
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/client/work-orders/wo1"));
  });

  it("validates required fields before any upload", async () => {
    const upload = vi.spyOn(apiClient, "uploadClientFile").mockResolvedValue(stored);
    renderAdmin(<ClientWorkOrderEditor workOrderId="create" />);
    stageFile();
    fireEvent.click(await screen.findByRole("button", { name: cp.workOrders.btnSubmit }));
    expect(await screen.findByText(cp.workOrders.errorUnitRequired)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("allows edit and cancel while Open, and locks both once InProgress", async () => {
    vi.spyOn(apiClient, "getClientWorkOrder").mockResolvedValue(workOrder("Open"));
    const cancel = vi.spyOn(apiClient, "cancelClientWorkOrder").mockResolvedValue(workOrder("Cancelled"));
    const first = renderAdmin(<ClientWorkOrderEditor workOrderId="wo1" />);
    fireEvent.click(await screen.findByRole("button", { name: cp.workOrders.btnCancel }));
    const dialog = await screen.findByRole("dialog", { name: cp.workOrders.cancelTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: cp.workOrders.btnCancel }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Fixed myself" } });
    fireEvent.click(within(dialog).getByRole("button", { name: cp.workOrders.btnCancel }));
    const confirm = await screen.findByRole("alertdialog");
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: cp.workOrders.btnCancel }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith("wo1", "Fixed myself"));
    first.unmount();

    vi.mocked(apiClient.getClientWorkOrder).mockResolvedValue(workOrder("InProgress"));
    renderAdmin(<ClientWorkOrderEditor workOrderId="wo1" />);
    expect(await screen.findByText(cp.workOrders.editOnlyWhenOpen)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: cp.workOrders.btnCancel })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(cp.workOrders.placeholderSummary)).toBeDisabled();
  });

  it("lists parcels with empty and error states", async () => {
    const spy = vi.spyOn(apiClient, "getClientParcels").mockResolvedValue({
      items: [
        { id: "pc1", propertyId: "p1", documentNumber: "PCL-0001", status: "Arrived", unit: unitRef, customer: customerRef, carrierName: "Kerry", arrivedAt: "2026-11-07T01:00:00Z" },
      ],
    });
    const first = renderAdmin(<ClientParcelsSection />);
    expect(await screen.findByText("PCL-0001")).toBeInTheDocument();
    first.unmount();
    spy.mockResolvedValue({ items: [] });
    const second = renderAdmin(<ClientParcelsSection />);
    expect(await screen.findByText(cp.parcels.emptyTitle)).toBeInTheDocument();
    second.unmount();
    spy.mockRejectedValue(new Error("boom"));
    renderAdmin(<ClientParcelsSection />);
    expect(await screen.findByText(cp.parcels.loadError)).toBeInTheDocument();
  });
});

describe("PM-10 client reservations", () => {
  it("shows the hold countdown and cancels a Hold only with reason and confirmation", async () => {
    vi.spyOn(apiClient, "getClientReservation").mockResolvedValue(reservation("Hold"));
    const cancel = vi.spyOn(apiClient, "cancelClientReservation").mockResolvedValue(reservation("Cancelled"));
    renderAdmin(<ClientReservationDetail reservationId="r1" />);
    expect(await screen.findByTestId("hold-countdown")).toHaveTextContent(/^\d{2}:\d{2}$/);
    fireEvent.click(screen.getByRole("button", { name: cp.reservations.btnCancel }));
    const dialog = await screen.findByRole("dialog", { name: cp.reservations.cancelTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Changed plans" } });
    fireEvent.click(within(dialog).getByRole("button", { name: cp.reservations.btnCancel }));
    const confirm = await screen.findByRole("alertdialog");
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: cp.reservations.btnCancel }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith("r1", "Changed plans"));
  });

  it("hides cancel and slip upload for a Confirmed reservation", async () => {
    vi.spyOn(apiClient, "getClientReservation").mockResolvedValue(reservation("Confirmed"));
    renderAdmin(<ClientReservationDetail reservationId="r1" />);
    expect(await screen.findByText("RES-2611-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: cp.reservations.btnCancel })).not.toBeInTheDocument();
    expect(screen.queryByText(cp.reservations.btnSubmitSlip)).not.toBeInTheDocument();
  });

  it("uploads the deposit slip only on submit and then sends the file key", async () => {
    vi.spyOn(apiClient, "getClientReservation").mockResolvedValue(reservation("Hold"));
    const upload = vi.spyOn(apiClient, "uploadClientFile").mockResolvedValue(stored);
    const slipCall = vi.spyOn(apiClient, "submitClientReservationSlip").mockResolvedValue(reservation("PendingVerification"));
    renderAdmin(<ClientReservationDetail reservationId="r1" />);
    await screen.findByTestId("hold-countdown");
    stageFile();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: cp.reservations.btnSubmitSlip }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith("PaymentSlip", expect.any(File)));
    await waitFor(() => expect(slipCall).toHaveBeenCalledWith("r1", { paymentSlipFileKey: "files/new-1" }));
  });

  it("shows an error state with retry for a missing reservation", async () => {
    vi.spyOn(apiClient, "getClientReservation").mockRejectedValue(new Error("boom"));
    renderAdmin(<ClientReservationDetail reservationId="r1" />);
    expect(await screen.findByText(cp.reservations.detailLoadError)).toBeInTheDocument();
  });
});
