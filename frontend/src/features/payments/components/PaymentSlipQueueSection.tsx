"use client";

import React, { useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageLoading } from "@/components/ui/mono-spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { FormField } from "@/components/forms/form-field";
import { StoredFileViewer } from "@/components/shared/stored-file-viewer";
import { InvoiceReceiptsList } from "@/features/billing/components/InvoiceReceiptsList";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import {
  useAdminPaymentSlips,
  useAdminPaymentSlip,
  useApproveSlipMutation,
  useRejectSlipMutation,
} from "../api/use-payments";
import { rejectSlipSchema, type RejectSlipFormValues } from "../schemas/payment-schemas";
import {
  PERMISSION_VERIFY_SLIP,
  SLIP_STATUS_OPTIONS,
  DEFAULT_SLIP_STATUS,
  SLIP_STATUS_BADGE_VARIANT,
} from "../constants";
import type { AdminPaymentSlipDto, PaymentSlipStatusType } from "../types";
import { useServerPagination } from "@/hooks/use-server-pagination";
import { InvoiceDueInfo } from "@/components/shared/invoice-due-info";

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="break-all text-sm text-ink">{children}</div>
    </div>
  );
}

export function PaymentSlipQueueSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.payments");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canVerify = hasPermission(PERMISSION_VERIFY_SLIP);

  const [status, setStatus] = useState<PaymentSlipStatusType>(DEFAULT_SLIP_STATUS);
  const [selected, setSelected] = useState<AdminPaymentSlipDto | null>(null);
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const pg = useServerPagination([status]);
  const { data, isLoading, isError, refetch } = useAdminPaymentSlips(activeProperty.id, status, pg.paging);
  const items = useMemo(() => data?.items ?? [], [data]);
  // Detail sheet reads the single-slip endpoint rather than reusing the list row.
  const { data: slip, isLoading: isSlipLoading } = useAdminPaymentSlip(activeProperty.id, selected?.id ?? null);
  const approveMutation = useApproveSlipMutation(activeProperty.id);
  const rejectMutation = useRejectSlipMutation(activeProperty.id);
  const inFlight = useRef(false);
  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  const rejectForm = useForm<RejectSlipFormValues>({
    resolver: zodResolver(rejectSlipSchema),
    defaultValues: { reason: "" },
  });
  useUnsavedChanges(rejectForm.formState.isDirty);

  const executeApprove = async () => {
    if (isBusy || inFlight.current || !selected) return;
    inFlight.current = true;
    try {
      await approveMutation.mutateAsync(selected.id);
      toastSuccess(t("toastApproved"));
      setSelected(null);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowConfirmApprove(false);
    }
  };

  const executeReject = rejectForm.handleSubmit(async (values) => {
    if (isBusy || inFlight.current || !selected) return;
    inFlight.current = true;
    try {
      await rejectMutation.mutateAsync({ slipId: selected.id, reason: values.reason });
      toastSuccess(t("toastRejected"));
      rejectForm.reset({ reason: "" });
      setShowReject(false);
      setSelected(null);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const dash = <span className="text-mute">-</span>;

  const columns: ColumnDef<AdminPaymentSlipDto>[] = [
    { id: "invoice", header: t("colInvoice"), cell: (s) => <span className="font-mono text-xs">{s.invoiceDocumentNumber}</span> },
    {
      id: "customer",
      header: t("colCustomer"),
      cell: (s) => (
        <div className="space-y-0.5">
          <div className="text-xs text-ink">{s.customer.fullName}</div>
          <div className="font-mono text-[11px] text-mute">{s.customer.maskedNationalId}</div>
        </div>
      ),
    },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (s) => (s.unit ? <span className="text-xs">{s.unit.unitNumber} ({resolveLocalizedText(s.unit.buildingName, locale)})</span> : dash),
    },
    {
      id: "amount",
      header: t("colAmount"),
      align: "right",
      cell: (s) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(s.amount)}</span>,
    },
    {
      id: "outstanding",
      header: t("colOutstanding"),
      align: "right",
      cell: (s) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(s.invoiceOutstandingAmount)}</span>,
    },
    {
      id: "dueDate",
      header: t("colDueDate"),
      cell: (s) => <InvoiceDueInfo status={s.invoiceStatus} dueDate={s.invoiceDueDate} />,
    },
    {
      id: "transferredAt",
      header: t("colTransferredAt"),
      cell: (s) => <span className="text-xs">{s.transferredAt ? formatDateTime(s.transferredAt, locale) : "-"}</span>,
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (s) => (
        <Badge variant={SLIP_STATUS_BADGE_VARIANT[s.status as PaymentSlipStatusType]}>{t(`status.${s.status}`)}</Badge>
      ),
    },
  ];

  const isPending = slip?.status === "Pending";

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="RCT" title={t("title")} description={t("description")} />
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        {SLIP_STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
            className="h-8 rounded-full px-4 text-xs"
          >
            {t(`status.${s}`)}
          </Button>
        ))}
      </div>
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={items}
        getRowId={(s) => s.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        onRowClick={setSelected}
      />

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("detailTitle")}</SheetTitle>
            <SheetDescription>{selected?.invoiceDocumentNumber}</SheetDescription>
          </SheetHeader>
          {isSlipLoading && <PageLoading message={tCommon("loading")} />}
          {slip && (
            <div className="space-y-4 py-4">
              <DetailItem label={t("colStatus")}>
                <Badge variant={SLIP_STATUS_BADGE_VARIANT[slip.status as PaymentSlipStatusType]}>
                  {t(`status.${slip.status}`)}
                </Badge>
              </DetailItem>
              <DetailItem label={t("colAmount")}>{formatCurrencyThb(slip.amount)}</DetailItem>
              <DetailItem label={t("colOutstanding")}>{formatCurrencyThb(slip.invoiceOutstandingAmount)}</DetailItem>
              <DetailItem label={t("colDueDate")}>
                <InvoiceDueInfo status={slip.invoiceStatus} dueDate={slip.invoiceDueDate} />
              </DetailItem>
              <DetailItem label={t("transferReference")}>{slip.transferReference ?? "-"}</DetailItem>
              <DetailItem label={t("slipImage")}>
                <StoredFileViewer fileKey={slip.slipFileKey} />
              </DetailItem>
              <DetailItem label={t("submittedAt")}>{formatDateTime(slip.submittedAt, locale)}</DetailItem>
              {slip.status !== "Pending" && (
                <div data-testid="slip-review-info" className="space-y-3 rounded-[12px] bg-surface-soft p-3">
                  <DetailItem label={t("reviewedBy")}>{slip.reviewedBy?.fullName ?? "-"}</DetailItem>
                  <DetailItem label={t("reviewedAt")}>
                    {slip.reviewedAt ? formatDateTime(slip.reviewedAt, locale) : "-"}
                  </DetailItem>
                  <DetailItem label={t("rejectReason")}>{slip.rejectReason ?? "-"}</DetailItem>
                  <DetailItem label={t("receiptNo")}>{slip.receiptDocumentNumber ?? "-"}</DetailItem>
                </div>
              )}
            </div>
          )}
          {slip && slip.status === "Approved" && (
            <div className="pb-4">
              <InvoiceReceiptsList propertyId={activeProperty.id} invoiceId={slip.invoiceId} />
            </div>
          )}
          {canVerify && isPending && (
            <SheetFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setShowReject(true)}
                className="rounded-full gap-1.5"
              >
                <X className="h-4 w-4" />
                <span>{t("btnReject")}</span>
              </Button>
              <Button type="button" disabled={isBusy} onClick={() => setShowConfirmApprove(true)} className="rounded-full gap-1.5">
                <Check className="h-4 w-4" />
                <span>{t("btnApprove")}</span>
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectTitle")}</DialogTitle>
            <DialogDescription>{t("rejectDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={executeReject} className="space-y-4">
            <FormField id="reject-reason" label={t("rejectReason")} required error={rejectForm.formState.errors.reason?.message ? t("errorReasonRequired") : undefined}>
              <Textarea id="reject-reason" placeholder={t("placeholderRejectReason")} {...rejectForm.register("reason")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReject(false)} className="rounded-full">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={isBusy} className="rounded-full">
                {rejectMutation.isPending ? tCommon("loading") : t("btnReject")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={showConfirmApprove}
        onClose={() => setShowConfirmApprove(false)}
        onConfirm={executeApprove}
        title={t("confirmApproveTitle")}
        message={t("confirmApproveMessage")}
        confirmText={t("btnApprove")}
        variant="warning"
        isLoading={approveMutation.isPending}
      />
    </div>
  );
}
