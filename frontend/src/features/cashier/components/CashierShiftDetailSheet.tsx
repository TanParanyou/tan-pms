"use client";

import React, { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Ban, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageLoading } from "@/components/ui/mono-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { FormField } from "@/components/forms/form-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { useCashierShift, useCancelShiftMutation, useUpdateShiftRemarkMutation } from "../api/use-cashier";
import {
  PERMISSION_CASHIER_OPERATE,
  PERMISSION_CASHIER_RECONCILE,
  SHIFT_STATUS_BADGE_VARIANT,
} from "../constants";
import type { CashierShiftStatusType } from "../types";

export interface CashierShiftDetailSheetProps {
  propertyId: string;
  shiftId: string | null;
  onClose: () => void;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="break-all text-sm text-ink">{children}</div>
    </div>
  );
}

const money = (v: number | null | undefined) => (v == null ? "-" : formatCurrencyThb(v));

export function CashierShiftDetailSheet({ propertyId, shiftId, onClose }: CashierShiftDetailSheetProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.cashier");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canAct = hasPermission(PERMISSION_CASHIER_OPERATE) || hasPermission(PERMISSION_CASHIER_RECONCILE);

  const { data: shift, isLoading, isError, refetch } = useCashierShift(propertyId, shiftId);
  const cancelMutation = useCancelShiftMutation(propertyId);
  const remarkMutation = useUpdateShiftRemarkMutation(propertyId);
  const inFlight = useRef(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showRemark, setShowRemark] = useState(false);

  const remarkForm = useForm<{ varianceRemark: string }>({ values: { varianceRemark: shift?.varianceRemark ?? "" } });
  useUnsavedChanges(showRemark && remarkForm.formState.isDirty);

  const status = shift?.status as CashierShiftStatusType | undefined;
  const hasActivity =
    shift != null &&
    (shift.cashReceiptsInShift > 0 || shift.cashDepositsReceivedInShift > 0 || shift.cashDepositsRefundedInShift > 0);
  const isBusy = cancelMutation.isPending || remarkMutation.isPending;

  const executeCancel = async (reason: string): Promise<boolean> => {
    if (!shift) return false;
    try {
      await cancelMutation.mutateAsync({ shiftId: shift.id, reason });
      toastSuccess(t("toastCancelled"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  const submitRemark = remarkForm.handleSubmit(async (v) => {
    if (!shift || isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await remarkMutation.mutateAsync({ shiftId: shift.id, varianceRemark: v.varianceRemark.trim() });
      toastSuccess(t("toastRemarkUpdated"));
      setShowRemark(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  return (
    <Sheet open={shiftId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("detailTitle")}</SheetTitle>
          <SheetDescription>{shift?.documentNumber}</SheetDescription>
        </SheetHeader>
        {isLoading && <PageLoading message={t("loadingShift")} />}
        {isError && <EmptyState title={t("loadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />}
        {shift && status && (
          <div className="space-y-4 py-4">
            <Item label={t("colStatus")}>
              <Badge variant={SHIFT_STATUS_BADGE_VARIANT[status]}>{t(`shiftStatus.${status}`)}</Badge>
            </Item>
            <Item label={t("colCashier")}>{shift.cashier?.fullName ?? "-"}</Item>
            <Item label={t("colOpenedAt")}>{formatDateTime(shift.openedAt, locale)}</Item>
            <Item label={t("openingFloat")}>{money(shift.openingFloatCash)}</Item>
            <Item label={t("cashReceipts")}>{money(shift.cashReceiptsInShift)}</Item>
            <Item label={t("depositsIn")}>{money(shift.cashDepositsReceivedInShift)}</Item>
            <Item label={t("depositsOut")}>{money(shift.cashDepositsRefundedInShift)}</Item>
            <Item label={t("expectedDrawerCash")}>{money(shift.expectedDrawerCash)}</Item>
            <Item label={t("colCounted")}>{money(shift.actualCashCounted)}</Item>
            <Item label={t("colVariance")}>{money(shift.cashVariance)}</Item>
            <Item label={t("varianceRemark")}>{shift.varianceRemark ? shift.varianceRemark : "-"}</Item>
            {status === "Cancelled" && <Item label={t("cancelReason")}>{shift.cancelReason ?? "-"}</Item>}
            <p data-testid="shift-flow-hint" className="rounded-[12px] bg-surface-soft p-3 text-[11px] text-body">
              {t("cashFlowHint")}
            </p>
            {(status === "Closed" || status === "Reconciled") && (
              <p data-testid="shift-no-delete-hint" className="rounded-[12px] bg-surface-soft p-3 text-[11px] text-body">
                {t("noDeleteHint")}
              </p>
            )}
            {canAct && (
              <div className="flex flex-wrap justify-end gap-2">
                {status === "Closed" && (
                  <Button type="button" variant="outline" disabled={isBusy} onClick={() => setShowRemark(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                    <Pencil className="h-4 w-4" />
                    <span>{t("btnEditRemark")}</span>
                  </Button>
                )}
                {status === "Open" && !hasActivity && (
                  <Button type="button" variant="outline" disabled={isBusy} onClick={() => setShowCancel(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                    <Ban className="h-4 w-4" />
                    <span>{t("btnCancelShift")}</span>
                  </Button>
                )}
              </div>
            )}
            {status === "Open" && hasActivity && <p className="text-[11px] text-mute">{t("cancelBlockedHint")}</p>}
          </div>
        )}

        <ReasonDialog
          open={showCancel}
          onOpenChange={setShowCancel}
          title={t("cancelTitle")}
          description={t("cancelDescription")}
          actionText={t("btnCancelShift")}
          confirmTitle={t("confirmCancelTitle")}
          confirmMessage={t("confirmCancelMessage")}
          isLoading={cancelMutation.isPending}
          onConfirm={executeCancel}
        />
        <Dialog open={showRemark} onOpenChange={setShowRemark}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("editRemarkTitle")}</DialogTitle>
              <DialogDescription>{t("editRemarkDescription")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitRemark} className="space-y-4">
              <FormField id="edit-shift-remark" label={t("varianceRemark")}>
                <Textarea id="edit-shift-remark" placeholder={t("placeholderVarianceRemark")} {...remarkForm.register("varianceRemark")} />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowRemark(false)} className="rounded-full">
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isBusy} className="rounded-full">
                  {remarkMutation.isPending ? tCommon("loading") : tCommon("save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
