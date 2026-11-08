"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { useBlobDownload } from "@/hooks/use-blob-download";
import { apiClient } from "@/lib/api/api-client";
import { formatCurrencyThb } from "@/lib/formatters";
import { useAdminReceipts } from "../api/use-billing";

export interface InvoiceReceiptsListProps {
  propertyId: string;
  invoiceId: string;
}

export function InvoiceReceiptsList({ propertyId, invoiceId }: InvoiceReceiptsListProps) {
  const t = useTranslations("admin.billing");
  const { data, isLoading, isError } = useAdminReceipts(propertyId, invoiceId);
  const { download, isDownloading } = useBlobDownload();
  const items = data?.items ?? [];

  return (
    <div className="space-y-2" data-testid="invoice-receipts">
      <h3 className="text-sm font-semibold text-ink">{t("sectionReceipts")}</h3>
      {isLoading && <MonoSpinner size="sm" label={t("loadingReceipts")} />}
      {isError && <p className="text-xs text-destructive">{t("receiptsLoadError")}</p>}
      {!isLoading && !isError && items.length === 0 && <p className="text-xs text-mute">{t("noReceipts")}</p>}
      {items.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 rounded-full border border-hairline bg-surface-soft px-4 py-1.5">
          <span className="font-mono text-xs text-ink">{r.documentNumber}</span>
          <span className="font-mono text-xs tabular-nums text-body">{formatCurrencyThb(r.netPayableAmount)}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isDownloading}
            onClick={() => void download(() => apiClient.downloadAdminReceiptPdf(propertyId, r.id), `${r.documentNumber}.pdf`, "open")}
            className="h-8 rounded-full px-3 gap-1.5 text-xs"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>{t("btnDownloadReceipt")}</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
