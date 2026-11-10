"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { useRegulatoryExportQuery } from "../api/use-stays";
import { PERMISSION_REGULATORY_EXPORT, PERMISSION_UNMASK_PII } from "../constants";
import type { RegulatoryReportType } from "../types";

export interface RegulatoryExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

/** RR4 / TM30 export from the real endpoint; unmasking PII needs permission and an explicit confirmation. */
export function RegulatoryExportDialog({ open, onOpenChange, propertyId }: RegulatoryExportDialogProps) {
  const t = useTranslations("admin.stays");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastError } = useToast();
  const canExport = hasPermission(PERMISSION_REGULATORY_EXPORT);
  const canUnmask = hasPermission(PERMISSION_UNMASK_PII);
  const [reportType, setReportType] = useState<RegulatoryReportType>("RR4");
  const [unmask, setUnmask] = useState(false);
  const [showUnmaskConfirm, setShowUnmaskConfirm] = useState(false);

  const query = useRegulatoryExportQuery(propertyId, open && canExport ? { reportType, unmaskPii: unmask } : null);
  const rows = query.data?.rows ?? [];

  const close = (o: boolean) => {
    if (!o) setUnmask(false);
    onOpenChange(o);
  };

  const copyCsv = async () => {
    if (!query.data) return;
    try {
      await navigator.clipboard.writeText(query.data.csvContent);
      toastSuccess(t("csvCopied"));
    } catch {
      toastError(t("csvCopyFailed"));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("modalTitleRegulatory")}</DialogTitle>
            <DialogDescription>{t("modalDescRegulatory")}</DialogDescription>
          </DialogHeader>
          {!canExport ? (
            <EmptyState title={t("regulatoryNoPermission")} />
          ) : (
            <div className="space-y-3">
              <Tabs value={reportType} onValueChange={(v) => setReportType(v as RegulatoryReportType)}>
                <TabsList>
                  <TabsTrigger value="RR4">{t("tabRR4")}</TabsTrigger>
                  <TabsTrigger value="TM30">{t("tabTM30")}</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-body">{unmask ? t("unmaskedPiiNotice") : t("maskedPiiNotice")}</p>
                <div className="flex gap-2">
                  {canUnmask && (
                    <Button type="button" size="sm" variant="outline" onClick={() => (unmask ? setUnmask(false) : setShowUnmaskConfirm(true))} className="h-9 rounded-full px-4 text-xs">
                      {unmask ? t("btnMaskPii") : t("unmaskPiiButton")}
                    </Button>
                  )}
                  <Button type="button" size="sm" disabled={!query.data} onClick={() => void copyCsv()} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                    <Copy className="h-4 w-4" />
                    <span>{t("copyCsv")}</span>
                  </Button>
                </div>
              </div>
              {query.isLoading && <MonoSpinner label={tCommon("loading")} />}
              {query.isError && <EmptyState title={t("regulatoryLoadError")} actionLabel={tCommon("retry")} onAction={() => void query.refetch()} />}
              {query.data && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("colDocUnit")}</TableHead>
                      <TableHead>{t("fieldPrimaryGuestName")}</TableHead>
                      <TableHead>{t("fieldNationality")}</TableHead>
                      <TableHead>{t("fieldIdentityNumber")}</TableHead>
                      <TableHead>{t("colCheckInAt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-mute">
                          {t("regulatoryEmpty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.occupantId}>
                          <TableCell className="font-mono text-xs">{r.sourceDocumentNumber} / {r.unitNumber}</TableCell>
                          <TableCell className="text-xs">{r.fullName}</TableCell>
                          <TableCell className="text-xs">{r.nationalityCode}</TableCell>
                          <TableCell className="font-mono text-xs" data-testid="regulatory-identity">{r.identityNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{r.checkInAt.slice(0, 16).replace("T", " ")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={showUnmaskConfirm}
        onClose={() => setShowUnmaskConfirm(false)}
        onConfirm={() => {
          setUnmask(true);
          setShowUnmaskConfirm(false);
        }}
        title={t("confirmUnmaskTitle")}
        message={t("confirmUnmaskMessage")}
        confirmText={t("confirmUnmaskBtn")}
        variant="danger"
      />
    </>
  );
}
