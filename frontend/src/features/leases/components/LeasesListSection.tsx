"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { ListToolbar } from "@/components/layout/list-toolbar";
import { KpiSummaryStrip } from "@/components/layout/kpi-summary-strip";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermission } from "@/hooks/use-permission";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import { useAdminLeases } from "../api/use-leases";
import {
  LEASE_STATUS_OPTIONS,
  LEASE_STATUS_BADGE_VARIANT,
  PLATE_SEARCH_DEBOUNCE_MS,
} from "../constants";
import type { LeaseItemDto, LeaseStatusType } from "../types";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function LeasesListSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.leases");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();

  const [status, setStatus] = useState<LeaseStatusType | "All">("All");
  const [plateInput, setPlateInput] = useState("");
  const licensePlate = useDebouncedValue(plateInput.trim(), PLATE_SEARCH_DEBOUNCE_MS);

  const pg = useServerPagination([status, licensePlate]);
  const { data, isLoading, isError, refetch } = useAdminLeases(activeProperty.id, {
    status: status === "All" ? undefined : status,
    licensePlate: licensePlate || undefined,
  }, pg.paging);
  const items = useMemo(() => data?.items ?? [], [data]);

  const kpis = useMemo(
    () => [
      { id: "total", label: t("kpiTotal"), value: items.length },
      {
        id: "active",
        label: t("kpiActive"),
        value: items.filter((l) => l.status === "Active").length,
      },
      {
        id: "notice",
        label: t("kpiMoveOutNotice"),
        value: items.filter((l) => l.status === "MoveOutNotice").length,
      },
    ],
    [items, t]
  );

  const columns: ColumnDef<LeaseItemDto>[] = [
    {
      id: "documentNumber",
      header: t("colLeaseNo"),
      cell: (l) => <span className="font-mono text-xs">{l.documentNumber}</span>,
    },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (l) => (
        <div className="space-y-0.5">
          <div className="font-medium text-ink">{l.unit.unitNumber}</div>
          <div className="text-[11px] text-mute">
            {resolveLocalizedText(l.unit.buildingName, locale)}
          </div>
        </div>
      ),
    },
    {
      id: "customer",
      header: t("colCustomer"),
      cell: (l) => (
        <div className="space-y-0.5">
          <div className="font-medium text-ink">{l.customer.fullName}</div>
          <div className="font-mono text-[11px] text-mute">{l.customer.maskedNationalId}</div>
        </div>
      ),
    },
    {
      id: "period",
      header: t("colPeriod"),
      cell: (l) => (
        <span className="font-mono text-xs tabular-nums">
          {l.startDate} - {l.endDate}
        </span>
      ),
    },
    {
      id: "rent",
      header: t("colRent"),
      align: "right",
      cell: (l) => (
        <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(l.monthlyRentAmount)}</span>
      ),
    },
    {
      id: "deposit",
      header: t("colDepositBalance"),
      align: "right",
      cell: (l) => (
        <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(l.securityDepositBalance)}</span>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (l) => (
        <Badge variant={LEASE_STATUS_BADGE_VARIANT[l.status as LeaseStatusType]}>
          {t(`status.${l.status}`)}
        </Badge>
      ),
    },
    {
      id: "plates",
      header: t("colPlates"),
      cell: (l) =>
        l.vehicles.length === 0 ? (
          <span className="text-mute">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {l.vehicles.map((v) => (
              <Badge key={v.id} variant="mono">
                {v.licensePlate}
              </Badge>
            ))}
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="LSE" title={t("title")} description={t("description")} />
      <KpiSummaryStrip items={kpis} />
      <ListToolbar
        searchQuery={plateInput}
        onSearchChange={setPlateInput}
        searchPlaceholder={t("searchPlatePlaceholder")}
        filters={
          <>
            <Button
              type="button"
              size="sm"
              variant={status === "All" ? "default" : "outline"}
              onClick={() => setStatus("All")}
              className="h-8 rounded-full px-4 text-xs"
            >
              {tCommon("viewAll")}
            </Button>
            {LEASE_STATUS_OPTIONS.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={status === s ? "default" : "outline"}
                onClick={() => setStatus(s)}
                className="h-8 rounded-full px-4 text-xs"
              >
                {t(`status.${s}`)}
              </Button>
            ))}
          </>
        }
        actions={
          hasPermission("admin.leases.manage") ? (
            <Link href="/admin/leases/create">
              <Button type="button" size="sm" className="h-10 rounded-full px-5 gap-1.5 text-xs">
                <Plus className="h-4 w-4" />
                <span>{t("btnCreate")}</span>
              </Button>
            </Link>
          ) : null
        }
      />
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={items}
        getRowId={(l) => l.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={(l) => router.push(`/admin/leases/${l.id}`)}
      />
    </div>
  );
}
