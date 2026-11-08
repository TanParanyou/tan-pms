"use client";

import React, { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Ban, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/ui/mono-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import { useAdminInvoice, useDeleteInvoiceLineMutation, useVoidInvoiceMutation } from "../api/use-billing";
import {
  INVOICE_STATUS_BADGE_VARIANT,
  INVOICE_VOIDABLE_STATUSES,
  PERMISSION_BILLING_ISSUE_BATCH,
  PERMISSION_INVOICES_VOID,
} from "../constants";
import type { InvoiceLineDto, InvoiceStatusType } from "../types";
import { InvoiceLineDialog } from "./InvoiceLineDialog";

export interface InvoiceDetailSheetProps {
  propertyId: string;
  invoiceId: string | null;
  onClose: () => void;
}

export function InvoiceDetailSheet({ propertyId, invoiceId, onClose }: InvoiceDetailSheetProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.billing");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canEdit = hasPermission(PERMISSION_BILLING_ISSUE_BATCH);
  const canVoid = hasPermission(PERMISSION_INVOICES_VOID);

  const { data: invoice, isLoading, isError, refetch } = useAdminInvoice(propertyId, invoiceId);
  const deleteLine = useDeleteInvoiceLineMutation(propertyId);
  const voidInvoice = useVoidInvoiceMutation(propertyId);
  const inFlight = useRef(false);
  const [lineDialog, setLineDialog] = useState<{ line: InvoiceLineDto | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceLineDto | null>(null);
  const [showVoid, setShowVoid] = useState(false);

  const status = invoice?.status as InvoiceStatusType | undefined;
  const isDraft = status === "Draft";
  const isBusy = deleteLine.isPending || voidInvoice.isPending;

  const executeDeleteLine = async () => {
    if (!invoice || !deleteTarget || isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await deleteLine.mutateAsync({ invoiceId: invoice.id, lineId: deleteTarget.id });
      toastSuccess(t("toastLineDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setDeleteTarget(null);
    }
  };

  const executeVoid = async (reason: string): Promise<boolean> => {
    if (!invoice) return false;
    try {
      await voidInvoice.mutateAsync({ invoiceId: invoice.id, reason });
      toastSuccess(t("toastVoided"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  return (
    <Sheet open={invoiceId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t("detailTitle")}</SheetTitle>
          <SheetDescription>{invoice?.documentNumber}</SheetDescription>
        </SheetHeader>
        {isLoading && <PageLoading message={t("loadingInvoice")} />}
        {isError && <EmptyState title={t("loadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />}
        {invoice && status && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[11px] text-mute">{t("colStatus")}</div>
                <Badge variant={INVOICE_STATUS_BADGE_VARIANT[status]}>{t(`status.${status}`)}</Badge>
              </div>
              <div>
                <div className="text-[11px] text-mute">{t("colTenant")}</div>
                <div className="text-ink">{invoice.customer.fullName}</div>
              </div>
              <div>
                <div className="text-[11px] text-mute">{t("colUnit")}</div>
                <div className="text-ink">
                  {invoice.unit ? `${invoice.unit.unitNumber} (${resolveLocalizedText(invoice.unit.buildingName, locale)})` : "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-mute">{t("colTotal")}</div>
                <div className="font-mono tabular-nums text-ink" data-testid="invoice-total">
                  {formatCurrencyThb(invoice.totalAmount)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("sectionLines")}</h3>
              {canEdit && isDraft && (
                <Button type="button" size="sm" disabled={isBusy} onClick={() => setLineDialog({ line: null })} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                  <Plus className="h-4 w-4" />
                  <span>{t("btnAddLine")}</span>
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDescription")}</TableHead>
                  <TableHead>{t("fieldTaxMode")}</TableHead>
                  <TableHead className="text-right">{t("colNet")}</TableHead>
                  <TableHead className="w-20 text-right">
                    <span className="sr-only">{tCommon("actions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-mute">
                      {t("noLines")}
                    </TableCell>
                  </TableRow>
                ) : (
                  invoice.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{resolveLocalizedText(l.description, locale)}</TableCell>
                      <TableCell className="text-xs">{t(`taxMode.${l.taxMode}`)}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{formatCurrencyThb(l.netAmount)}</TableCell>
                      <TableCell className="text-right">
                        {canEdit && isDraft && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("edit")} aria-label={`${tCommon("edit")} ${resolveLocalizedText(l.description, locale)}`} onClick={() => setLineDialog({ line: l })} className="h-8 w-8 rounded-full">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="outline" disabled={isBusy} title={tCommon("delete")} aria-label={`${tCommon("delete")} ${resolveLocalizedText(l.description, locale)}`} onClick={() => setDeleteTarget(l)} className="h-8 w-8 rounded-full">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {!isDraft && <p className="text-[11px] text-mute">{t("linesLockedHint")}</p>}

            {canVoid && INVOICE_VOIDABLE_STATUSES.includes(status) && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" disabled={isBusy} onClick={() => setShowVoid(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                  <Ban className="h-4 w-4" />
                  <span>{t("btnVoid")}</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {invoice && (
          <>
            <InvoiceLineDialog
              open={lineDialog !== null}
              onOpenChange={(o) => !o && setLineDialog(null)}
              propertyId={propertyId}
              invoiceId={invoice.id}
              line={lineDialog?.line ?? null}
            />
            <ConfirmationModal
              isOpen={deleteTarget !== null}
              onClose={() => setDeleteTarget(null)}
              onConfirm={executeDeleteLine}
              title={t("confirmDeleteLineTitle")}
              message={t("confirmDeleteLineMessage")}
              confirmText={tCommon("delete")}
              variant="danger"
              isLoading={deleteLine.isPending}
            />
            <ReasonDialog
              open={showVoid}
              onOpenChange={setShowVoid}
              title={t("voidTitle")}
              description={t("voidDescription")}
              actionText={t("btnVoid")}
              confirmTitle={t("confirmVoidTitle")}
              confirmMessage={t("confirmVoidMessage", { document: invoice.documentNumber })}
              isLoading={voidInvoice.isPending}
              onConfirm={executeVoid}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
