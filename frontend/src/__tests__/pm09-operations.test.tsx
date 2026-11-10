import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { HousekeepingSection } from "@/features/housekeeping/components/HousekeepingSection";
import { WorkOrdersListSection } from "@/features/work-orders/components/WorkOrdersListSection";
import { WorkOrderEditor } from "@/features/work-orders/components/WorkOrderEditor";
import { ParcelsListSection } from "@/features/parcels/components/ParcelsListSection";
import { ParcelEditor } from "@/features/parcels/components/ParcelEditor";
import type { HousekeepingTaskDto } from "@/features/housekeeping/types";
import type { WorkOrderItemDto } from "@/features/work-orders/types";
import type { ParcelItemDto } from "@/features/parcels/types";
import { renderAdmin, unitRef, customerRef, hierarchy } from "./test-utils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin",
}));

const h = thMessages.admin.housekeeping;
const w = thMessages.admin.workOrders;
const p = thMessages.admin.parcels;
const rd = thMessages.common.reasonDialog;

const task = (id: string, status: string, over: Partial<HousekeepingTaskDto> = {}): HousekeepingTaskDto => ({
  id,
  unit: unitRef,
  sourceDocumentNumber: `WKO-${id}`,
  status,
  unitConditionStatus: "Dirty",
  createdAt: "2026-11-07T01:00:00Z",
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

const parcel = (status: string, over: Partial<ParcelItemDto> = {}): ParcelItemDto => ({
  id: "pc1",
  propertyId: "p1",
  documentNumber: "PCL-2611-0001",
  status,
  unit: unitRef,
  customer: customerRef,
  carrierName: "Kerry",
  arrivedAt: "2026-11-07T01:00:00Z",
  ...over,
});

beforeEach(() => {
  push.mockClear();
  vi.spyOn(apiClient, "getAdminPropertyHierarchy").mockResolvedValue(hierarchy);
  vi.spyOn(apiClient, "getAdminUsers").mockResolvedValue({ items: [] });
  vi.spyOn(apiClient, "getAdminHousekeepingTasks").mockResolvedValue({
    items: [task("t1", "Pending"), task("t2", "Cleaning"), task("t3", "Completed")],
  });
  vi.spyOn(apiClient, "getAdminWorkOrders").mockResolvedValue({ items: [workOrder("Open")] });
  vi.spyOn(apiClient, "getAdminWorkOrder").mockImplementation(async (_pid, id) => workOrder("Open", { id }));
  vi.spyOn(apiClient, "getAdminParcels").mockResolvedValue({ items: [parcel("Arrived")] });
  vi.spyOn(apiClient, "getAdminParcel").mockImplementation(async (_pid, id) => parcel("Arrived", { id }));
});
afterEach(() => vi.restoreAllMocks());

describe("PM-09: Housekeeping", () => {
  it("renders tasks and keeps the table header on error", async () => {
    renderAdmin(<HousekeepingSection />);
    expect(await screen.findByText("WKO-t1")).toBeInTheDocument();
    expect(screen.getByText("WKO-t3")).toBeInTheDocument();
  });

  it("shows the error state inside the table while preserving the header", async () => {
    vi.mocked(apiClient.getAdminHousekeepingTasks).mockRejectedValue(new Error("boom"));
    renderAdmin(<HousekeepingSection />);
    expect(await screen.findByText(h.loadError)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: h.colBuilding })).toBeInTheDocument();
  });

  it("filters by status and building via the API", async () => {
    renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t1");
    fireEvent.change(document.getElementById("hk-filter-status") as HTMLSelectElement, { target: { value: "Cleaning" } });
    await waitFor(() =>
      expect(apiClient.getAdminHousekeepingTasks).toHaveBeenCalledWith(expect.any(String), { status: "Cleaning", buildingId: undefined, page: 1, pageSize: 25 })
    );
  });

  it("starts a Pending task and awaits operational cache invalidation", async () => {
    const start = vi.spyOn(apiClient, "startAdminHousekeepingTask").mockResolvedValue(task("t1", "Cleaning"));
    const { queryClient } = renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t1");
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(screen.getByText(h.btnStart));
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.any(String), "t1"));
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(queryKeys.housekeeping.all));
      expect(keys).toContain(JSON.stringify(queryKeys.rack.all));
    });
  });

  it("guards double start clicks", async () => {
    let resolve: (v: HousekeepingTaskDto) => void = () => undefined;
    const start = vi.spyOn(apiClient, "startAdminHousekeepingTask").mockImplementation(
      () => new Promise<HousekeepingTaskDto>((r) => { resolve = r; })
    );
    renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t1");
    const btn = screen.getByText(h.btnStart).closest("button")!;
    fireEvent.click(btn);
    fireEvent.click(btn);
    await act(async () => { await Promise.resolve(); });
    expect(start).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(task("t1", "Cleaning")); });
  });

  it("offers delete only for Pending tasks and requires confirmation", async () => {
    const del = vi.spyOn(apiClient, "deleteAdminHousekeepingTask").mockResolvedValue(task("t1", "Pending"));
    renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t1");
    expect(screen.getAllByLabelText(new RegExp(h.btnDelete))).toHaveLength(1);
    fireEvent.click(screen.getByLabelText(new RegExp(h.btnDelete)));
    expect(del).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByText(h.btnDelete));
    await waitFor(() => expect(del).toHaveBeenCalledWith(expect.any(String), "t1"));
  });

  it("hides all actions without permission", async () => {
    renderAdmin(<HousekeepingSection />, []);
    await screen.findByText("WKO-t1");
    expect(screen.queryByText(h.btnStart)).not.toBeInTheDocument();
    expect(screen.queryByText(h.btnCreate)).not.toBeInTheDocument();
    expect(screen.getByText(h.noPermissionHint)).toBeInTheDocument();
  });

  it("completes a Cleaning task with skipInspection and keeps the dialog on error", async () => {
    const complete = vi.spyOn(apiClient, "completeAdminHousekeepingTask").mockRejectedValueOnce(new Error("nope"));
    renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t2");
    fireEvent.click(screen.getByText(h.btnComplete));
    const dialog = await screen.findByRole("dialog", { name: h.completeTitle });
    fireEvent.click(within(dialog).getByLabelText(h.fieldSkipInspection));
    fireEvent.click(within(dialog).getByText(h.btnComplete));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(expect.any(String), "t2", { skipInspection: true }));
    expect(screen.getByRole("dialog", { name: h.completeTitle })).toBeInTheDocument();
  });

  it("validates that a manual task needs a unit", async () => {
    const create = vi.spyOn(apiClient, "createAdminHousekeepingTask");
    renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t1");
    fireEvent.click(screen.getAllByText(h.btnCreate)[0]);
    const dialog = await screen.findByRole("dialog", { name: h.createTitle });
    fireEvent.click(within(dialog).getByText(h.btnCreate));
    expect(await within(dialog).findByText(h.errorUnitRequired)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("edits the note of an open task", async () => {
    const update = vi.spyOn(apiClient, "updateAdminHousekeepingTask").mockResolvedValue(task("t1", "Pending"));
    renderAdmin(<HousekeepingSection />);
    await screen.findByText("WKO-t1");
    fireEvent.click(screen.getAllByLabelText(new RegExp(h.btnEditNote))[0]);
    const dialog = await screen.findByRole("dialog", { name: h.editTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(h.placeholderNote), { target: { value: "Check AC" } });
    fireEvent.click(within(dialog).getByText(thMessages.common.save));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(expect.any(String), "t1", { note: "Check AC", assignedStaffUserId: undefined })
    );
  });
});

describe("PM-09: Work orders", () => {
  it("lists work orders and navigates to the detail route", async () => {
    renderAdmin(<WorkOrdersListSection />);
    fireEvent.click(await screen.findByText("WKO-2611-0001"));
    expect(push).toHaveBeenCalledWith("/admin/work-orders/wo1");
  });

  it("hides create without permission", async () => {
    renderAdmin(<WorkOrdersListSection />, []);
    await screen.findByText("WKO-2611-0001");
    expect(screen.queryByText(w.btnCreate)).not.toBeInTheDocument();
  });

  it("validates the create form (unit and summary are required)", async () => {
    const create = vi.spyOn(apiClient, "createAdminWorkOrder");
    renderAdmin(<WorkOrderEditor workOrderId="create" />);
    fireEvent.click(await screen.findByRole("button", { name: w.btnCreate }));
    expect(await screen.findByText(w.errorUnitRequired)).toBeInTheDocument();
    expect(screen.getByText(w.errorSummaryRequired)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("edits an Open work order", async () => {
    const update = vi.spyOn(apiClient, "updateAdminWorkOrder").mockResolvedValue(workOrder("Open"));
    renderAdmin(<WorkOrderEditor workOrderId="wo1" />);
    const input = await screen.findByPlaceholderText(w.placeholderSummary);
    fireEvent.change(input, { target: { value: "Leaking shower" } });
    fireEvent.click(screen.getByRole("button", { name: thMessages.common.save }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.any(String),
        "wo1",
        expect.objectContaining({ issueSummary: "Leaking shower", priority: "Normal" })
      )
    );
  });

  it("locks editing and offers resolve only when InProgress", async () => {
    vi.mocked(apiClient.getAdminWorkOrder).mockResolvedValue(workOrder("InProgress", { assignedTechnicianUserId: "tech1" }));
    renderAdmin(<WorkOrderEditor workOrderId="wo1" />);
    expect(await screen.findByText(w.btnResolve)).toBeInTheDocument();
    expect(screen.getByText(w.editOnlyWhenOpen)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(w.placeholderSummary)).toBeDisabled();
  });

  it("hides cancel for a Completed order with a posted charge", async () => {
    vi.mocked(apiClient.getAdminWorkOrder).mockResolvedValue(
      workOrder("Completed", { tenantChargeAmount: 500, chargeDocumentNumber: "INV-1", resolutionNotes: "Fixed" })
    );
    renderAdmin(<WorkOrderEditor workOrderId="wo1" />);
    await screen.findByText("INV-1");
    expect(screen.queryByText(w.btnCancel)).not.toBeInTheDocument();
  });

  it("requires a reason then a confirmation to cancel, and keeps the dialog on API error", async () => {
    const cancel = vi.spyOn(apiClient, "cancelAdminWorkOrder").mockRejectedValueOnce(new Error("nope"));
    renderAdmin(<WorkOrderEditor workOrderId="wo1" />);
    fireEvent.click(await screen.findByRole("button", { name: w.btnCancel }));
    const dialog = await screen.findByRole("dialog", { name: w.cancelTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: w.btnCancel }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Duplicate" } });
    fireEvent.click(within(dialog).getByRole("button", { name: w.btnCancel }));
    const confirm = await screen.findByRole("alertdialog");
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: w.btnCancel }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.any(String), "wo1", "Duplicate"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: w.cancelTitle })).toBeInTheDocument();
  });

  it("requires resolution notes to resolve", async () => {
    vi.mocked(apiClient.getAdminWorkOrder).mockResolvedValue(workOrder("InProgress"));
    const resolve = vi.spyOn(apiClient, "resolveAdminWorkOrder");
    renderAdmin(<WorkOrderEditor workOrderId="wo1" />);
    fireEvent.click(await screen.findByRole("button", { name: w.btnResolve }));
    const dialog = await screen.findByRole("dialog", { name: w.resolveTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: w.btnResolve }));
    expect(await within(dialog).findByText(w.errorNotesRequired)).toBeInTheDocument();
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("PM-09: Parcels", () => {
  it("lists parcels and navigates to detail", async () => {
    renderAdmin(<ParcelsListSection />);
    fireEvent.click(await screen.findByText("PCL-2611-0001"));
    expect(push).toHaveBeenCalledWith("/admin/parcels/pc1");
  });

  it("validates the create form (unit and carrier are required)", async () => {
    const receive = vi.spyOn(apiClient, "receiveAdminParcel");
    renderAdmin(<ParcelEditor parcelId="create" />);
    fireEvent.click(await screen.findByRole("button", { name: p.btnCreate }));
    expect(await screen.findByText(p.errorUnitRequired)).toBeInTheDocument();
    expect(screen.getByText(p.errorCarrierRequired)).toBeInTheDocument();
    expect(receive).not.toHaveBeenCalled();
  });

  it("edits an Arrived parcel", async () => {
    const update = vi.spyOn(apiClient, "updateAdminParcel").mockResolvedValue(parcel("Arrived"));
    renderAdmin(<ParcelEditor parcelId="pc1" />);
    const carrier = await screen.findByPlaceholderText(p.placeholderCarrier);
    fireEvent.change(carrier, { target: { value: "Flash" } });
    fireEvent.click(screen.getByRole("button", { name: thMessages.common.save }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(expect.any(String), "pc1", expect.objectContaining({ carrierName: "Flash" }))
    );
  });

  it("hands over a parcel with the recipient name", async () => {
    const pickup = vi.spyOn(apiClient, "pickUpAdminParcel").mockResolvedValue(parcel("PickedUp"));
    renderAdmin(<ParcelEditor parcelId="pc1" />);
    fireEvent.click(await screen.findByRole("button", { name: p.btnPickup }));
    const dialog = await screen.findByRole("dialog", { name: p.pickupTitle });
    fireEvent.change(within(dialog).getByPlaceholderText(p.placeholderRecipient), { target: { value: "Mali" } });
    fireEvent.click(within(dialog).getByRole("button", { name: p.btnPickup }));
    await waitFor(() => expect(pickup).toHaveBeenCalledWith(expect.any(String), "pc1", { recipientName: "Mali" }));
  });

  it("voids with a required reason and a confirmation, then returns to the list", async () => {
    const voidSpy = vi.spyOn(apiClient, "voidAdminParcel").mockResolvedValue(parcel("Arrived"));
    renderAdmin(<ParcelEditor parcelId="pc1" />);
    fireEvent.click(await screen.findByRole("button", { name: p.btnVoid }));
    const dialog = await screen.findByRole("dialog", { name: p.voidTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: p.btnVoid }));
    expect(await within(dialog).findByText(rd.errorRequired)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByPlaceholderText(rd.placeholder), { target: { value: "Wrong unit" } });
    fireEvent.click(within(dialog).getByRole("button", { name: p.btnVoid }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: p.btnVoid }));
    await waitFor(() => expect(voidSpy).toHaveBeenCalledWith(expect.any(String), "pc1", "Wrong unit"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/parcels"));
  });

  it("hides pickup and void for a PickedUp parcel", async () => {
    vi.mocked(apiClient.getAdminParcel).mockResolvedValue(parcel("PickedUp", { pickedUpAt: "2026-11-07T03:00:00Z", recipientName: "Mali" }));
    renderAdmin(<ParcelEditor parcelId="pc1" />);
    await screen.findByText(p.editOnlyWhenArrived);
    expect(screen.queryByRole("button", { name: p.btnPickup })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: p.btnVoid })).not.toBeInTheDocument();
  });
});
