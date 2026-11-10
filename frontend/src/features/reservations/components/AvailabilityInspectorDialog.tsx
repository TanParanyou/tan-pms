"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectPill } from "@/components/ui/select-pill";
import { DateTimeInput } from "@/components/ui/date-picker";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { localInputToIso } from "@/lib/datetime";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import type { UnitTypeAvailabilityDto } from "@/generated/api";
import { useAdminAvailabilityQuery } from "../api/use-reservations";
import { RESERVATION_STAY_MODES } from "../constants";

export interface AvailabilityInspectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  /** Pre-fills the window (used to pre-check the reservation form). */
  initial?: { stayMode: string; slotStartAt: string; slotEndAt: string };
}

/** Availability Inspector: quota per unit type for a slot range, straight from the availability endpoint. */
export function AvailabilityInspectorDialog({ open, onOpenChange, propertyId, initial }: AvailabilityInspectorDialogProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.reservations");
  const tModes = useTranslations("stayModes");
  const [stayMode, setStayMode] = useState(initial?.stayMode || "Daily");
  const [start, setStart] = useState(initial?.slotStartAt ?? "");
  const [end, setEnd] = useState(initial?.slotEndAt ?? "");

  useEffect(() => {
    if (open && initial) {
      setStayMode(initial.stayMode || "Daily");
      setStart(initial.slotStartAt);
      setEnd(initial.slotEndAt);
    }
  }, [open, initial]);

  const window = useMemo(() => {
    const s = localInputToIso(start);
    const e = localInputToIso(end);
    return s && e && new Date(e) > new Date(s) ? { checkIn: s, checkOut: e, stayMode } : null;
  }, [start, end, stayMode]);
  const invalid = Boolean(start && end && !window);
  const query = useAdminAvailabilityQuery(propertyId, open ? window : null);

  const columns: ColumnDef<UnitTypeAvailabilityDto>[] = [
    {
      id: "type",
      header: t("colUnitType"),
      cell: (i) => (
        <div className="space-y-0.5">
          <div className="text-xs text-ink">{resolveLocalizedText(i.unitType.name, locale)}</div>
          <div className="font-mono text-[11px] text-mute">{i.unitType.code}</div>
        </div>
      ),
    },
    { id: "total", header: t("colTotal"), align: "right", cell: (i) => <span className="font-mono text-xs tabular-nums">{i.totalPhysicalUnits}</span> },
    { id: "held", header: t("colHeld"), align: "right", cell: (i) => <span className="font-mono text-xs tabular-nums">{i.unassignedQuotaHeld}</span> },
    {
      id: "net",
      header: t("colNet"),
      align: "right",
      cell: (i) => (
        <div className="space-y-0.5 text-right">
          <span className="font-mono text-xs font-semibold tabular-nums" data-testid={`inspector-net-${i.unitType.code}`}>{i.netAvailableQuota}</span>
          {i.netAvailableQuota <= 0 && <div><Badge variant="destructive">{t("inspectorSoldOut")}</Badge></div>}
        </div>
      ),
    },
    { id: "turnaround", header: t("colTurnaround"), align: "right", cell: (i) => <span className="font-mono text-xs tabular-nums">{i.turnaroundBufferMinutes}</span> },
    {
      id: "rates",
      header: t("colRates"),
      align: "right",
      cell: (i) => (
        <span className="font-mono text-xs tabular-nums">
          {formatCurrencyThb(i.estimatedRoomRate)} / {formatCurrencyThb(i.estimatedDepositAmount)}
        </span>
      ),
    },
    {
      id: "units",
      header: t("inspectorFreeUnits"),
      cell: (i) => <span className="font-mono text-xs">{i.availableUnits.map((u) => u.unitNumber).join(", ") || "-"}</span>,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("modalTitleInspector")}</DialogTitle>
          <DialogDescription>{t("modalDescInspector")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField id="insp-mode" label={t("fieldStayMode")}>
            <SelectPill id="insp-mode" value={stayMode} onChange={(e) => setStayMode(e.target.value)} wrapperClassName="!mb-0">
              {RESERVATION_STAY_MODES.map((m) => (
                <option key={m} value={m}>
                  {tModes(m)}
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField id="insp-start" label={t("fieldSlotStart")}>
            <DateTimeInput id="insp-start" mode="datetime" value={start} onValueChange={setStart} placeholder={t("fieldSlotStart")} wrapperClassName="!mb-0" />
          </FormField>
          <FormField id="insp-end" label={t("fieldSlotEnd")} error={invalid ? t("errorSlotWindow") : undefined}>
            <DateTimeInput id="insp-end" mode="datetime" value={end} onValueChange={setEnd} hasError={invalid} placeholder={t("fieldSlotEnd")} wrapperClassName="!mb-0" />
          </FormField>
        </div>
        {!window && !invalid && <p className="text-xs text-mute">{t("inspectorHint")}</p>}
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          getRowId={(i) => i.unitType.id}
          isLoading={query.isLoading}
          isError={query.isError}
          errorMessage={t("availabilityError")}
          onRetry={() => void query.refetch()}
          emptyTitle={t("inspectorEmpty")}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            {t("closeInspector")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
