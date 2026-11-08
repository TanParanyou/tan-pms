import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { ParcelEditor } from "@/features/parcels/components/ParcelEditor";
import { WorkOrderEditor } from "@/features/work-orders/components/WorkOrderEditor";
import { HousekeepingSection } from "@/features/housekeeping/components/HousekeepingSection";
import { LeaseDetailEditor } from "@/features/leases/components/LeaseDetailEditor";
import { InvoiceDetailSheet } from "@/features/billing/components/InvoiceDetailSheet";
import { CashierShiftSection } from "@/features/cashier/components/CashierShiftSection";
import { ShiftNotOpenAlert, isShiftNotOpenError } from "@/components/shared/shift-not-open-alert";
import type { ParcelItemDto } from "@/features/parcels/types";
import type { WorkOrderItemDto } from "@/features/work-orders/types";
import type { HousekeepingTaskDto } from "@/features/housekeeping/types";
import type { LeaseItemDto } from "@/features/leases/types";
import type { InvoiceItemDto } from "@/features/billing/types";
import type { CashierShiftDto } from "@/features/cashier/types";
import { renderAdmin, unitRef, customerRef, hierarchy } from "./test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin",
}));

const tc = thMessages.common;
const p = thMessages.admin.parcels;
const l = thMessages.admin.leases;
const b = thMessages.admin.billing;
const c = thMessages.admin.cashier;

const parcel = (over: Partial<ParcelItemDto> = {}): ParcelItemDto => ({
  id: "pc1",
  propertyId: "p1",
  documentNumber: "PCL-2611-0001",
  status: "Arrived",
  unit: unitRef,
  customer: customerRef,
  carrierName: "Kerry",
  arrivedAt: "2026-11-07T01:00:00Z",
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

const invoice = (over: Partial<InvoiceItemDto> = {}): InvoiceItemDto => ({
  id: "i1",
  documentNumber: "INV-0001",
  status: "Issued",
  billingPeriodYearMonth: "2026-11",
  customer: customerRef,
  unit: unitRef,
  leaseDocumentNumber: "LSE-0001",
  lines: [],
  subTotal: 93,
  totalVatAmount: 7,
  totalAmount: 100,
  ...over,
});

const shift = (over: Partial<CashierShiftDto> = {}): CashierShiftDto => ({
  id: "s1",
  documentNumber: "SHF-0001",
  cashierUserId: "u1",
  cashier: { id: "u1", fullName: "Cashier Somsri" },
  status: "Cancelled",
  openingFloatCash: 1000,
  cashReceiptsInShift: 0,
  cashDepositsReceivedInShift: 0,
  cashDepositsRefundedInShift: 0,
  openedAt: "2026-11-07T01:00:00Z",
  ...over,
});

const pdf = () => new Blob(["%PDF"], { type: "application/pdf" });
const photo = () => new File(["img"], "parcel.jpg", { type: "image/jpeg" });

function stagePhoto() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [photo()] } });
}

beforeEach(() => {
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
  vi.spyOn(apiClient, "getAdminUsers").mockResolvedValue({ items: [] });
  vi.spyOn(apiClient, "getAdminParcel").mockImplementation(async () => parcel());
});
afterEach(() => vi.restoreAllMocks());

