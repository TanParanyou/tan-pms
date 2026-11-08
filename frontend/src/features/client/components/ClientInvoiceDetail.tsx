"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, FileDown, Pencil, Receipt, Undo2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { useBlobDownload } from "@/hooks/use-blob-download";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api/api-client";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { INVOICE_STATUS_BADGE_VARIANT } from "@/features/billing/constants";
import type { InvoiceStatusType } from "@/features/billing/types";
import { useClientInvoice, useWithdrawSlipMutation } from "../api/use-client-invoices";
import { SLIP_STATUS_BADGE_VARIANT } from "../constants";
import type { ClientInvoiceDto, ClientPaymentSlipDto, SlipStatusType } from "../types";
import { SlipDialog } from "./SlipDialog";

/** Statuses that still accept payment slips. */
const PAYABLE_STATUSES: readonly string[] = ["Issued", "PartiallyPaid", "Overdue"];

export function ClientInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("client.portal.invoices");
  const tCommon = useTranslations("common");
  const { data, isLoading, isError, refetch } = useClientInvoice(invoiceId);

  if (isLoading) return <PageLoading message={tCommon("loading")} />;
  if (isError) return <EmptyState title={t("detailLoadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />;
  if (!data) return <EmptyState title={t("notFound")} />;
  return <InvoiceBody dto={data} />;
}

function InvoiceBody({ dto }: { dto: ClientInvoiceDto }) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.invoices");
  const tSlip = useTranslations("client.portal.slip");
  const tBilling = useTranslations("admin.billing");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const { download, isDownloading } = useBlobDownload();
  const withdrawMutation = useWithdrawSlipMutation();
  const [slipDialog, setSlipDialog] = useState<{ slip: ClientPaymentSlipDto | null } | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ClientPaymentSlipDto | null>(null);

  const { invoice } = dto;
  const status = invoice.status as InvoiceStatusType;
  const hasPendingSlip = dto.slips.some((s) => s.status === "Pending");
  const canSubmitSlip = PAYABLE_STATUSES.includes(invoice.status) && dto.outstandingAmount > 0 && !hasPendingSlip;

  const executeWithdraw = async () => {
    if (!withdrawTarget || withdrawMutation.isPending) return;
    try {
      await withdrawMutation.mutateAsync({ invoiceId: invoice.id, slipId: withdrawTarget.id });
      toastSuccess(tSlip("toastWithdrawn"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setWithdrawTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="INV"
        title={invoice.documentNumber}
        description={t("detailDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/client/invoices">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              disabled={!canSubmitSlip}
              onClick={() => setSlipDialog({ slip: null })}
              className="h-9 rounded-full px-4 gap-1.5 text-xs"
            >
              <Receipt className="h-4 w-4" />
              <span>{tSlip("btnSubmitSlip")}</span>
            </Button>
          </div>
        }
      />
      {hasPendingSlip && <p className="text-xs text-mute">{tSlip("pendingExistsHint")}</p>}

      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label={t("colStatus")}>
          <Badge variant={INVOICE_STATUS_BADGE_VARIANT[status]}>{tBilling(`status.${status}`)}</Badge>
        </DetailItem>
        <DetailItem label={t("colPeriod")}>{invoice.billingPeriodYearMonth ?? "-"}</DetailItem>
        <DetailItem label={t("colTotal")}>{formatCurrencyThb(invoice.totalAmount)}</DetailItem>
        <DetailItem label={t("colPaid")}>{formatCurrencyThb(dto.paidAmount)}</DetailItem>
        <DetailItem label={t("colOutstanding")}>
          <span data-testid="invoice-outstanding">{formatCurrencyThb(dto.outstandingAmount)}</span>
        </DetailItem>
        <DetailItem label={t("subTotal")}>{formatCurrencyThb(invoice.subTotal)}</DetailItem>
        <DetailItem label={t("vat")}>{formatCurrencyThb(invoice.totalVatAmount)}</DetailItem>
        {invoice.voidReason != null && <DetailItem label={t("voidReason")}>{invoice.voidReason}</DetailItem>}
      </div>

      <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("sectionLines")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colDescription")}</TableHead>
              <TableHead>{t("colTaxMode")}</TableHead>
              <TableHead className="text-right">{t("colNet")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-mute">
                  {t("noLines")}
                </TableCell>
              </TableRow>
            ) : (
              invoice.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{resolveLocalizedText(l.description, locale)}</TableCell>
                  <TableCell className="text-xs">{tBilling(`taxMode.${l.taxMode}`)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{formatCurrencyThb(l.netAmount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("sectionReceipts")}</h3>
        {dto.receipts.length === 0 && <p className="text-xs text-mute">{t("noReceipts")}</p>}
        {dto.receipts.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-full border border-hairline bg-surface-soft px-4 py-1.5">
            <span className="font-mono text-xs text-ink">{r.documentNumber}</span>
            <span className="font-mono text-xs tabular-nums text-body">{formatCurrencyThb(r.netPayableAmount)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isDownloading}
              onClick={() => void download(() => apiClient.downloadClientReceiptPdf(r.id), `${r.documentNumber}.pdf`, "open")}
              className="h-8 rounded-full px-3 gap-1.5 text-xs"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>{t("btnDownloadReceipt")}</span>
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{tSlip("sectionSlips")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tSlip("colAmount")}</TableHead>
              <TableHead>{tSlip("colTransferredAt")}</TableHead>
              <TableHead>{tSlip("colStatus")}</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">{tCommon("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dto.slips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-mute">
                  {tSlip("noSlips")}
                </TableCell>
              </TableRow>
            ) : (
              dto.slips.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs tabular-nums">{formatCurrencyThb(s.amount)}</TableCell>
                  <TableCell className="text-xs">{s.transferredAt ? formatDateTime(s.transferredAt, locale) : "-"}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Badge variant={SLIP_STATUS_BADGE_VARIANT[s.status as SlipStatusType]}>{tSlip(`status.${s.status}`)}</Badge>
                      {s.status === "Rejected" && (
                        <div className="text-[11px] text-destructive" data-testid="slip-reject-reason">
                          {tSlip("rejectReason")}: {s.rejectReason ?? "-"}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        title={tSlip("btnViewSlip")}
                        aria-label={`${tSlip("btnViewSlip")} ${formatCurrencyThb(s.amount)}`}
                        disabled={isDownloading}
                        onClick={() => void download(() => apiClient.downloadClientFile(s.slipFileKey), s.slipFileKey, "open")}
                        className="h-8 w-8 rounded-full"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {s.status === "Pending" && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title={tCommon("edit")}
                            aria-label={`${tCommon("edit")} ${formatCurrencyThb(s.amount)}`}
                            disabled={withdrawMutation.isPending}
                            onClick={() => setSlipDialog({ slip: s })}
                            className="h-8 w-8 rounded-full"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title={tSlip("btnWithdraw")}
                            aria-label={`${tSlip("btnWithdraw")} ${formatCurrencyThb(s.amount)}`}
                            disabled={withdrawMutation.isPending}
                            onClick={() => setWithdrawTarget(s)}
                            className="h-8 w-8 rounded-full"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SlipDialog
        open={slipDialog !== null}
        onOpenChange={(o) => !o && setSlipDialog(null)}
        invoiceId={invoice.id}
        invoiceDocumentNumber={invoice.documentNumber}
        outstanding={dto.outstandingAmount}
        slip={slipDialog?.slip ?? null}
      />
      <ConfirmationModal
        isOpen={withdrawTarget !== null}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={executeWithdraw}
        title={tSlip("confirmWithdrawTitle")}
        message={tSlip("confirmWithdrawMessage", { document: invoice.documentNumber })}
        confirmText={tSlip("btnWithdraw")}
        variant="warning"
        isLoading={withdrawMutation.isPending}
      />
    </div>
  );
}
