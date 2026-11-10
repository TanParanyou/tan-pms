"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import type { ReservationItemDto } from "@/generated/api";
import { useClientReservations } from "../api/use-client-reservations";
import { RESERVATION_STATUS_BADGE_VARIANT } from "../constants";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function ClientReservationsSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.reservations");
  const pg = useServerPagination([]);
  const { data, isLoading, isError, refetch } = useClientReservations(pg.paging);

  const columns: ColumnDef<ReservationItemDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (r) => <span className="font-mono text-xs">{r.documentNumber}</span> },
    { id: "type", header: t("colUnitType"), cell: (r) => <span className="text-xs">{resolveLocalizedText(r.unitType.name, locale)}</span> },
    {
      id: "slot",
      header: t("colSlot"),
      cell: (r) => (
        <span className="text-xs">
          {formatDateTime(r.slotStartAt, locale)} - {formatDateTime(r.slotEndAt, locale)}
        </span>
      ),
    },
    { id: "deposit", header: t("colDeposit"), align: "right", cell: (r) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(r.depositAmount)}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (r) => <Badge variant={RESERVATION_STATUS_BADGE_VARIANT[r.status]}>{t(`status.${r.status}`)}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="RES"
        title={t("title")}
        description={t("description")}
        actions={
          <Button type="button" size="sm" onClick={() => router.push("/client/book")} className="h-9 rounded-full px-4 gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            <span>{t("btnBook")}</span>
          </Button>
        }
      />
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={data?.items ?? []}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={(r) => router.push(`/client/reservations/${r.id}`)}
      />
    </div>
  );
}
