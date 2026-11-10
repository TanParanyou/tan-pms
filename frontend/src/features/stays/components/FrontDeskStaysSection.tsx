"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { FileText, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { KpiSummaryStrip } from "@/components/layout/kpi-summary-strip";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { useAdminStays } from "../api/use-stays";
import { CHECK_IN_STAY_MODES, PERMISSION_REGULATORY_EXPORT, PERMISSION_STAY_CHECKIN, STAY_STATUS_BADGE_VARIANT, STAY_STATUS_OPTIONS } from "../constants";
import type { StayDetailDto } from "../types";
import { RegulatoryExportDialog } from "./RegulatoryExportDialog";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function FrontDeskStaysSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.stays");
  const tModes = useTranslations("stayModes");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const canCheckIn = hasPermission(PERMISSION_STAY_CHECKIN);
  const canExport = hasPermission(PERMISSION_REGULATORY_EXPORT);

  const [status, setStatus] = useState("");
  const [stayMode, setStayMode] = useState("");
  const [search, setSearch] = useState("");
  const [showRegulatory, setShowRegulatory] = useState(false);
  const debounced = useDebouncedValue(search.trim().toLowerCase(), 200);

  const pg = useServerPagination([status, stayMode]);
  const { data, isLoading, isError, refetch } = useAdminStays(activeProperty.id, { status: status || undefined, stayMode: stayMode || undefined }, pg.paging);
  const all = useMemo(() => data?.items ?? [], [data]);
  const items = useMemo(
    () =>
      all.filter(
        (s) =>
          !debounced ||
          s.documentNumber.toLowerCase().includes(debounced) ||
          s.unit.unitNumber.toLowerCase().includes(debounced) ||
          s.customer.fullName.toLowerCase().includes(debounced)
      ),
    [all, debounced]
  );
  const kpi = useMemo(
    () => ({
      active: all.filter((s) => s.status === "Active").length,
      overtime: all.filter((s) => s.status === "Active" && s.isOvertime).length,
      unsettled: all.filter((s) => s.status === "Active" && s.folio.balanceDue > 0).length,
    }),
    [all]
  );

  const columns: ColumnDef<StayDetailDto>[] = [
    {
      id: "doc",
      header: t("colDocUnit"),
      cell: (s) => (
        <div className="space-y-0.5">
          <div className="font-mono text-xs">{s.documentNumber}</div>
          <div className="text-[11px] text-mute">{s.unit.unitNumber}</div>
        </div>
      ),
    },
    {
      id: "mode",
      header: t("colModeTimer"),
      cell: (s) => (
        <div className="space-y-0.5 text-xs">
          <Badge variant="outline">{tModes(s.stayMode)}</Badge>
          {s.expectedCheckOutAt && <div className="font-mono text-[11px]">{formatDateTime(s.expectedCheckOutAt, locale)}</div>}
          {s.isOvertime && <Badge variant="destructive">{t("overtimeLabel")}</Badge>}
        </div>
      ),
    },
    {
      id: "guest",
      header: t("colGuestOccupants"),
      cell: (s) => (
        <div className="space-y-0.5 text-xs">
          <div className="text-ink">{s.customer.fullName}</div>
          <div className="text-[11px] text-mute">{t("occupantCountBadge", { count: s.occupants.length })}</div>
        </div>
      ),
    },
    {
      id: "folio",
      header: t("colFolioDeposit"),
      align: "right",
      cell: (s) => (
        <div className="space-y-0.5 text-right font-mono text-xs tabular-nums">
          <div className={s.folio.balanceDue > 0 ? "text-destructive" : undefined}>{formatCurrencyThb(s.folio.balanceDue)}</div>
          <div className="text-[11px] text-mute">{formatCurrencyThb(s.keyDepositBalance)}</div>
        </div>
      ),
    },
    { id: "status", header: t("colStatus"), cell: (s) => <Badge variant={STAY_STATUS_BADGE_VARIANT[s.status]}>{t(`stayStatus${s.status}`)}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="STY"
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <Button type="button" size="sm" variant="outline" onClick={() => setShowRegulatory(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <FileText className="h-4 w-4" />
                <span>{t("btnRegulatory")}</span>
              </Button>
            )}
            {canCheckIn && (
              <Button type="button" size="sm" onClick={() => router.push("/admin/stays/create")} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <LogIn className="h-4 w-4" />
                <span>{t("btnCheckIn")}</span>
              </Button>
            )}
          </div>
        }
      />
      <p className="text-xs text-mute">
        {t("monthlyHint")}{" "}
        <Link href="/admin/leases/create" className="font-medium underline">
          {t("monthlyHintLink")}
        </Link>
      </p>
      <KpiSummaryStrip
        items={[
          { id: "active", label: t("badgeActiveLabel"), value: kpi.active },
          { id: "overtime", label: t("badgeOvertimeLabel"), value: kpi.overtime, isAlert: kpi.overtime > 0 },
          { id: "unsettled", label: t("badgeUnsettledLabel"), value: kpi.unsettled, isAlert: kpi.unsettled > 0 },
        ]}
      />
      <div className="grid grid-cols-1 gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none sm:grid-cols-3">
        <Input aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} wrapperClassName="!mb-0" className="h-10 rounded-full text-sm" />
        <SelectPill aria-label={t("colStatus")} value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="!mb-0">
          <option value="">{t("filterStatusAll")}</option>
          {STAY_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`stayStatus${s}`)}
            </option>
          ))}
        </SelectPill>
        <SelectPill aria-label={t("fieldStayMode")} value={stayMode} onChange={(e) => setStayMode(e.target.value)} wrapperClassName="!mb-0">
          <option value="">{t("filterStayModeAll")}</option>
          {CHECK_IN_STAY_MODES.map((m) => (
            <option key={m} value={m}>
              {tModes(m)}
            </option>
          ))}
        </SelectPill>
      </div>
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={items}
        getRowId={(s) => s.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyStays")}
        onRowClick={(s) => router.push(`/admin/stays/${s.id}`)}
      />
      <RegulatoryExportDialog open={showRegulatory} onOpenChange={setShowRegulatory} propertyId={activeProperty.id} />
    </div>
  );
}
