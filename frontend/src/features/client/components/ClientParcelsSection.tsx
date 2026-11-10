"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";
import { PARCEL_STATUS_OPTIONS, PARCEL_STATUS_BADGE_VARIANT } from "@/features/parcels/constants";
import type { ParcelItemDto, ParcelStatusType } from "@/features/parcels/types";
import { useClientParcels } from "../api/use-client-operations";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function ClientParcelsSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.parcels");
  const tParcel = useTranslations("admin.parcels");
  const [status, setStatus] = useState("");
  const pg = useServerPagination([status]);
  const { data, isLoading, isError, refetch } = useClientParcels(status || undefined, pg.paging);

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
    { id: "carrier", header: t("colCarrier"), cell: (p) => <span className="text-xs">{p.carrierName}</span> },
    { id: "tracking", header: t("colTracking"), cell: (p) => <span className="font-mono text-xs">{p.trackingNumber ?? "-"}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (p) => (
        <Badge variant={PARCEL_STATUS_BADGE_VARIANT[p.status as ParcelStatusType]}>{tParcel(`status.${p.status}`)}</Badge>
      ),
    },
    { id: "arrived", header: t("colArrivedAt"), cell: (p) => <span className="text-xs">{formatDateTime(p.arrivedAt, locale)}</span> },
    {
      id: "pickedUp",
      header: t("colPickedUpAt"),
      cell: (p) => <span className="text-xs">{p.pickedUpAt ? formatDateTime(p.pickedUpAt, locale) : "-"}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="PCL" title={t("title")} description={t("description")} />
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("listTitle")}</h3>
        <div className="w-48">
          <SelectPill aria-label={t("colStatus")} value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="!mb-0">
            <option value="">{t("allStatuses")}</option>
            {PARCEL_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {tParcel(`status.${s}`)}
              </option>
            ))}
          </SelectPill>
        </div>
      </div>
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={data?.items ?? []}
        getRowId={(p) => p.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={(p) => router.push(`/client/parcels/${p.id}`)}
      />
      <p className="text-xs text-mute">{t("pickupInstructions")}</p>
    </div>
  );
}
