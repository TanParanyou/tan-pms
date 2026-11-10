"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBlobDownload } from "@/hooks/use-blob-download";
import { apiClient } from "@/lib/api/api-client";
import type { ReceiptItemDto } from "@/features/files/types";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { INVOICE_STATUS_BADGE_VARIANT } from "@/features/billing/constants";
import type { InvoiceStatusType } from "@/features/billing/types";
import { useClientInvoices, useClientAllSlips, useClientReceipts } from "../api/use-client-invoices";
import { CLIENT_INVOICE_STATUS_OPTIONS, SLIP_STATUS_BADGE_VARIANT } from "../constants";
import type { ClientInvoiceDto, ClientPaymentSlipDto, SlipStatusType } from "../types";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { InvoiceDueInfo } from "@/components/shared/invoice-due-info";

export function ClientInvoicesSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.invoices");
  const tBilling = useTranslations("admin.billing");
  const tSlip = useTranslations("client.portal.slip");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState("invoices");
  const pg = useServerPagination([status]);
  const invoices = useClientInvoices(status || undefined, pg.paging);
  const pgSlips = useServerPagination([]);
  const slips = useClientAllSlips(tab === "slips", pgSlips.paging);
  const receipts = useClientReceipts(tab === "receipts");
  const { download, isDownloading } = useBlobDownload();
  const receiptColumns: ColumnDef<ReceiptItemDto>[] = [
    { id: "doc", header: t("colDocument"), cell: (r) => <span className="font-mono text-xs">{r.documentNumber}</span> },
    { id: "invoice", header: t("colInvoice"), cell: (r) => <span className="font-mono text-xs">{r.invoiceDocumentNumber ?? "-"}</span> },
    { id: "stay", header: t("colStay"), cell: (r) => <span className="font-mono text-xs">{r.stayDocumentNumber ?? "-"}</span> },
    { id: "amount", header: t("colTotal"), align: "right", cell: (r) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(r.netPayableAmount)}</span> },
    { id: "issued", header: t("colIssuedAt"), cell: (r) => <span className="text-xs">{formatDateTime(r.issuedAt, locale)}</span> },
    {
      id: "pdf",
      header: <span className="sr-only">{t("btnDownloadReceipt")}</span>,
      align: "right",
      cell: (r) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isDownloading}
          onClick={() => void download(() => apiClient.downloadClientReceiptPdf(r.id), `${r.documentNumber}.pdf`, "open")}
          className="h-8 gap-1.5 rounded-full px-3 text-xs"
        >
          <FileDown className="h-3.5 w-3.5" />
          <span>{t("btnDownloadReceipt")}</span>
        </Button>
      ),
    },
  ];

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
    { id: "dueDate", header: t("colDueDate"), cell: (r) => <InvoiceDueInfo status={r.invoice.status} dueDate={r.invoice.dueDate} /> },
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
          <TabsTrigger value="receipts">{t("tabReceipts")}</TabsTrigger>
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
        {...pg.tableProps(invoices.data?.pagination)}
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
        {...pgSlips.tableProps(slips.data?.pagination)}
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
        <TabsContent value="receipts">
          <DataTable
            columns={receiptColumns}
            data={receipts.data?.items ?? []}
            getRowId={(r) => r.id}
            isLoading={receipts.isLoading}
            isError={receipts.isError}
            errorMessage={t("receiptsLoadError")}
            onRetry={() => void receipts.refetch()}
            emptyTitle={t("receiptsEmptyTitle")}
            emptyDescription={t("receiptsEmptyDescription")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
