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
import { BulkMeterReadingSection } from "@/features/meters/components/BulkMeterReadingSection";
import { BillingSection } from "@/features/billing/components/BillingSection";
import type {
  MeterReadingSheetResponse,
  SaveMeterReadingsResponse,
  InvoiceItemDto,
  BatchInvoiceRunResponse,
} from "@/features/billing/types";
import type { PropertyHierarchyResponse } from "@/generated/api";

const m = thMessages.admin.meters;
const b = thMessages.admin.billing;

const unitRef = (id: string, no: string) => ({
  id,
  unitNumber: no,
  buildingName: { th: "อาคาร A", en: "Building A" },
  floorNumber: 1,
  unitTypeName: { th: "สตูดิโอ", en: "Studio" },
});
const customer = { id: "c1", fullName: "Somchai Jaidee", maskedNationalId: "1-XXXX" };
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
    {
      unit: unitRef("u-a", "A-101"),
      leaseId: "l1",
      leaseDocumentNumber: "LSE-1",
      customer,
      occupantCount: 1,
      isLocked: false,
      water: reading(100, null),
      electric: reading(500, null),
    },
    {
      unit: unitRef("u-b", "B-202"),
      leaseId: "l2",
      leaseDocumentNumber: "LSE-2",
      customer,
      occupantCount: 1,
      isLocked: true,
      water: reading(200, 210),
      electric: reading(900, 950),
    },
  ],
};

