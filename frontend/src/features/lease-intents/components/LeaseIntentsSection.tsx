"use client";

import React, { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";
import {
  LEASE_INTENT_STATUS_OPTIONS,
  DEFAULT_ADMIN_INTENT_STATUS,
  INTENT_STATUS_BADGE_VARIANT,
} from "@/features/client/constants";
import type { LeaseIntentDto, LeaseIntentStatusType } from "@/features/client/types";
import {
  useAdminLeaseIntents,
  useApproveLeaseIntentMutation,
  useRejectLeaseIntentMutation,
} from "../api/use-lease-intents";
import { PERMISSION_LEASE_INTENTS_MANAGE } from "../constants";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function LeaseIntentsSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.leaseIntents");
  const tIntent = useTranslations("client.portal.intent");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_LEASE_INTENTS_MANAGE);

  const [status, setStatus] = useState<LeaseIntentStatusType>(DEFAULT_ADMIN_INTENT_STATUS);
  const [approveTarget, setApproveTarget] = useState<LeaseIntentDto | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaseIntentDto | null>(null);
  const inFlight = useRef(false);

  const pg = useServerPagination([status]);
  const { data, isLoading, isError, refetch } = useAdminLeaseIntents(activeProperty.id, status, canManage, pg.paging);
  const approveMutation = useApproveLeaseIntentMutation(activeProperty.id);
  const rejectMutation = useRejectLeaseIntentMutation(activeProperty.id);
  const isBusy = approveMutation.isPending || rejectMutation.isPending;

  const executeApprove = async () => {
    if (!approveTarget || isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await approveMutation.mutateAsync(approveTarget.id);
      toastSuccess(t("toastApproved"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setApproveTarget(null);
    }
  };

  const executeReject = async (reason: string): Promise<boolean> => {
    if (!rejectTarget) return false;
    try {
      await rejectMutation.mutateAsync({ intentId: rejectTarget.id, reason });
      toastSuccess(t("toastRejected"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-4">
        <PageHeader prefixCode="LSE" title={t("title")} description={t("description")} />
        <EmptyState title={t("noPermission")} />
      </div>
    );
  }

  const columns: ColumnDef<LeaseIntentDto>[] = [
    { id: "lease", header: t("colLease"), cell: (i) => <span className="font-mono text-xs">{i.leaseDocumentNumber}</span> },
    {
      id: "unit",
      header: t("colUnit"),
      cell: (i) => (
        <span className="text-xs">
          {i.unit.unitNumber} ({resolveLocalizedText(i.unit.buildingName, locale)})
        </span>
      ),
    },
    { id: "customer", header: t("colCustomer"), cell: (i) => <span className="text-xs text-ink">{i.customer.fullName}</span> },
    { id: "type", header: t("colType"), cell: (i) => <span className="text-xs">{tIntent(`type.${i.intentType}`)}</span> },
    { id: "date", header: t("colDesiredDate"), cell: (i) => <span className="font-mono text-xs">{i.desiredDate}</span> },
    { id: "note", header: t("colNote"), cell: (i) => <span className="text-xs">{i.note ?? "-"}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (i) => (
        <div className="space-y-0.5">
          <Badge variant={INTENT_STATUS_BADGE_VARIANT[i.status as LeaseIntentStatusType]}>{tIntent(`status.${i.status}`)}</Badge>
          {i.status === "Rejected" && <div className="text-[11px] text-destructive">{i.rejectReason ?? "-"}</div>}
          {i.reviewedBy && <div className="text-[11px] text-mute">{i.reviewedBy.fullName ?? "-"}</div>}
        </div>
      ),
    },
    { id: "created", header: t("colCreatedAt"), cell: (i) => <span className="text-xs">{formatDateTime(i.createdAt, locale)}</span> },
    {
      id: "actions",
      header: <span className="sr-only">{t("colActions")}</span>,
      align: "right",
      cell: (i) =>
        i.status === "Pending" ? (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              title={t("btnApprove")}
              aria-label={`${t("btnApprove")} ${i.leaseDocumentNumber}`}
              disabled={isBusy}
              onClick={() => setApproveTarget(i)}
              className="h-8 w-8 rounded-full"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              title={t("btnReject")}
              aria-label={`${t("btnReject")} ${i.leaseDocumentNumber}`}
              disabled={isBusy}
              onClick={() => setRejectTarget(i)}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="LSE" title={t("title")} description={t("description")} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("listTitle")}</h3>
        <div className="w-48">
          <SelectPill
            aria-label={t("colStatus")}
            value={status}
            onChange={(e) => setStatus(e.target.value as LeaseIntentStatusType)}
            wrapperClassName="!mb-0"
          >
            {LEASE_INTENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {tIntent(`status.${s}`)}
              </option>
            ))}
          </SelectPill>
        </div>
      </div>
      <DataTable
        {...pg.tableProps(data?.pagination)}
        columns={columns}
        data={data?.items ?? []}
        getRowId={(i) => i.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
      <ConfirmationModal
        isOpen={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        onConfirm={executeApprove}
        title={t("confirmApproveTitle")}
        message={approveTarget?.intentType === "MoveOut" ? t("confirmApproveMoveOut") : t("confirmApproveRenew")}
        confirmText={t("btnApprove")}
        variant="warning"
        isLoading={approveMutation.isPending}
      />
      <ReasonDialog
        open={rejectTarget !== null}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        title={t("rejectTitle")}
        description={t("rejectDescription")}
        actionText={t("btnReject")}
        confirmTitle={t("confirmRejectTitle")}
        confirmMessage={t("confirmRejectMessage", { lease: rejectTarget?.leaseDocumentNumber ?? "" })}
        isLoading={rejectMutation.isPending}
        onConfirm={executeReject}
      />
    </div>
  );
}
