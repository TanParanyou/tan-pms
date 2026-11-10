"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";
import { useAdminParcels } from "../api/use-parcels";
import { PERMISSION_PARCELS_MANAGE, PARCEL_STATUS_OPTIONS, PARCEL_STATUS_BADGE_VARIANT } from "../constants";
import type { ParcelItemDto, ParcelStatusType } from "../types";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function ParcelsListSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.parcels");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSION_PARCELS_MANAGE);
  const [status, setStatus] = useState<ParcelStatusType | "">("");

  const pg = useServerPagination([status]);
  const { data, isLoading, isError, refetch } = useAdminParcels(activeProperty.id, status || undefined, pg.paging);
  const items = useMemo(() => data?.items ?? [], [data]);

  const columns: ColumnDef<ParcelItemDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (p) => <span className="font-mono text-xs">{p.documentNumber}</span> },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (p) => (
        <span className="text-xs">
          {p.unit.unitNumber} ({resolveLocalizedText(p.unit.buildingName, locale)})
        </span>
      ),
    },
    { id: "customer", header: t("colCustomer"), cell: (p) => <span className="text-xs text-ink">{p.customer.fullName}</span> },
    { id: "carrier", header: t("colCarrier"), cell: (p) => <span className="text-xs">{p.carrierName}</span> },
    {
      id: "tracking",
      header: t("colTracking"),
      cell: (p) => <span className="font-mono text-xs">{p.trackingNumber ? p.trackingNumber : "-"}</span>,
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (p) => (
        <Badge variant={PARCEL_STATUS_BADGE_VARIANT[p.status as ParcelStatusType]}>{t(`status.${p.status}`)}</Badge>
      ),
    },
    { id: "arrived", header: t("colArrivedAt"), cell: (p) => <span className="text-xs">{formatDateTime(p.arrivedAt, locale)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="PCL"
        title={t("title")}
        description={t("description")}
        actions={
          canManage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/admin/parcels/create")}
              className="h-9 rounded-full px-4 gap-1.5 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>{t("btnCreate")}</span>
            </Button>
          ) : undefined
        }
      />
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("listTitle")}</h3>
        <div className="w-48">
          <SelectPill
            aria-label={t("colStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as ParcelStatusType | "")}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allStatuses")}</option>
            {PARCEL_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </SelectPill>
        </div>
      </div>
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={items}
        getRowId={(p) => p.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={(p) => router.push(`/admin/parcels/${p.id}`)}
      />
    </div>
  );
}
