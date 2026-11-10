"use client";

import React from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, FileText, Home, Package } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { ClientNotificationsSection } from "@/features/notifications/components/ClientNotificationsSection";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { useClientDashboard } from "../api/use-client-dashboard";
import { HoldTtlInvertedCard } from "./HoldTtlInvertedCard";

export function ClientDashboardSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.dashboard");
  const tCommon = useTranslations("common");
  const tBilling = useTranslations("admin.billing");
  const { data, isLoading, isError, refetch } = useClientDashboard();

  if (isLoading) return <PageLoading message={tCommon("loading")} />;
  if (isError) return <EmptyState title={t("loadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />;
  if (!data) return <EmptyState title={t("emptyTitle")} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("greeting", { name: data.customer.fullName })} description={t("description")} />

      {data.activeHoldReservation && (
        <HoldTtlInvertedCard
          hold={data.activeHoldReservation}
          href="/client/reservations"
          onExpire={() => void refetch()}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-4 rounded-[12px] border border-hairline p-6 shadow-none">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-rounded">
              <Home className="h-4 w-4" aria-hidden="true" />
              {t("leaseTitle")}
            </CardTitle>
            <Link href="/client/lease">
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3 gap-1.5 text-xs">
                <span>{t("viewLease")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {data.activeLease ? (
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label={t("leaseNumber")}>{data.activeLease.documentNumber ?? "-"}</DetailItem>
              <DetailItem label={t("unit")}>
                {data.activeLease.unit
                  ? `${data.activeLease.unit.unitNumber} (${resolveLocalizedText(data.activeLease.unit.buildingName, locale)})`
                  : "-"}
              </DetailItem>
              <DetailItem label={t("rent")}>
                {data.activeLease.monthlyRentAmount == null ? "-" : formatCurrencyThb(data.activeLease.monthlyRentAmount)}
              </DetailItem>
              <DetailItem label={t("depositBalance")}>
                {data.activeLease.securityDepositBalance == null
                  ? "-"
                  : formatCurrencyThb(data.activeLease.securityDepositBalance)}
              </DetailItem>
            </div>
          ) : (
            <p className="text-xs text-mute">{t("noLease")}</p>
          )}
        </Card>

        <Card className="space-y-4 rounded-[12px] border border-hairline p-6 shadow-none">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-rounded">
              <FileText className="h-4 w-4" aria-hidden="true" />
              {t("unpaidTitle")}
            </CardTitle>
            <Link href="/client/invoices">
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3 gap-1.5 text-xs">
                <span>{t("viewInvoices")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {data.unpaidInvoices.length === 0 ? (
            <p className="text-xs text-mute">{t("noUnpaid")}</p>
          ) : (
            <ul className="space-y-2">
              {data.unpaidInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/client/invoices/${inv.id}`}
                    className="flex items-center justify-between gap-2 rounded-full border border-hairline bg-surface-soft px-4 py-1.5 text-xs"
                  >
                    <span className="font-mono text-ink">{inv.documentNumber}</span>
                    <Badge variant={inv.status === "Overdue" ? "overdue" : "warning"}>{tBilling(`status.${inv.status}`)}</Badge>
                    <span className="font-mono tabular-nums">{formatCurrencyThb(inv.totalAmount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-4 rounded-[12px] border border-hairline p-6 shadow-none lg:col-span-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-rounded">
              <Package className="h-4 w-4" aria-hidden="true" />
              {t("parcelsTitle")}
            </CardTitle>
            <Link href="/client/parcels">
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3 gap-1.5 text-xs">
                <span>{t("viewParcels")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          {data.pendingParcels.length === 0 ? (
            <p className="text-xs text-mute">{t("noParcels")}</p>
          ) : (
            <ul className="space-y-2">
              {data.pendingParcels.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-full border border-hairline bg-surface-soft px-4 py-1.5 text-xs">
                  <span className="font-mono text-ink">{p.documentNumber}</span>
                  <span>{p.carrierName}</span>
                  <span className="font-mono text-mute">{formatDateTime(p.arrivedAt, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <ClientNotificationsSection />
      </div>
    </div>
  );
}
