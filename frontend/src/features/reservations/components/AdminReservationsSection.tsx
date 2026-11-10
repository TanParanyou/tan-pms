"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus, SearchCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { useAdminReservations } from "../api/use-reservations";
import { AvailabilityInspectorDialog } from "./AvailabilityInspectorDialog";
import {
  PERMISSION_RESERVATIONS_MANAGE,
  RESERVATION_STATUS_BADGE_VARIANT,
  RESERVATION_STATUS_OPTIONS,
  RESERVATION_STAY_MODES,
} from "../constants";
import type { ReservationItemDto } from "../types";

export function AdminReservationsSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.reservations");
  const tModes = useTranslations("stayModes");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSION_RESERVATIONS_MANAGE);
  const [status, setStatus] = useState("");
  const [stayMode, setStayMode] = useState("");
  const [search, setSearch] = useState("");
  const [showInspector, setShowInspector] = useState(false);
  const debounced = useDebouncedValue(search.trim().toLowerCase(), 200);

  const { data, isLoading, isError, refetch } = useAdminReservations(activeProperty.id, {
    status: status || undefined,
    stayMode: stayMode || undefined,
  });
  const items = useMemo(
    () =>
      (data?.items ?? []).filter(
        (r) => !debounced || r.documentNumber.toLowerCase().includes(debounced) || r.customer.fullName.toLowerCase().includes(debounced)
      ),
    [data, debounced]
  );

  const columns: ColumnDef<ReservationItemDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (r) => <span className="font-mono text-xs">{r.documentNumber}</span> },
    {
      id: "customer",
      header: t("colCustomer"),
      cell: (r) => (
        <div className="space-y-0.5">
          <div className="text-xs text-ink">{r.customer.fullName}</div>
          <div className="font-mono text-[11px] text-mute">{r.customer.maskedNationalId}</div>
        </div>
      ),
    },
    {
      id: "slot",
      header: t("colStayModeSlot"),
      cell: (r) => (
        <div className="space-y-0.5 text-xs">
          <Badge variant="outline">{tModes(r.stayMode)}</Badge>
          <div className="font-mono text-[11px]">
            {formatDateTime(r.slotStartAt, locale)} - {formatDateTime(r.slotEndAt, locale)}
          </div>
        </div>
      ),
    },
    {
      id: "unit",
      header: t("colUnitTypeUnit"),
      cell: (r) => (
        <div className="space-y-0.5 text-xs">
          <div>{resolveLocalizedText(r.unitType.name, locale)}</div>
          <div className="font-mono text-[11px] text-mute">{r.assignedUnit ? r.assignedUnit.unitNumber : t("quotaUnassignedBadge")}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: t("colStatusDeposit"),
      cell: (r) => (
        <div className="space-y-0.5">
          <Badge variant={RESERVATION_STATUS_BADGE_VARIANT[r.status]}>{t(`status${r.status}`)}</Badge>
          <div className="font-mono text-[11px] tabular-nums">{formatCurrencyThb(r.depositAmount)}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="RES"
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowInspector(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
              <SearchCheck className="h-4 w-4" />
              <span>{t("inspectAvailability")}</span>
            </Button>
            {canManage && (
              <Button type="button" size="sm" onClick={() => router.push("/admin/reservations/create")} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Plus className="h-4 w-4" />
                <span>{t("createReservation")}</span>
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none sm:grid-cols-3">
        <Input aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} wrapperClassName="!mb-0" className="h-10 rounded-full text-sm" />
        <SelectPill aria-label={t("colStatusDeposit")} value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="!mb-0">
          <option value="">{t("filterStatusAll")}</option>
          {RESERVATION_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`status${s}`)}
            </option>
          ))}
        </SelectPill>
        <SelectPill aria-label={t("fieldStayMode")} value={stayMode} onChange={(e) => setStayMode(e.target.value)} wrapperClassName="!mb-0">
          <option value="">{t("filterStayModeAll")}</option>
          {RESERVATION_STAY_MODES.map((m) => (
            <option key={m} value={m}>
              {tModes(m)}
            </option>
          ))}
        </SelectPill>
      </div>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyReservations")}
        onRowClick={(r) => router.push(`/admin/reservations/${r.id}`)}
      />
      <AvailabilityInspectorDialog open={showInspector} onOpenChange={setShowInspector} propertyId={activeProperty.id} />
    </div>
  );
}
