"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import { LEASE_STATUS_BADGE_VARIANT } from "@/features/leases/constants";
import type { LeaseItemDto, LeaseStatusType } from "@/features/leases/types";
import { useClientLeases, useClientLeaseIntents } from "../api/use-client-leases";
import { LeaseIntentsTable } from "./LeaseIntentsTable";

export function ClientLeasesSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.lease");
  const tLease = useTranslations("admin.leases");
  const tIntent = useTranslations("client.portal.intent");
  const leases = useClientLeases();
  const intents = useClientLeaseIntents();

  const columns: ColumnDef<LeaseItemDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (l) => <span className="font-mono text-xs">{l.documentNumber}</span> },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (l) => (
        <span className="text-xs">
          {l.unit.unitNumber} ({resolveLocalizedText(l.unit.buildingName, locale)})
        </span>
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
      cell: (l) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(l.monthlyRentAmount)}</span>,
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (l) => (
        <Badge variant={LEASE_STATUS_BADGE_VARIANT[l.status as LeaseStatusType]}>{tLease(`status.${l.status}`)}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="LSE" title={t("title")} description={t("description")} />
      <DataTable
        columns={columns}
        data={leases.data?.items ?? []}
        getRowId={(l) => l.id}
        isLoading={leases.isLoading}
        isError={leases.isError}
        errorMessage={t("loadError")}
        onRetry={() => void leases.refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={(l) => router.push(`/client/lease/${l.id}`)}
      />
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">{tIntent("listTitle")}</h3>
        <LeaseIntentsTable
          intents={intents.data?.items ?? []}
          isLoading={intents.isLoading}
          isError={intents.isError}
          onRetry={() => void intents.refetch()}
        />
      </div>
    </div>
  );
}
