"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import type { RoomRackItemDto } from "../types";

export interface UnifiedRoomRackSectionProps {
  items: RoomRackItemDto[];
  onOpenQuickWalkIn: () => void;
  isLoading?: boolean;
}

export function UnifiedRoomRackSection({
  items,
  onOpenQuickWalkIn,
  isLoading = false,
}: UnifiedRoomRackSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tRack = useTranslations("admin.roomRack");
  const tOccupancy = useTranslations("occupancyStatus");
  const tCondition = useTranslations("conditionStatus");
  const tCommon = useTranslations("common");

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
      headerClassName: "w-[100px] text-right",
      className: "text-right",
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenQuickWalkIn}
          className="rounded-full h-7 px-3 text-[11px]"
        >
          {row.occupancyStatus === "Vacant" ? tRack("quickCheckIn") : tCommon("details")}
        </Button>
      ),
    },
  ];

  return (
    <section className="space-y-4" aria-label="Room Rack Grid">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-rounded font-medium text-ink">
            {tRack("title")}
          </h2>
          <p className="text-xs text-body">{tRack("description")}</p>
        </div>
        <Button
          type="button"
          onClick={onOpenQuickWalkIn}
          size="sm"
          className="rounded-full shadow-none"
        >
          + {tRack("quickCheckIn")}
        </Button>
      </div>

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
