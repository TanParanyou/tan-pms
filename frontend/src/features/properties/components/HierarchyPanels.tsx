"use client";

import React, { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyThb } from "@/lib/formatters";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import {
  usePropertyHierarchy,
  useDeleteBuildingMutation,
  useDeleteFloorMutation,
  useDeleteUnitTypeMutation,
} from "../api/use-properties";
import { PERMISSION_PROPERTIES_MANAGE } from "../constants";
import type { BuildingDetailDto, UnitTypeDetailDto } from "../types";
import { BuildingDialog, FloorDialog, UnitTypeDialog } from "./HierarchyDialogs";

interface FloorRow {
  id: string;
  buildingId: string;
  buildingName: BuildingDetailDto["name"];
  floorNumber: number;
  nameTh: string;
  nameEn: string;
  unitCount: number;
}

interface RowActionsProps {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}
function RowActions({ editLabel, deleteLabel, onEdit, onDelete, disabled }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button type="button" size="icon" variant="outline" title={editLabel} aria-label={editLabel} disabled={disabled} onClick={onEdit} className="h-8 w-8 rounded-full">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" variant="outline" title={deleteLabel} aria-label={deleteLabel} disabled={disabled} onClick={onDelete} className="h-8 w-8 rounded-full">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Buildings and floors management (create / edit via upsert, delete with in-use conflict surfaced). */
export function BuildingsPanel() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.properties");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_PROPERTIES_MANAGE);
  const pid = activeProperty.id;
  const { data, isLoading, isError, refetch } = usePropertyHierarchy(pid);
  const deleteBuilding = useDeleteBuildingMutation(pid);
  const deleteFloor = useDeleteFloorMutation(pid);
  const isBusy = deleteBuilding.isPending || deleteFloor.isPending;

  const [buildingDialog, setBuildingDialog] = useState<{ building: BuildingDetailDto | null } | null>(null);
  const [floorDialog, setFloorDialog] = useState<{ floor: FloorRow | null } | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<BuildingDetailDto | null>(null);
  const [floorToDelete, setFloorToDelete] = useState<FloorRow | null>(null);

  const buildings = useMemo(() => data?.buildings ?? [], [data]);
  const floors = useMemo<FloorRow[]>(
    () =>
      buildings.flatMap((b) =>
        b.floors.map((f) => ({
          id: f.id,
          buildingId: b.id,
          buildingName: b.name,
          floorNumber: f.floorNumber,
          nameTh: f.name.th,
          nameEn: f.name.en ?? "",
          unitCount: f.unitCount,
        }))
      ),
    [buildings]
  );

  const executeDeleteBuilding = async () => {
    if (!buildingToDelete || isBusy) return;
    try {
      await deleteBuilding.mutateAsync(buildingToDelete.id);
      toastSuccess(t("toastBuildingDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setBuildingToDelete(null);
    }
  };
  const executeDeleteFloor = async () => {
    if (!floorToDelete || isBusy) return;
    try {
      await deleteFloor.mutateAsync(floorToDelete.id);
      toastSuccess(t("toastFloorDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setFloorToDelete(null);
    }
  };

  const buildingColumns: ColumnDef<BuildingDetailDto>[] = [
    { id: "code", header: t("fieldCode"), cell: (b) => <span className="font-mono text-xs">{b.code}</span> },
    { id: "name", header: t("colName"), cell: (b) => <span className="text-xs text-ink">{resolveLocalizedText(b.name, locale)}</span> },
    { id: "floors", header: t("summaryFloors"), align: "right", cell: (b) => <span className="font-mono text-xs tabular-nums">{b.floors.length}</span> },
    ...(canManage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">{t("colActions")}</span>,
            align: "right" as const,
            cell: (b: BuildingDetailDto) => (
              <RowActions
                editLabel={`${t("btnEdit")} ${b.code}`}
                deleteLabel={`${t("btnDelete")} ${b.code}`}
                disabled={isBusy}
                onEdit={() => setBuildingDialog({ building: b })}
                onDelete={() => setBuildingToDelete(b)}
              />
            ),
          },
        ]
      : []),
  ];
  const floorColumns: ColumnDef<FloorRow>[] = [
    { id: "building", header: t("fieldBuilding"), cell: (f) => <span className="text-xs">{resolveLocalizedText(f.buildingName, locale)}</span> },
    { id: "number", header: t("fieldFloorNumber"), align: "right", cell: (f) => <span className="font-mono text-xs tabular-nums">{f.floorNumber}</span> },
    { id: "name", header: t("colName"), cell: (f) => <span className="text-xs text-ink">{locale === "en" && f.nameEn ? f.nameEn : f.nameTh}</span> },
    { id: "units", header: t("summaryTotalUnits"), align: "right", cell: (f) => <span className="font-mono text-xs tabular-nums">{f.unitCount}</span> },
    ...(canManage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">{t("colActions")}</span>,
            align: "right" as const,
            cell: (f: FloorRow) => (
              <RowActions
                editLabel={`${t("btnEdit")} ${f.nameTh}`}
                deleteLabel={`${t("btnDelete")} ${f.nameTh}`}
                disabled={isBusy}
                onEdit={() => setFloorDialog({ floor: f })}
                onDelete={() => setFloorToDelete(f)}
              />
            ),
          },
        ]
      : []),
  ];

  const tableState = { isLoading, isError, errorMessage: t("loadHierarchyError"), onRetry: () => void refetch(), emptyTitle: t("emptyMasterTitle"), emptyDescription: t("emptyMasterDesc") };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{t("buildingsTitle")}</h3>
          {canManage && (
            <Button type="button" size="sm" onClick={() => setBuildingDialog({ building: null })} className="h-9 gap-1.5 rounded-full px-4 text-xs">
              <Plus className="h-4 w-4" />
              <span>{t("addBuilding")}</span>
            </Button>
          )}
        </div>
        <DataTable columns={buildingColumns} data={buildings} getRowId={(b) => b.id} {...tableState} />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{t("floorsTitle")}</h3>
          {canManage && (
            <Button type="button" size="sm" disabled={buildings.length === 0} onClick={() => setFloorDialog({ floor: null })} className="h-9 gap-1.5 rounded-full px-4 text-xs">
              <Plus className="h-4 w-4" />
              <span>{t("addFloor")}</span>
            </Button>
          )}
        </div>
        <DataTable columns={floorColumns} data={floors} getRowId={(f) => f.id} {...tableState} />
      </div>
      <BuildingDialog open={buildingDialog !== null} onOpenChange={(o) => !o && setBuildingDialog(null)} propertyId={pid} building={buildingDialog?.building ?? null} />
      <FloorDialog open={floorDialog !== null} onOpenChange={(o) => !o && setFloorDialog(null)} propertyId={pid} floor={floorDialog?.floor ?? null} buildings={buildings} />
      <ConfirmationModal
        isOpen={buildingToDelete !== null}
        onClose={() => setBuildingToDelete(null)}
        onConfirm={executeDeleteBuilding}
        title={t("confirmDeleteBuildingTitle")}
        message={t("confirmDeleteMessage", { name: buildingToDelete?.code ?? "" })}
        confirmText={t("btnDelete")}
        variant="danger"
        isLoading={deleteBuilding.isPending}
      />
      <ConfirmationModal
        isOpen={floorToDelete !== null}
        onClose={() => setFloorToDelete(null)}
        onConfirm={executeDeleteFloor}
        title={t("confirmDeleteFloorTitle")}
        message={t("confirmDeleteMessage", { name: floorToDelete?.nameTh ?? "" })}
        confirmText={t("btnDelete")}
        variant="danger"
        isLoading={deleteFloor.isPending}
      />
    </div>
  );
}

