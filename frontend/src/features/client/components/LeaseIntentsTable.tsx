"use client";

import React, { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters";
import { useWithdrawLeaseIntentMutation } from "../api/use-client-leases";
import { INTENT_STATUS_BADGE_VARIANT } from "../constants";
import type { LeaseIntentDto, LeaseIntentStatusType } from "../types";
import { LeaseIntentDialog } from "./LeaseIntentDialog";

export interface LeaseIntentsTableProps {
  intents: LeaseIntentDto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** "My requests" table: Pending intents can be edited or withdrawn (with confirmation). */
export function LeaseIntentsTable({ intents, isLoading, isError, onRetry }: LeaseIntentsTableProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.intent");
  const { toastSuccess, toastApiError } = useToast();
  const withdrawMutation = useWithdrawLeaseIntentMutation();
  const [editTarget, setEditTarget] = useState<LeaseIntentDto | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<LeaseIntentDto | null>(null);

  const executeWithdraw = async () => {
    if (!withdrawTarget || withdrawMutation.isPending) return;
    try {
      await withdrawMutation.mutateAsync(withdrawTarget.id);
      toastSuccess(t("toastWithdrawn"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setWithdrawTarget(null);
    }
  };

  const columns: ColumnDef<LeaseIntentDto>[] = [
    { id: "lease", header: t("colLease"), cell: (i) => <span className="font-mono text-xs">{i.leaseDocumentNumber}</span> },
    { id: "type", header: t("colType"), cell: (i) => <span className="text-xs">{t(`type.${i.intentType}`)}</span> },
    { id: "date", header: t("colDesiredDate"), cell: (i) => <span className="font-mono text-xs">{i.desiredDate}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (i) => (
        <Badge variant={INTENT_STATUS_BADGE_VARIANT[i.status as LeaseIntentStatusType]}>{t(`status.${i.status}`)}</Badge>
      ),
    },
    {
      id: "detail",
      header: t("colDetail"),
      cell: (i) => (
        <div className="space-y-0.5 text-xs">
          <div className="text-body">{i.note ?? "-"}</div>
          {i.status === "Rejected" && (
            <div className="text-destructive" data-testid="intent-reject-reason">
              {t("rejectReason")}: {i.rejectReason ?? "-"}
            </div>
          )}
          <div className="font-mono text-[11px] text-mute">{formatDateTime(i.createdAt, locale)}</div>
        </div>
      ),
    },
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
              title={t("btnEdit")}
              aria-label={`${t("btnEdit")} ${i.leaseDocumentNumber}`}
              disabled={withdrawMutation.isPending}
              onClick={() => setEditTarget(i)}
              className="h-8 w-8 rounded-full"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              title={t("btnWithdraw")}
              aria-label={`${t("btnWithdraw")} ${i.leaseDocumentNumber}`}
              disabled={withdrawMutation.isPending}
              onClick={() => setWithdrawTarget(i)}
              className="h-8 w-8 rounded-full"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={intents}
        getRowId={(i) => i.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={onRetry}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
      <LeaseIntentDialog
        open={editTarget !== null}
        onOpenChange={(o) => !o && setEditTarget(null)}
        leaseId={editTarget?.leaseId ?? ""}
        leaseDocumentNumber={editTarget?.leaseDocumentNumber ?? ""}
        intent={editTarget}
      />
      <ConfirmationModal
        isOpen={withdrawTarget !== null}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={executeWithdraw}
        title={t("confirmWithdrawTitle")}
        message={t("confirmWithdrawMessage", { lease: withdrawTarget?.leaseDocumentNumber ?? "" })}
        confirmText={t("btnWithdraw")}
        variant="warning"
        isLoading={withdrawMutation.isPending}
      />
    </>
  );
}
