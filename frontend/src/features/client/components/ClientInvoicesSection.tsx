"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { INVOICE_STATUS_BADGE_VARIANT } from "@/features/billing/constants";
import type { InvoiceStatusType } from "@/features/billing/types";
import { useClientInvoices, useClientAllSlips } from "../api/use-client-invoices";
import { CLIENT_INVOICE_STATUS_OPTIONS, SLIP_STATUS_BADGE_VARIANT } from "../constants";
import type { ClientInvoiceDto, ClientPaymentSlipDto, SlipStatusType } from "../types";

export function ClientInvoicesSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.invoices");
  const tBilling = useTranslations("admin.billing");
  const tSlip = useTranslations("client.portal.slip");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("invoices");
  const invoices = useClientInvoices(status || undefined);
  const slips = useClientAllSlips(tab === "slips");

  const invoiceColumns: ColumnDef<ClientInvoiceDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (r) => <span className="font-mono text-xs">{r.invoice.documentNumber}</span> },
    { id: "period", header: t("colPeriod"), cell: (r) => <span className="font-mono text-xs">{r.invoice.billingPeriodYearMonth ?? "-"}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (r) => (
        <Badge variant={INVOICE_STATUS_BADGE_VARIANT[r.invoice.status as InvoiceStatusType]}>
          {tBilling(`status.${r.invoice.status}`)}
        </Badge>
      ),
    },
    { id: "total", header: t("colTotal"), align: "right", cell: (r) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(r.invoice.totalAmount)}</span> },
    { id: "paid", header: t("colPaid"), align: "right", cell: (r) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(r.paidAmount)}</span> },
    { id: "outstanding", header: t("colOutstanding"), align: "right", cell: (r) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(r.outstandingAmount)}</span> },
  ];

  const slipColumns: ColumnDef<ClientPaymentSlipDto>[] = [
    { id: "invoice", header: t("colDocument"), cell: (s) => <span className="font-mono text-xs">{s.invoiceDocumentNumber}</span> },
    { id: "amount", header: t("colTotal"), align: "right", cell: (s) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(s.amount)}</span> },
    { id: "transferred", header: tSlip("colTransferredAt"), cell: (s) => <span className="text-xs">{s.transferredAt ? formatDateTime(s.transferredAt, locale) : "-"}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (s) => (
        <div className="space-y-0.5">
          <Badge variant={SLIP_STATUS_BADGE_VARIANT[s.status as SlipStatusType]}>{tSlip(`status.${s.status}`)}</Badge>
          {s.status === "Rejected" && <div className="text-[11px] text-destructive">{s.rejectReason ?? "-"}</div>}
        </div>
      ),
    },
    { id: "submitted", header: tSlip("colSubmittedAt"), cell: (s) => <span className="text-xs">{formatDateTime(s.submittedAt, locale)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="INV" title={t("title")} description={t("description")} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="invoices">{t("tabInvoices")}</TabsTrigger>
          <TabsTrigger value="slips">{t("tabSlips")}</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
            <h3 className="text-sm font-semibold text-ink">{t("listTitle")}</h3>
            <div className="w-48">
              <SelectPill aria-label={t("colStatus")} value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="!mb-0">
                <option value="">{t("allStatuses")}</option>
                {CLIENT_INVOICE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {tBilling(`status.${s}`)}
                  </option>
                ))}
              </SelectPill>
            </div>
          </div>
          <DataTable
            columns={invoiceColumns}
            data={invoices.data?.items ?? []}
            getRowId={(r) => r.invoice.id}
            isLoading={invoices.isLoading}
            isError={invoices.isError}
            errorMessage={t("loadError")}
            onRetry={() => void invoices.refetch()}
            emptyTitle={t("emptyTitle")}
            emptyDescription={t("emptyDescription")}
            onRowClick={(r) => router.push(`/client/invoices/${r.invoice.id}`)}
          />
        </TabsContent>
        <TabsContent value="slips">
          <DataTable
            columns={slipColumns}
            data={slips.data?.items ?? []}
            getRowId={(s) => s.id}
            isLoading={slips.isLoading}
            isError={slips.isError}
            errorMessage={t("slipsLoadError")}
            onRetry={() => void slips.refetch()}
            emptyTitle={t("slipsEmptyTitle")}
            emptyDescription={t("slipsEmptyDescription")}
            onRowClick={(s) => router.push(`/client/invoices/${s.invoiceId}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