const invoice = (id: string, status: string, no: string): InvoiceItemDto => ({
  id,
  documentNumber: no,
  status,
  billingPeriodYearMonth: "2026-11",
  customer,
  unit: unitRef("u-a", "A-101"),
  leaseDocumentNumber: "LSE-1",
  lines: [],
  subTotal: 100,
  totalVatAmount: 7,
  totalAmount: 107,
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

const waterInput = (unit: string) =>
  screen.getByLabelText(`${m.waterLabel} ${m.current} ${unit}`) as HTMLInputElement;
const electricInput = (unit: string) =>
  screen.getByLabelText(`${m.electricLabel} ${m.current} ${unit}`) as HTMLInputElement;

beforeEach(() => {
  vi.spyOn(apiClient, "getAdminMeterReadingSheet").mockResolvedValue(sheet);
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue({
    buildings: [],
    unitTypes: [],
    units: [],
  } as unknown as PropertyHierarchyResponse);
  vi.spyOn(apiClient, "getAdminInvoices").mockResolvedValue({
    items: [invoice("i1", "Draft", "INV-1"), invoice("i2", "Issued", "INV-2")],
  });
});
afterEach(() => vi.restoreAllMocks());

describe("PM-07: Bulk meter readings", () => {
  it("renders the sheet with previous readings", async () => {
    renderWith(<BulkMeterReadingSection />);
    expect(await screen.findByText("A-101")).toBeInTheDocument();
    expect(screen.getByText("100.00")).toBeInTheDocument();
    expect(screen.getByText("500.00")).toBeInTheDocument();
  });

  it("shows the rollover checkbox only when current is below previous", async () => {
    renderWith(<BulkMeterReadingSection />);
    await screen.findByText("A-101");
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    fireEvent.change(waterInput("A-101"), { target: { value: "150" } });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    fireEvent.change(waterInput("A-101"), { target: { value: "20" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("keeps edits and shows per-row error by code when isSaved is false", async () => {
    const res: SaveMeterReadingsResponse = {
      period: "2026-11",
      isSaved: false,
      rows: [
        {
          unitId: "u-a",
          isLockedOverride: false,
          errors: [{ code: "meter.rollover_unconfirmed", utilityType: "Water" }],
          warnings: [{ code: "meter.usage_anomaly", utilityType: "Electric" }],
        },
      ],
    };
    const save = vi.spyOn(apiClient, "saveAdminMeterReadings").mockResolvedValue(res);
    renderWith(<BulkMeterReadingSection />);
    await screen.findByText("A-101");
    fireEvent.change(waterInput("A-101"), { target: { value: "20" } });
    fireEvent.change(electricInput("A-101"), { target: { value: "600" } });
    fireEvent.click(screen.getByText(m.saveBatch));
    expect(await screen.findByText(m.issues.rolloverUnconfirmed)).toBeInTheDocument();
    expect(screen.getByText(m.issues.usageAnomaly)).toBeInTheDocument();
    expect(screen.getByText(m.saveFailedTitle)).toBeInTheDocument();
    expect(screen.queryByText(m.rowSaved)).not.toBeInTheDocument();
    expect(waterInput("A-101").value).toBe("20");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("uploads staged meter photos only on save and sends the returned keys", async () => {
    const upload = vi.spyOn(apiClient, "uploadAdminFile").mockResolvedValue({
      fileKey: "files/meter-1",
      purpose: "MeterPhoto",
      contentType: "image/jpeg",
      size: 3,
      createdAt: "2026-11-07T01:00:00Z",
    });
    const save = vi.spyOn(apiClient, "saveAdminMeterReadings").mockResolvedValue({ period: "2026-11", isSaved: true, rows: [] });
    renderWith(<BulkMeterReadingSection />);
    await screen.findByText("A-101");
    fireEvent.change(waterInput("A-101"), { target: { value: "120" } });
    fireEvent.change(electricInput("A-101"), { target: { value: "600" } });
    const input = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "water.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByText("water.jpg")).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(m.saveBatch));
    await waitFor(() => expect(upload).toHaveBeenCalledWith(expect.any(String), "MeterPhoto", expect.any(File)));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          items: [expect.objectContaining({ unitId: "u-a", waterPhotoFileKey: "files/meter-1", electricPhotoFileKey: undefined })],
        })
      )
    );
    await waitFor(() => expect(screen.queryByText("water.jpg")).not.toBeInTheDocument());
  });

  it("keeps edits and skips the save when a meter photo upload fails", async () => {
    const upload = vi.spyOn(apiClient, "uploadAdminFile").mockRejectedValue(new Error("upload failed"));
    const save = vi.spyOn(apiClient, "saveAdminMeterReadings");
    renderWith(<BulkMeterReadingSection />);
    await screen.findByText("A-101");
    fireEvent.change(waterInput("A-101"), { target: { value: "120" } });
    fireEvent.change(electricInput("A-101"), { target: { value: "600" } });
    const input = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "water.jpg", { type: "image/jpeg" })] } });
    fireEvent.click(screen.getByText(m.saveBatch));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(save).not.toHaveBeenCalled();
    expect(waterInput("A-101").value).toBe("120");
    expect(screen.getByText("water.jpg")).toBeInTheDocument();
  });

  it("makes locked rows read-only without override permission", async () => {
    renderWith(<BulkMeterReadingSection />, ["admin.meters.record"]);
    await screen.findByText("B-202");
    expect(waterInput("B-202")).toBeDisabled();
    expect(waterInput("A-101")).not.toBeDisabled();
  });

  it("allows editing locked rows with override permission and requires a reason", async () => {
    const save = vi.spyOn(apiClient, "saveAdminMeterReadings");
    renderWith(<BulkMeterReadingSection />, ["admin.meters.record", "admin.meters.override_locked"]);
    await screen.findByText("B-202");
    expect(waterInput("B-202")).not.toBeDisabled();
    fireEvent.change(waterInput("B-202"), { target: { value: "220" } });
    fireEvent.click(screen.getByText(m.saveBatch));
    expect(await screen.findByText(m.errorOverrideReasonRequired)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("hides the sheet without record permission", async () => {
    renderWith(<BulkMeterReadingSection />, []);
    expect(await screen.findByText(m.noPermission)).toBeInTheDocument();
    expect(apiClient.getAdminMeterReadingSheet).not.toHaveBeenCalled();
  });

  it("guards double submit while save is pending", async () => {
    let resolve: (v: SaveMeterReadingsResponse) => void = () => undefined;
    const save = vi.spyOn(apiClient, "saveAdminMeterReadings").mockImplementation(
      () => new Promise<SaveMeterReadingsResponse>((r) => { resolve = r; })
    );
    renderWith(<BulkMeterReadingSection />);
    await screen.findByText("A-101");
    fireEvent.change(waterInput("A-101"), { target: { value: "150" } });
    fireEvent.change(electricInput("A-101"), { target: { value: "600" } });
    const btn = screen.getByText(m.saveBatch).closest("button")!;
    fireEvent.click(btn);
    await waitFor(() => expect(waterInput("A-101")).toBeDisabled());
    fireEvent.click(btn);
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ period: "2026-11", isSaved: false, rows: [] }); });
  });

  it("invalidates operational caches after a persisted save", async () => {
    vi.spyOn(apiClient, "saveAdminMeterReadings").mockResolvedValue({ period: "2026-11", isSaved: true, rows: [] });
    const { queryClient } = renderWith(<BulkMeterReadingSection />);
    await screen.findByText("A-101");
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.change(waterInput("A-101"), { target: { value: "150" } });
    fireEvent.change(electricInput("A-101"), { target: { value: "600" } });
    fireEvent.click(screen.getByText(m.saveBatch));
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      for (const k of [queryKeys.meters.all, queryKeys.billing.all, queryKeys.properties.all, queryKeys.rack.all, queryKeys.availability.all, queryKeys.stays.all, queryKeys.leases.all]) {
        expect(keys).toContain(JSON.stringify(k));
      }
    });
  });
});

