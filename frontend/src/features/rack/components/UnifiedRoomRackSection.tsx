"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { StayModeFilterPills } from "@/components/layout/stay-mode-filter-pills";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { BedDouble, Brush, CheckCircle2, Eye, Plus, UserPlus, Users } from "lucide-react";
import type { RoomRackItemDto } from "../types";

export interface UnifiedRoomRackSectionProps {
  items: RoomRackItemDto[];
  onOpenQuickWalkIn: () => void;
  isLoading?: boolean;
  stayModeFilter?: string;
  onSelectStayModeFilter?: (mode: string) => void;
}

export function UnifiedRoomRackSection({
  items,
  onOpenQuickWalkIn,
  isLoading = false,
  stayModeFilter,
  onSelectStayModeFilter,
}: UnifiedRoomRackSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tRack = useTranslations("admin.roomRack");
  const tModes = useTranslations("stayModes");
  const tOccupancy = useTranslations("occupancyStatus");
  const tCondition = useTranslations("conditionStatus");
  const tCommon = useTranslations("common");

  const totalCount = items.length;
  const vacantCleanCount = items.filter(
    (i) => i.occupancyStatus === "Vacant" && i.conditionStatus === "Clean"
  ).length;
  const occupiedCount = items.filter((i) => i.occupancyStatus === "Occupied").length;
  const dirtyCount = items.filter(
    (i) => i.conditionStatus === "Dirty" || i.conditionStatus === "Cleaning"
  ).length;

  const columns: ColumnDef<RoomRackItemDto>[] = [
    {
      id: "unitNumber",
      header: tRack("unit"),
      headerClassName: "w-[120px]",
      cell: (row) => (
        <span className="font-mono font-semibold text-ink">
          {row.unit.unitNumber}
        </span>
      ),
    },
    {
      id: "building",
      header: tRack("building"),
      headerClassName: "w-[150px]",
      cell: (row) => (
        <span className="text-xs text-body">
          {resolveLocalizedText(row.unit.buildingName, locale)} • Fl {row.unit.floorNumber}
        </span>
      ),
    },
    {
      id: "unitType",
      header: tRack("type"),
      headerClassName: "w-[180px]",
      cell: (row) => (
        <span className="text-xs text-ink">
          {resolveLocalizedText(row.unit.unitTypeName, locale)}
        </span>
      ),
    },
    {
      id: "occupancyStatus",
      header: tRack("occupancy"),
      headerClassName: "w-[130px]",
      cell: (row) => {
        const variant =
          row.occupancyStatus === "Vacant"
            ? "outline"
            : row.occupancyStatus === "Occupied"
            ? "default"
            : "secondary";
        const label =
          tOccupancy(row.occupancyStatus as "Vacant" | "Occupied" | "Reserved" | "Blocked") ||
          "-";
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      id: "conditionStatus",
      header: tRack("condition"),
      headerClassName: "w-[140px]",
      cell: (row) => {
        const variant =
          row.conditionStatus === "Clean"
            ? "success"
            : row.conditionStatus === "Dirty"
            ? "destructive"
            : "warning";
        const label =
          tCondition(
            row.conditionStatus as "Clean" | "Dirty" | "Cleaning" | "Inspecting" | "OutOfOrder"
          ) || "-";
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      id: "customer",
      header: tRack("customer"),
      headerClassName: "w-[190px]",
      cell: (row) => {
        if (!row.customer) return <span className="text-xs text-mute">-</span>;
        return (
          <div>
            <span className="text-xs font-medium block text-ink">
              {row.customer.fullName}
            </span>
            <span className="text-[11px] font-mono text-body tabular-nums">
              {row.customer.maskedNationalId}
            </span>
          </div>
        );
      },
    },
    {
      id: "documentNumber",
      header: tRack("document"),
      headerClassName: "w-[180px]",
      cell: (row) => {
        if (!row.activeDocumentNumber) {
          return <span className="text-xs text-mute">-</span>;
        }
        return <CommandTag className="text-xs">{row.activeDocumentNumber}</CommandTag>;
      },
    },
    {
      id: "actions",
      header: <span className="sr-only">{tRack("unitActions")}</span>,
      headerClassName: "w-[80px] text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end">
          <Tooltip
            content={row.occupancyStatus === "Vacant" ? tRack("quickCheckIn") : tCommon("details")}
            position="top"
          >
            <Button
              type="button"
              variant={row.occupancyStatus === "Vacant" ? "default" : "outline"}
              size="icon"
              onClick={onOpenQuickWalkIn}
              aria-label={row.occupancyStatus === "Vacant" ? tRack("quickCheckIn") : tCommon("details")}
              className="rounded-full h-7 w-7 text-xs"
            >
              {row.occupancyStatus === "Vacant" ? (
                <UserPlus className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-6" aria-label="Room Rack Grid">
      {/* 1. Page Header with Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-rounded font-semibold text-ink tracking-tight">
            {tRack("title")}
          </h1>
          <p className="text-xs text-body mt-0.5">{tRack("description")}</p>
        </div>
        <Button
          type="button"
          onClick={onOpenQuickWalkIn}
          size="sm"
          className="rounded-full shadow-none gap-1.5 self-start sm:self-auto shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{tRack("quickCheckIn")}</span>
        </Button>
      </div>

      {/* 2. Key Metrics Snapshot (High Signal, No Clutter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-[12px] border border-hairline bg-surface-soft p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-body font-medium">
            <span>{tRack("totalUnits")}</span>
            <BedDouble className="h-4 w-4 text-mute" />
          </div>
          <div className="font-mono text-2xl font-semibold text-ink tabular-nums mt-2">
            {totalCount}
          </div>
        </div>

        <div className="rounded-[12px] border border-hairline bg-surface-soft p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-body font-medium">
            <span>{tRack("vacantClean")}</span>
            <CheckCircle2 className="h-4 w-4 text-terminal-green" />
          </div>
          <div className="font-mono text-2xl font-semibold text-terminal-green tabular-nums mt-2">
            {vacantCleanCount}
          </div>
        </div>

        <div className="rounded-[12px] border border-hairline bg-surface-soft p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-body font-medium">
            <span>{tRack("occupied")}</span>
            <Users className="h-4 w-4 text-ink" />
          </div>
          <div className="font-mono text-2xl font-semibold text-ink tabular-nums mt-2">
            {occupiedCount}
          </div>
        </div>

        <div className="rounded-[12px] border border-hairline bg-surface-soft p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-body font-medium">
            <span>{tRack("needsCleaning")}</span>
            <Brush className="h-4 w-4 text-mute" />
          </div>
          <div className="font-mono text-2xl font-semibold text-ink tabular-nums mt-2">
            {dirtyCount}
          </div>
        </div>
      </div>

      {/* 3. Filter & Control Toolbar */}
      {onSelectStayModeFilter && (
        <StayModeFilterPills
          selectedMode={stayModeFilter ?? "All"}
          onSelectMode={onSelectStayModeFilter}
        />
      )}

      {/* 4. Table */}
      <DataTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        emptyTitle={tRack("title")}
        emptyDescription={tCommon("emptyFilterDescription")}
      />
    </section>
  );
}