describe("Deferred photo upload", () => {
  it("uploads only on submit, then sends the returned photoFileKey", async () => {
    const upload = vi.spyOn(apiClient, "uploadAdminFile").mockResolvedValue({
      fileKey: "files/parcel-1",
      purpose: "ParcelPhoto",
      contentType: "image/jpeg",
      size: 3,
      createdAt: "2026-11-07T01:00:00Z",
    });
    const update = vi.spyOn(apiClient, "updateAdminParcel").mockResolvedValue(parcel());
    renderAdmin(<ParcelEditor parcelId="pc1" />);
    await screen.findByDisplayValue("Kerry");
    stagePhoto();
    expect(await screen.findByText("parcel.jpg")).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upload).toHaveBeenCalledWith(expect.any(String), "ParcelPhoto", expect.any(File)));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(expect.any(String), "pc1", expect.objectContaining({ photoFileKey: "files/parcel-1" }))
    );
  });

  it("keeps form values and skips the save when the upload fails", async () => {
    const upload = vi.spyOn(apiClient, "uploadAdminFile").mockRejectedValue(new ApiError({ status: 500, errorCode: "generic", message: "boom" }));
    const update = vi.spyOn(apiClient, "updateAdminParcel").mockResolvedValue(parcel());
    renderAdmin(<ParcelEditor parcelId="pc1" />);
    const carrier = (await screen.findByDisplayValue("Kerry")) as HTMLInputElement;
    fireEvent.change(carrier, { target: { value: "Flash Express" } });
    stagePhoto();
    fireEvent.click(screen.getByRole("button", { name: tc.save }));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText(p.placeholderCarrier) as HTMLInputElement).value).toBe("Flash Express");
    expect(screen.getByText("parcel.jpg")).toBeInTheDocument();
  });

  it("shows the stored after-photo of a completed work order via the authorized download", async () => {
    const download = vi.spyOn(apiClient, "downloadAdminFile").mockResolvedValue(new Blob(["x"], { type: "image/png" }));
    const wo: WorkOrderItemDto = {
      id: "wo1",
      propertyId: "p1",
      documentNumber: "WKO-2611-0001",
      status: "Completed",
      priority: "Normal",
      unit: unitRef,
      issueSummary: "Leak",
      tenantChargeAmount: 0,
      createdAt: "2026-11-07T01:00:00Z",
      afterPhotoFileKey: "files/after-1",
      assignedTechnician: { id: "t1", fullName: "Tech Somchai" },
    };
    vi.spyOn(apiClient, "getAdminWorkOrder").mockResolvedValue(wo);
    renderAdmin(<WorkOrderEditor workOrderId="wo1" />);
    expect(await screen.findByText("Tech Somchai")).toBeInTheDocument();
    await waitFor(() => expect(download).toHaveBeenCalledWith("files/after-1"));
  });
});

