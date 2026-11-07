"use client";

import React, { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FilePlus2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Tooltip } from "@/components/ui/tooltip";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { FormField } from "@/components/forms/form-field";
import { PeriodInput, PERIOD_PATTERN, getCurrentPeriod } from "@/components/forms/period-input";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import {
  useAdminInvoices,
  useRunBatchInvoicesMutation,
  useIssueInvoicesForPeriodMutation,
  useIssueInvoiceMutation,
  useDeleteInvoiceMutation,
} from "../api/use-billing";
import {
  INVOICE_STATUS_OPTIONS,
  INVOICE_STATUS_BADGE_VARIANT,
  BILLING_SKIP_REASON_KEYS,
  BILLING_SKIP_UNKNOWN_KEY,
  PERMISSION_BILLING_ISSUE_BATCH,
} from "../constants";
import type { BatchInvoiceRunResponse, InvoiceItemDto, InvoiceStatusType } from "../types";

export function BillingSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.billing");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canBill = hasPermission(PERMISSION_BILLING_ISSUE_BATCH);

  const [period, setPeriod] = useState(getCurrentPeriod);
  const [status, setStatus] = useState<InvoiceStatusType | "">("");
  const [runResult, setRunResult] = useState<BatchInvoiceRunResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceItemDto | null>(null);
  const [showIssueAll, setShowIssueAll] = useState(false);

  const isPeriodValid = PERIOD_PATTERN.test(period);
  const { data, isLoading, isError, refetch } = useAdminInvoices(
    activeProperty.id,
    period,
    status || undefined,
    canBill && isPeriodValid
  );
  const items = useMemo(() => data?.items ?? [], [data]);

  const runMutation = useRunBatchInvoicesMutation(activeProperty.id);
  const issueAllMutation = useIssueInvoicesForPeriodMutation(activeProperty.id);
  const issueMutation = useIssueInvoiceMutation(activeProperty.id);
  const deleteMutation = useDeleteInvoiceMutation(activeProperty.id);
  const isBusy =
    runMutation.isPending || issueAllMutation.isPending || issueMutation.isPending || deleteMutation.isPending;

  const handleRun = async () => {
    if (isBusy || !isPeriodValid) return;
    try {
      const res = await runMutation.mutateAsync({ period });
      setRunResult(res);
      toastSuccess(t("toastRunDone"));
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleIssue = async (invoiceId: string) => {
    if (isBusy) return;
    try {
      await issueMutation.mutateAsync(invoiceId);
      toastSuccess(t("toastIssued"));
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleIssueAll = async () => {
    if (isBusy) return;
    try {
      const res = await issueAllMutation.mutateAsync(period);
      toastSuccess(t("toastIssuedAll", { count: res.issued.length }));
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowIssueAll(false);
    }
  };

  const handleDelete = async () => {
    if (isBusy || !deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toastSuccess(t("toastDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const skipLabel = (code: string) => t(`skipReasons.${BILLING_SKIP_REASON_KEYS[code] ?? BILLING_SKIP_UNKNOWN_KEY}`);
  const draftCount = items.filter((i) => i.status === "Draft").length;

  const columns: ColumnDef<InvoiceItemDto>[] = [
    {
      id: "documentNumber",
      header: t("colDocument"),
      cell: (i) => <span className="font-mono text-xs">{i.documentNumber}</span>,
    },
    {
      id: "tenant",
      header: t("colTenant"),
      cell: (i) => <span className="text-xs text-ink">{i.customer.fullName}</span>,
    },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (i) =>
        i.unit ? (
          <span className="text-xs">
            {i.unit.unitNumber} ({resolveLocalizedText(i.unit.buildingName, locale)})
          </span>
        ) : (
          <span className="text-mute">-</span>
        ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (i) => (
        <Badge variant={INVOICE_STATUS_BADGE_VARIANT[i.status as InvoiceStatusType]}>
          {t(`status.${i.status}`)}
        </Badge>
      ),
    },
    {
      id: "total",
      header: t("colTotal"),
      align: "right",
      cell: (i) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(i.totalAmount)}</span>,
    },
    {
      id: "actions",
      header: <span className="sr-only">{tCommon("actions")}</span>,
      align: "right",
      cell: (i) =>
        i.status === "Draft" ? (
          <div className="flex items-center justify-end gap-1.5">
            <Tooltip content={t("btnIssue")} position="top">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={`${t("btnIssue")} ${i.documentNumber}`}
                disabled={isBusy}
                onClick={() => void handleIssue(i.id)}
                className="h-9 w-9 rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content={t("btnDelete")} position="top">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={`${t("btnDelete")} ${i.documentNumber}`}
                disabled={isBusy}
                onClick={() => setDeleteTarget(i)}
                className="h-9 w-9 rounded-full"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        ) : null,
    },
  ];

  if (!canBill) {
    return (
      <div className="space-y-6">
        <PageHeader prefixCode="INV" title={t("title")} description={t("description")} />
        <EmptyState title={t("noPermission")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="INV" title={t("title")} description={t("description")} />

      <div className="grid grid-cols-1 gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none sm:grid-cols-[200px_220px_1fr] sm:items-end">
        <FormField id="billing-period" label={t("fieldPeriod")}>
          <PeriodInput
            id="billing-period"
            value={period}
            onValueChange={(v) => {
              setPeriod(v);
              setRunResult(null);
            }}
            placeholder={t("fieldPeriod")}
            wrapperClassName="!mb-0"
          />
        </FormField>
        <FormField id="billing-status" label={t("colStatus")}>
          <SelectPill
            id="billing-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as InvoiceStatusType | "")}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allStatuses")}</option>
            {INVOICE_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </SelectPill>
        </FormField>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBusy || !isPeriodValid || draftCount === 0}
            onClick={() => setShowIssueAll(true)}
            className="h-10 rounded-full px-4 gap-1.5 text-xs"
          >
            <Send className="h-4 w-4" />
            <span>{t("btnIssueAll")}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={isBusy || !isPeriodValid}
            onClick={() => void handleRun()}
            className="h-10 rounded-full px-5 gap-1.5 text-xs"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>{runMutation.isPending ? tCommon("loading") : t("btnRunBatch")}</span>
          </Button>
        </div>
      </div>

      {runResult && (
        <div
          data-testid="batch-run-result"
          className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none"
        >
          <h3 className="text-sm font-semibold text-ink">
            {t("runResultTitle", { created: runResult.created.length, skipped: runResult.skipped.length })}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-ink">{t("createdHeading")}</div>
              {runResult.created.length === 0 ? (
                <p className="text-xs text-mute">-</p>
              ) : (
                runResult.created.map((i) => (
                  <div key={i.id} className="flex justify-between text-xs">
                    <span className="font-mono">{i.documentNumber}</span>
                    <span className="font-mono tabular-nums">{formatCurrencyThb(i.totalAmount)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-ink">{t("skippedHeading")}</div>
              {runResult.skipped.length === 0 ? (
                <p className="text-xs text-mute">-</p>
              ) : (
                runResult.skipped.map((s) => (
                  <div key={s.leaseId} className="flex justify-between gap-2 text-xs">
                    <span className="font-mono">
                      {s.unit.unitNumber} / {s.leaseDocumentNumber}
                    </span>
                    <Badge variant="warning">{skipLabel(s.reasonCode)}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        getRowId={(i) => i.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />

      <ConfirmationModal
        isOpen={showIssueAll}
        onClose={() => setShowIssueAll(false)}
        onConfirm={handleIssueAll}
        title={t("confirmIssueAllTitle")}
        message={t("confirmIssueAllMessage", { period, count: draftCount })}
        confirmText={t("btnIssueAll")}
        variant="warning"
        isLoading={issueAllMutation.isPending}
      />
      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteMessage", { document: deleteTarget?.documentNumber ?? "" })}
        confirmText={t("btnDelete")}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