export function UnitTypesPanel() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.properties");
  const tModes = useTranslations("stayModes");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_PROPERTIES_MANAGE);
  const pid = activeProperty.id;
  const { data, isLoading, isError, refetch } = usePropertyHierarchy(pid);
  const deleteType = useDeleteUnitTypeMutation(pid);
  const [dialog, setDialog] = useState<{ unitType: UnitTypeDetailDto | null } | null>(null);
  const [toDelete, setToDelete] = useState<UnitTypeDetailDto | null>(null);

  const executeDelete = async () => {
    if (!toDelete || deleteType.isPending) return;
    try {
      await deleteType.mutateAsync(toDelete.id);
      toastSuccess(t("toastUnitTypeDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setToDelete(null);
    }
  };

  const columns: ColumnDef<UnitTypeDetailDto>[] = [
    { id: "code", header: t("fieldCode"), cell: (u) => <span className="font-mono text-xs">{u.code}</span> },
    { id: "name", header: t("colName"), cell: (u) => <span className="text-xs text-ink">{resolveLocalizedText(u.name, locale)}</span> },
    { id: "area", header: t("fieldAreaSqm"), align: "right", cell: (u) => <span className="font-mono text-xs tabular-nums">{u.areaSqm}</span> },
    { id: "modes", header: t("colStayModes"), cell: (u) => <div className="flex flex-wrap gap-1">{u.supportedStayModes.map((m) => <Badge key={m} variant="outline">{tModes(m)}</Badge>)}</div> },
    { id: "daily", header: t("fieldDailyRate"), align: "right", cell: (u) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(u.dailyRate)}</span> },
    { id: "monthly", header: t("fieldMonthlyRate"), align: "right", cell: (u) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(u.monthlyRentRate)}</span> },
    ...(canManage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">{t("colActions")}</span>,
            align: "right" as const,
            cell: (u: UnitTypeDetailDto) => (
              <RowActions
                editLabel={`${t("btnEdit")} ${u.code}`}
                deleteLabel={`${t("btnDelete")} ${u.code}`}
                disabled={deleteType.isPending}
                onEdit={() => setDialog({ unitType: u })}
                onDelete={() => setToDelete(u)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{t("unitTypesTitle")}</h3>
        {canManage && (
          <Button type="button" size="sm" onClick={() => setDialog({ unitType: null })} className="h-9 gap-1.5 rounded-full px-4 text-xs">
            <Plus className="h-4 w-4" />
            <span>{t("addUnitType")}</span>
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={data?.unitTypes ?? []}
        getRowId={(u) => u.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadHierarchyError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyMasterTitle")}
        emptyDescription={t("emptyMasterDesc")}
      />
      <UnitTypeDialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)} propertyId={pid} unitType={dialog?.unitType ?? null} />
      <ConfirmationModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={executeDelete}
        title={t("confirmDeleteUnitTypeTitle")}
        message={t("confirmDeleteMessage", { name: toDelete?.code ?? "" })}
        confirmText={t("btnDelete")}
        variant="danger"
        isLoading={deleteType.isPending}
      />
    </div>
  );
}