describe("PM-07: Batch billing", () => {
  it("shows created and skipped invoices after a batch run", async () => {
    const res: BatchInvoiceRunResponse = {
      period: "2026-11",
      created: [invoice("i3", "Draft", "INV-NEW")],
      refreshed: [invoice("i4", "Draft", "INV-REFRESHED")],
      skipped: [
        { leaseId: "l9", leaseDocumentNumber: "LSE-9", unit: unitRef("u-z", "Z-1"), reasonCode: "billing.missing_meter_readings" },
      ],
    };
    vi.spyOn(apiClient, "runAdminBatchInvoices").mockResolvedValue(res);
    renderWith(<BillingSection />);
    await screen.findByText("INV-1");
    fireEvent.click(screen.getByText(b.btnRunBatch));
    const panel = await screen.findByTestId("batch-run-result");
    expect(within(panel).getByText("INV-NEW")).toBeInTheDocument();
    expect(within(panel).getByText(b.skipReasons.missingMeterReadings)).toBeInTheDocument();
  });

  it("offers delete only for Draft and requires confirmation", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminInvoice").mockResolvedValue(invoice("i1", "Draft", "INV-1"));
    renderWith(<BillingSection />);
    await screen.findByText("INV-2");
    const deleteButtons = screen.getAllByLabelText(new RegExp(b.btnDelete));
    expect(deleteButtons).toHaveLength(1);
    fireEvent.click(deleteButtons[0]);
    expect(del).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByText(b.btnDelete));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "i1"));
  });

  it("requires confirmation to issue all drafts", async () => {
    const issue = vi.spyOn(apiClient, "issueAdminInvoicesForPeriod").mockResolvedValue({ issued: [] });
    renderWith(<BillingSection />);
    await screen.findByText("INV-1");
    fireEvent.click(screen.getByText(b.btnIssueAll));
    expect(issue).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByText(b.btnIssueAll));
    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
  });

  it("hides billing actions without permission", async () => {
    renderWith(<BillingSection />, ["admin.meters.record"]);
    expect(await screen.findByText(b.noPermission)).toBeInTheDocument();
    expect(screen.queryByText(b.btnRunBatch)).not.toBeInTheDocument();
  });

  it("guards double run and invalidates operational caches", async () => {
    let resolve: (v: BatchInvoiceRunResponse) => void = () => undefined;
    const run = vi.spyOn(apiClient, "runAdminBatchInvoices").mockImplementation(
      () => new Promise<BatchInvoiceRunResponse>((r) => { resolve = r; })
    );
    const { queryClient } = renderWith(<BillingSection />);
    await screen.findByText("INV-1");
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    const btn = screen.getByText(b.btnRunBatch).closest("button")!;
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    fireEvent.click(btn);
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ period: "2026-11", created: [], skipped: [], refreshed: [] }); });
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.billing.all));
      expect(keys).toContain(JSON.stringify(queryKeys.rack.all));
    });
  });
});
