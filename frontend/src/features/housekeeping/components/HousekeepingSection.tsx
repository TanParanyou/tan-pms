"use client";

import React, { useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { CheckCheck, Pencil, Play, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";
import {
  useAdminHousekeepingTasks,
  useStartHousekeepingTaskMutation,
  useDeleteHousekeepingTaskMutation,
} from "../api/use-housekeeping";
import {
  PERMISSION_HOUSEKEEPING_UPDATE,
  HOUSEKEEPING_STATUS_OPTIONS,
  HOUSEKEEPING_STATUS_BADGE_VARIANT,
} from "../constants";
import type { HousekeepingStatusType, HousekeepingTaskDto } from "../types";
import {
  CreateHousekeepingTaskDialog,
  AssignHousekeepingTaskDialog,
  EditHousekeepingNoteDialog,
  CompleteHousekeepingTaskDialog,
} from "./HousekeepingDialogs";

export function HousekeepingSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.housekeeping");
  const tCommon = useTranslations("common");
  const tCondition = useTranslations("conditionStatus");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canUpdate = hasPermission(PERMISSION_HOUSEKEEPING_UPDATE);

  const [status, setStatus] = useState<HousekeepingStatusType | "">("");
  const [buildingId, setBuildingId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [assignTarget, setAssignTarget] = useState<HousekeepingTaskDto | null>(null);
  const [noteTarget, setNoteTarget] = useState<HousekeepingTaskDto | null>(null);
  const [completeTarget, setCompleteTarget] = useState<HousekeepingTaskDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HousekeepingTaskDto | null>(null);

  const propertyId = activeProperty.id;
  const { data: hierarchy } = usePropertyHierarchy(propertyId);
  const { data, isLoading, isError, refetch } = useAdminHousekeepingTasks(
    propertyId,
    status || undefined,
    buildingId || undefined
  );
  const startMutation = useStartHousekeepingTaskMutation(propertyId);
  const deleteMutation = useDeleteHousekeepingTaskMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy = startMutation.isPending || deleteMutation.isPending;

  // Group by building then floor then unit so the single table reads as a board.
  const items = useMemo(() => {
    const rows = [...(data?.items ?? [])];
    return rows.sort((a, b) => {
      const building = resolveLocalizedText(a.unit.buildingName, locale).localeCompare(
        resolveLocalizedText(b.unit.buildingName, locale)
      );
      if (building !== 0) return building;
      if (a.unit.floorNumber !== b.unit.floorNumber) return a.unit.floorNumber - b.unit.floorNumber;
      return a.unit.unitNumber.localeCompare(b.unit.unitNumber);
    });
  }, [data, locale]);

  const buildingOptions = useMemo(
    () => (hierarchy?.buildings ?? []).map((b) => ({ id: b.id, label: resolveLocalizedText(b.name, locale) })),
    [hierarchy, locale]
  );

  const handleStart = async (task: HousekeepingTaskDto) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await startMutation.mutateAsync(task.id);
      toastSuccess(t("toastStarted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  };

  const handleDelete = async () => {
    if (isBusy || inFlight.current || !deleteTarget) return;
    inFlight.current = true;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toastSuccess(t("toastDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setDeleteTarget(null);
    }
  };

  const dash = <span className="text-mute">-</span>;

  const columns: ColumnDef<HousekeepingTaskDto>[] = [
    { id: "building", header: t("colBuilding"), cell: (r) => <span className="text-xs">{resolveLocalizedText(r.unit.buildingName, locale)}</span> },
    { id: "floor", header: t("colFloor"), cell: (r) => <span className="font-mono text-xs">{r.unit.floorNumber}</span> },
    { id: "unit", header: t("colUnit"), cell: (r) => <span className="text-xs font-medium text-ink">{r.unit.unitNumber}</span> },
    { id: "doc", header: t("colTask"), cell: (r) => <span className="font-mono text-xs">{r.sourceDocumentNumber}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (r) => (
        <Badge variant={HOUSEKEEPING_STATUS_BADGE_VARIANT[r.status as HousekeepingStatusType]}>
          {t(`status.${r.status}`)}
        </Badge>
      ),
    },
    { id: "condition", header: t("colCondition"), cell: (r) => <span className="text-xs">{tCondition(r.unitConditionStatus)}</span> },
    {
      id: "assignee",
      header: t("colAssignee"),
      cell: (r) => (r.assignedStaff?.fullName ? <span className="text-xs">{r.assignedStaff.fullName}</span> : dash),
    },
    { id: "note", header: t("colNote"), cell: (r) => <span className="text-xs">{r.note ? r.note : "-"}</span> },
    { id: "updated", header: t("colUpdated"), cell: (r) => <span className="text-xs">{formatDateTime(r.updatedAt ?? r.createdAt, locale)}</span> },
    {
      id: "actions",
      header: <span className="sr-only">{tCommon("actions")}</span>,
      align: "right",
      cell: (r) => {
        if (!canUpdate) return null;
        const open = r.status !== "Completed";
        return (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {r.status === "Pending" && (
              <Button type="button" size="sm" disabled={isBusy} onClick={() => void handleStart(r)} className="h-8 rounded-full px-3 gap-1.5 text-xs">
                <Play className="h-3.5 w-3.5" />
                <span>{t("btnStart")}</span>
              </Button>
            )}
            {(r.status === "Cleaning" || r.status === "Inspecting") && (
              <Button type="button" size="sm" disabled={isBusy} onClick={() => setCompleteTarget(r)} className="h-8 rounded-full px-3 gap-1.5 text-xs">
                <CheckCheck className="h-3.5 w-3.5" />
                <span>{t("btnComplete")}</span>
              </Button>
            )}
            {open && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title={t("btnAssign")}
                  aria-label={`${t("btnAssign")} ${r.unit.unitNumber}`}
                  disabled={isBusy}
                  onClick={() => setAssignTarget(r)}
                  className="h-8 w-8 rounded-full"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title={t("btnEditNote")}
                  aria-label={`${t("btnEditNote")} ${r.unit.unitNumber}`}
                  disabled={isBusy}
                  onClick={() => setNoteTarget(r)}
                  className="h-8 w-8 rounded-full"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {r.status === "Pending" && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                title={t("btnDelete")}
                aria-label={`${t("btnDelete")} ${r.unit.unitNumber}`}
                disabled={isBusy}
                onClick={() => setDeleteTarget(r)}
                className="h-8 w-8 rounded-full"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="WKO"
        title={t("title")}
        description={t("description")}
        actions={
          canUpdate ? (
            <Button type="button" size="sm" onClick={() => setShowCreate(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
              <Plus className="h-4 w-4" />
              <span>{t("btnCreate")}</span>
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none sm:grid-cols-2">
        <FormField id="hk-filter-status" label={t("colStatus")}>
          <SelectPill
            id="hk-filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as HousekeepingStatusType | "")}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allStatuses")}</option>
            {HOUSEKEEPING_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </SelectPill>
        </FormField>
        <FormField id="hk-filter-building" label={t("colBuilding")}>
          <SelectPill
            id="hk-filter-building"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allBuildings")}</option>
            {buildingOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </SelectPill>
        </FormField>
      </div>
      {!canUpdate && <p className="text-xs text-mute">{t("noPermissionHint")}</p>}
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
      <p className="text-[11px] text-mute">{t("deleteHint")}</p>

      <CreateHousekeepingTaskDialog open={showCreate} onOpenChange={setShowCreate} propertyId={propertyId} />
      <AssignHousekeepingTaskDialog
        open={assignTarget !== null}
        onOpenChange={(o) => !o && setAssignTarget(null)}
        propertyId={propertyId}
        task={assignTarget}
      />
      <EditHousekeepingNoteDialog
        open={noteTarget !== null}
        onOpenChange={(o) => !o && setNoteTarget(null)}
        propertyId={propertyId}
        task={noteTarget}
      />
      <CompleteHousekeepingTaskDialog
        open={completeTarget !== null}
        onOpenChange={(o) => !o && setCompleteTarget(null)}
        propertyId={propertyId}
        task={completeTarget}
      />
      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteMessage", { unit: deleteTarget?.unit.unitNumber ?? "" })}
        confirmText={t("btnDelete")}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
