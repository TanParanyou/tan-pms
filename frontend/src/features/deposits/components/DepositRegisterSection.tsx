"use client";

import React, { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { KpiSummaryStrip } from "@/components/layout/kpi-summary-strip";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { PageLoading } from "@/components/ui/mono-spinner";
import { useAdminDepositLedgers, useAdminDepositLedger } from "../api/use-deposits";
import { DEPOSIT_TYPE_OPTIONS } from "../constants";
import type { DepositLedgerItemDto, DepositTypeValue } from "../types";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function DepositRegisterSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.deposits");
  const tStays = useTranslations("admin.stays");
  const { activeProperty } = useAdminWorkspace();
  const [type, setType] = useState<DepositTypeValue | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pg = useServerPagination([type]);
  const { data, isLoading, isError, refetch } = useAdminDepositLedgers(activeProperty.id, type || undefined, pg.paging);
  const items = useMemo(() => data?.items ?? [], [data]);

  // Expanded ledger is fetched through the single-ledger endpoint.
  const { data: detail, isLoading: isDetailLoading } = useAdminDepositLedger(activeProperty.id, expandedId);

  const columns: ColumnDef<DepositLedgerItemDto>[] = [
    {
      id: "expand",
      header: <span className="sr-only">{t("colTransactions")}</span>,
      cell: (d) => (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`${t("colTransactions")} ${d.ownerDocumentNumber ?? ""}`}
          aria-expanded={expandedId === d.id}
          onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
          className="h-8 w-8 rounded-full"
        >
          {expandedId === d.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      ),
    },
    {
      id: "type",
      header: t("colType"),
      cell: (d) => <Badge variant="secondary">{t(`types.${d.depositType}`)}</Badge>,
    },
    {
      id: "owner",
      header: t("colOwnerDoc"),
      cell: (d) => <span className="font-mono text-xs">{d.ownerDocumentNumber ?? "-"}</span>,
    },
    {
      id: "customer",
      header: t("colCustomer"),
      cell: (d) => (
        <div className="space-y-0.5">
          <div className="text-xs text-ink">{d.customer.fullName}</div>
          <div className="font-mono text-[11px] text-mute">{d.customer.maskedNationalId}</div>
        </div>
      ),
    },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (d) =>
        d.unit ? (
          <span className="text-xs">{d.unit.unitNumber} ({resolveLocalizedText(d.unit.buildingName, locale)})</span>
        ) : (
          <span className="text-mute">-</span>
        ),
    },
    {
      id: "balance",
      header: t("colBalance"),
      align: "right",
      cell: (d) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(d.currentBalance)}</span>,
    },
  ];

  const expanded = detail ? [detail] : [];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="DEP" title={t("title")} description={t("description")} />
      <KpiSummaryStrip
        items={[
          {
            id: "held",
            label: t("kpiHeldBalance"),
            value: data ? formatCurrencyThb(data.totalHeldBalance) : "-",
            badge: <Badge variant="outline">{t("notRevenue")}</Badge>,
          },
          { id: "count", label: t("kpiLedgers"), value: items.length },
        ]}
      />
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <div className="space-y-1">
          <p className="text-xs text-body">{t("heldFundsNote")}</p>
          <p data-testid="deposit-readonly-hint" className="text-[11px] text-mute">{t("readOnlyHint")}</p>
        </div>
        <div className="w-56 shrink-0">
          <SelectPill
            aria-label={t("colType")}
            value={type}
            onChange={(e) => setType(e.target.value as DepositTypeValue | "")}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allTypes")}</option>
            {DEPOSIT_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {t(`types.${o}`)}
              </option>
            ))}
          </SelectPill>
        </div>
      </div>
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={items}
        getRowId={(d) => d.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
      {expandedId !== null && isDetailLoading && <PageLoading message={t("loadingLedger")} />}
      {expanded.map((d) => (
        <div key={d.id} data-testid="deposit-transactions" className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
          <h3 className="text-sm font-semibold text-ink">
            {t("colTransactions")}: {d.ownerDocumentNumber ?? "-"}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("txDocument")}</TableHead>
                <TableHead>{t("txType")}</TableHead>
                <TableHead>{t("txAmount")}</TableHead>
                <TableHead>{t("txPaymentMethod")}</TableHead>
                <TableHead>{t("txReason")}</TableHead>
                <TableHead>{t("txDate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-mute">
                    {t("noTransactions")}
                  </TableCell>
                </TableRow>
              ) : (
                d.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs">{tx.documentNumber}</TableCell>
                    <TableCell>{t(`txTypes.${tx.transactionType}`)}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{formatCurrencyThb(tx.amount)}</TableCell>
                    <TableCell data-testid="tx-payment-method">{tx.paymentMethod ? tStays(`method${tx.paymentMethod}`) : "-"}</TableCell>
                    <TableCell>{tx.reason ?? "-"}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(tx.createdAt, locale)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
