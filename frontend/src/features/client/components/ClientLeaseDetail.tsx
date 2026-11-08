"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, CalendarClock, LogOut, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import { LEASE_STATUS_BADGE_VARIANT } from "@/features/leases/constants";
import type { LeaseItemDto, LeaseStatusType } from "@/features/leases/types";
import { useClientLease, useClientLeaseIntents } from "../api/use-client-leases";
import type { LeaseIntentType } from "../types";
import { LeaseIntentDialog } from "./LeaseIntentDialog";
import { LeaseIntentsTable } from "./LeaseIntentsTable";

export function ClientLeaseDetail({ leaseId }: { leaseId: string }) {
  const t = useTranslations("client.portal.lease");
  const tCommon = useTranslations("common");
  const { data, isLoading, isError, refetch } = useClientLease(leaseId);

  if (isLoading) return <PageLoading message={tCommon("loading")} />;
  if (isError) return <EmptyState title={t("loadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />;
  if (!data) return <EmptyState title={t("notFound")} />;
  return <LeaseBody lease={data} />;
}

function LeaseBody({ lease }: { lease: LeaseItemDto }) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.lease");
  const tLease = useTranslations("admin.leases");
  const tIntent = useTranslations("client.portal.intent");
  const tCommon = useTranslations("common");
  const intents = useClientLeaseIntents();
  const [dialogType, setDialogType] = useState<LeaseIntentType | null>(null);

  const status = lease.status as LeaseStatusType;
  const leaseIntents = (intents.data?.items ?? []).filter((i) => i.leaseId === lease.id);
  const hasPending = leaseIntents.some((i) => i.status === "Pending");
  // Requests are only meaningful for a running lease and only one may be Pending at a time.
  const canRequest = status === "Active" && !hasPending && !intents.isLoading && !intents.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="LSE"
        title={lease.documentNumber}
        description={t("detailDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/client/lease">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            <Link href="/client/usage">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <Zap className="h-4 w-4" />
                <span>{t("viewUsage")}</span>
              </Button>
            </Link>
            <Button type="button" size="sm" disabled={!canRequest} onClick={() => setDialogType("Renew")} className="h-9 rounded-full px-4 gap-1.5 text-xs">
              <CalendarClock className="h-4 w-4" />
              <span>{tIntent("btnRequestRenew")}</span>
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!canRequest} onClick={() => setDialogType("MoveOut")} className="h-9 rounded-full px-4 gap-1.5 text-xs">
              <LogOut className="h-4 w-4" />
              <span>{tIntent("btnRequestMoveOut")}</span>
            </Button>
          </div>
        }
      />
      {hasPending && <p className="text-xs text-mute">{tIntent("pendingExistsHint")}</p>}

      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label={t("colStatus")}>
          <Badge variant={LEASE_STATUS_BADGE_VARIANT[status]}>{tLease(`status.${status}`)}</Badge>
        </DetailItem>
        <DetailItem label={t("colUnit")}>
          {lease.unit.unitNumber} ({resolveLocalizedText(lease.unit.buildingName, locale)})
        </DetailItem>
        <DetailItem label={t("colPeriod")}>
          <span className="font-mono text-xs tabular-nums">
            {lease.startDate} - {lease.endDate}
          </span>
        </DetailItem>
        <DetailItem label={t("colRent")}>{formatCurrencyThb(lease.monthlyRentAmount)}</DetailItem>
        <DetailItem label={t("securityDeposit")}>{formatCurrencyThb(lease.securityDepositAmount)}</DetailItem>
        <DetailItem label={t("depositBalance")}>{formatCurrencyThb(lease.securityDepositBalance)}</DetailItem>
        {lease.cancelReason != null && <DetailItem label={t("cancelReason")}>{lease.cancelReason}</DetailItem>}
      </div>

      <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("occupants")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colNationality")}</TableHead>
              <TableHead>{t("colIdentity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lease.occupants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-mute">
                  {t("noOccupants")}
                </TableCell>
              </TableRow>
            ) : (
              lease.occupants.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-xs">
                    {o.fullName}
                    {o.isPrimaryOccupant && <Badge variant="outline" className="ml-2 text-[10px]">{t("primary")}</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{o.nationalityCode}</TableCell>
                  <TableCell className="font-mono text-xs">{o.maskedIdentityNumber}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("vehicles")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colPlate")}</TableHead>
              <TableHead>{t("colProvince")}</TableHead>
              <TableHead>{t("colModel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lease.vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-mute">
                  {t("noVehicles")}
                </TableCell>
              </TableRow>
            ) : (
              lease.vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.licensePlate}</TableCell>
                  <TableCell className="text-xs">{v.province}</TableCell>
                  <TableCell className="text-xs">{v.vehicleBrandModel}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">{tIntent("listTitle")}</h3>
        <LeaseIntentsTable
          intents={leaseIntents}
          isLoading={intents.isLoading}
          isError={intents.isError}
          onRetry={() => void intents.refetch()}
        />
      </div>

      <LeaseIntentDialog
        open={dialogType !== null}
        onOpenChange={(o) => !o && setDialogType(null)}
        leaseId={lease.id}
        leaseDocumentNumber={lease.documentNumber}
        defaultType={dialogType ?? "Renew"}
      />
    </div>
  );
}
