"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useBlobDownload } from "@/hooks/use-blob-download";
import { apiClient } from "@/lib/api/api-client";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { useStayReceipts } from "../api/use-stays";

export interface StayReceiptsPanelProps {
  propertyId: string;
  stayId: string;
}

/** Receipts issued for this stay's payments, each with a PDF download. */
export function StayReceiptsPanel({ propertyId, stayId }: StayReceiptsPanelProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.stays");
  const tCommon = useTranslations("common");
  const { data, isLoading, isError, refetch } = useStayReceipts(propertyId, stayId);
  const { download, isDownloading } = useBlobDownload();

  return (
    <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none" data-testid="stay-receipts">
      <h3 className="text-sm font-semibold text-ink">{t("sectionReceipts")}</h3>
      {isLoading && <MonoSpinner size="sm" label={tCommon("loading")} />}
      {isError && <EmptyState title={t("receiptsLoadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />}
      {data && data.length === 0 && <p className="text-xs text-mute">{t("noReceipts")}</p>}
      {(data ?? []).map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-hairline bg-surface-soft px-4 py-1.5">
          <span className="font-mono text-xs text-ink">{r.documentNumber}</span>
          <span className="font-mono text-[11px] text-mute">{r.invoiceDocumentNumber ?? "-"}</span>
          <span className="font-mono text-xs tabular-nums text-body">{formatCurrencyThb(r.netPayableAmount)}</span>
          <span className="text-[11px] text-mute">{r.paymentMethod ? t(`method${r.paymentMethod}`) : "-"}</span>
          <span className="text-[11px] text-mute">{formatDateTime(r.issuedAt, locale)}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isDownloading}
            onClick={() => void download(() => apiClient.downloadAdminReceiptPdf(propertyId, r.id), `${r.documentNumber}.pdf`, "open")}
            className="h-8 gap-1.5 rounded-full px-3 text-xs"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>{t("btnDownloadReceipt")}</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