describe("PDF downloads", () => {
  it("lease detail prints the contract PDF through the blob download", async () => {
    vi.spyOn(apiClient, "getAdminLease").mockResolvedValue(lease());
    const dl = vi.spyOn(apiClient, "downloadAdminContractPdf").mockResolvedValue(pdf());
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    fireEvent.click(await screen.findByRole("button", { name: l.btnPrintContract }));
    await waitFor(() => expect(dl).toHaveBeenCalledWith(expect.any(String), "l1"));
    await waitFor(() => expect(open).toHaveBeenCalled());
  });

  it("invoice detail lists receipts and downloads the receipt PDF", async () => {
    vi.spyOn(apiClient, "getAdminInvoice").mockResolvedValue(invoice());
    vi.spyOn(apiClient, "listAdminReceipts").mockResolvedValue({
      items: [
        {
          id: "r1",
          documentNumber: "RCT-2611-0001",
          invoiceId: "i1",
          invoiceDocumentNumber: "INV-0001",
          customer: customerRef,
          invoiceTotalAmount: 100,
          withholdingTaxAmount: 0,
          netPayableAmount: 100,
          isCashPayment: true,
          issuedAt: "2026-11-07T02:00:00Z",
        },
      ],
    });
    const dl = vi.spyOn(apiClient, "downloadAdminReceiptPdf").mockResolvedValue(pdf());
    vi.spyOn(window, "open").mockReturnValue(null);
    renderAdmin(<InvoiceDetailSheet propertyId="p1" invoiceId="i1" onClose={() => undefined} />);
    expect(await screen.findByText("RCT-2611-0001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(b.btnDownloadReceipt.replace(/[()]/g, "\\$&")) }));
    await waitFor(() => expect(dl).toHaveBeenCalledWith("p1", "r1"));
  });
});

describe("Display names and reasons", () => {
  it("renders the housekeeping assignee full name", async () => {
    const task: HousekeepingTaskDto = {
      id: "t1",
      unit: unitRef,
      sourceDocumentNumber: "WKO-t1",
      status: "Pending",
      unitConditionStatus: "Dirty",
      createdAt: "2026-11-07T01:00:00Z",
      assignedStaffUserId: "u9",
      assignedStaff: { id: "u9", fullName: "Maid Somying" },
    };
    vi.spyOn(apiClient, "getAdminHousekeepingTasks").mockResolvedValue({ items: [task] });
    renderAdmin(<HousekeepingSection />);
    expect(await screen.findByText("Maid Somying")).toBeInTheDocument();
    expect(screen.queryByText("u9")).not.toBeInTheDocument();
  });

  it("shows a dash instead of guessing when the assignee has no full name", async () => {
    const task: HousekeepingTaskDto = {
      id: "t2",
      unit: unitRef,
      sourceDocumentNumber: "WKO-t2",
      status: "Pending",
      unitConditionStatus: "Dirty",
      createdAt: "2026-11-07T01:00:00Z",
      assignedStaffUserId: "u9",
      assignedStaff: { id: "u9", fullName: null },
    };
    vi.spyOn(apiClient, "getAdminHousekeepingTasks").mockResolvedValue({ items: [task] });
    renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t2");
    expect(screen.queryByText("u9")).not.toBeInTheDocument();
  });

  it("shows lease and parcel reasons", async () => {
    vi.spyOn(apiClient, "getAdminLease").mockResolvedValue(lease({ status: "Cancelled", cancelReason: "Tenant left early" }));
    const { unmount } = renderAdmin(<LeaseDetailEditor leaseId="l1" />);
    expect(await screen.findByText("Tenant left early")).toBeInTheDocument();
    unmount();
    vi.mocked(apiClient.getAdminParcel).mockResolvedValue(parcel({ voidReason: "Wrong unit" }));
    renderAdmin(<ParcelEditor parcelId="pc1" />);
    expect(await screen.findByText("Wrong unit")).toBeInTheDocument();
  });

  it("shows invoice void reason and cashier shift cashier name plus cancel reason", async () => {
    vi.spyOn(apiClient, "getAdminInvoice").mockResolvedValue(invoice({ status: "Voided", voidReason: "Duplicate bill" }));
    vi.spyOn(apiClient, "listAdminReceipts").mockResolvedValue({ items: [] });
    const first = renderAdmin(<InvoiceDetailSheet propertyId="p1" invoiceId="i1" onClose={() => undefined} />);
    expect(await screen.findByText("Duplicate bill")).toBeInTheDocument();
    first.unmount();

    vi.spyOn(apiClient, "getAdminCurrentCashierShift").mockResolvedValue({ shift: null });
    vi.spyOn(apiClient, "getAdminCashierShifts").mockResolvedValue({ items: [shift()] });
    vi.spyOn(apiClient, "getAdminCashierShift").mockResolvedValue(shift({ cancelReason: "Opened by mistake" }));
    renderAdmin(<CashierShiftSection />);
    fireEvent.click(await screen.findByLabelText(`${c.btnViewShift} SHF-0001`));
    expect(await screen.findByText("Opened by mistake")).toBeInTheDocument();
    expect(screen.getAllByText("Cashier Somsri").length).toBeGreaterThan(0);
    expect(screen.getByTestId("shift-flow-hint")).toBeInTheDocument();
  });
});

describe("shift.not_open guidance", () => {
  it("recognizes the error code and links to the cashier page", () => {
    expect(isShiftNotOpenError(new ApiError({ status: 409, errorCode: "shift.not_open", message: "x" }))).toBe(true);
    expect(isShiftNotOpenError(new ApiError({ status: 409, errorCode: "generic", message: "x" }))).toBe(false);
    render(
      <NextIntlClientProvider locale="th" messages={thMessages}>
        <ShiftNotOpenAlert />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole("link", { name: tc.shiftNotOpen.link })).toHaveAttribute("href", "/admin/cashier");
  });
});
