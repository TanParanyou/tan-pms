"use client";

import React, { useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import {
  useCurrentCashierShift,
  useCashierShifts,
  useOpenShiftMutation,
  useCloseShiftMutation,
  useReconcileShiftMutation,
} from "../api/use-cashier";
import {
  openShiftSchema,
  createCloseShiftSchema,
  reconcileShiftSchema,
  calcVariance,
  type OpenShiftFormValues,
  type CloseShiftFormValues,
  type ReconcileShiftFormValues,
} from "../schemas/cashier-schemas";
import {
  PERMISSION_CASHIER_OPERATE,
  PERMISSION_CASHIER_RECONCILE,
  SHIFT_STATUS_OPTIONS,
  SHIFT_STATUS_BADGE_VARIANT,
} from "../constants";
import type { CashierShiftDto, CashierShiftStatusType } from "../types";
import { CashierShiftInvertedCard } from "./CashierShiftInvertedCard";
import { CashierShiftDetailSheet } from "./CashierShiftDetailSheet";
import { useServerPagination } from "@/hooks/use-server-pagination";

export function CashierShiftSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.cashier");
  const tCommon = useTranslations("common");
  const { activeProperty, openQuickWalkIn } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canOperate = hasPermission(PERMISSION_CASHIER_OPERATE);
  const canReconcile = hasPermission(PERMISSION_CASHIER_RECONCILE);

  const [statusFilter, setStatusFilter] = useState<CashierShiftStatusType | "">("");
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState<CashierShiftDto | null>(null);
  const [showConfirmReconcile, setShowConfirmReconcile] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: current } = useCurrentCashierShift(activeProperty.id);
  const shift = current?.shift ?? null;
  const pg = useServerPagination([statusFilter]);
  const {
    data: history,
    isLoading,
    isError,
    refetch,
  } = useCashierShifts(activeProperty.id, statusFilter || undefined, pg.paging);
  const items = useMemo(() => history?.items ?? [], [history]);

  const openMutation = useOpenShiftMutation(activeProperty.id);
  const closeMutation = useCloseShiftMutation(activeProperty.id);
  const reconcileMutation = useReconcileShiftMutation(activeProperty.id);
  // Synchronous lock: isPending only flips after a re-render, so rapid double clicks need a ref.
  const inFlight = useRef(false);
  const isBusy = openMutation.isPending || closeMutation.isPending || reconcileMutation.isPending;

  const openForm = useForm<OpenShiftFormValues>({
    resolver: zodResolver(openShiftSchema),
    defaultValues: { openingFloatCash: 0 },
  });
  const closeSchema = useMemo(() => createCloseShiftSchema(shift?.expectedDrawerCash), [shift?.expectedDrawerCash]);
  const closeForm = useForm<CloseShiftFormValues>({
    resolver: zodResolver(closeSchema),
    defaultValues: { actualCashCounted: 0, varianceRemark: "" },
  });
  const reconcileForm = useForm<ReconcileShiftFormValues>({
    resolver: zodResolver(reconcileShiftSchema),
    defaultValues: { remark: "" },
  });
  useUnsavedChanges(
    openForm.formState.isDirty || closeForm.formState.isDirty || reconcileForm.formState.isDirty
  );

  const counted = closeForm.watch("actualCashCounted");
  const variance = calcVariance(shift?.expectedDrawerCash, counted ?? 0);

  const executeOpen = openForm.handleSubmit(async (values) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await openMutation.mutateAsync({ openingFloatCash: values.openingFloatCash });
      toastSuccess(t("toastOpened"));
      openForm.reset({ openingFloatCash: 0 });
      setShowOpen(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const executeClose = async () => {
    if (isBusy || inFlight.current || !shift) return;
    inFlight.current = true;
    const v = closeForm.getValues();
    try {
      await closeMutation.mutateAsync({
        shiftId: shift.id,
        req: { actualCashCounted: v.actualCashCounted, varianceRemark: v.varianceRemark || undefined },
      });
      toastSuccess(t("toastClosed"));
      closeForm.reset({ actualCashCounted: 0, varianceRemark: "" });
      setShowClose(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowConfirmClose(false);
    }
  };

  const executeReconcile = async () => {
    if (isBusy || inFlight.current || !reconcileTarget) return;
    inFlight.current = true;
    try {
      await reconcileMutation.mutateAsync({
        shiftId: reconcileTarget.id,
        req: { remark: reconcileForm.getValues("remark") || undefined },
      });
      toastSuccess(t("toastReconciled"));
      reconcileForm.reset({ remark: "" });
      setReconcileTarget(null);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowConfirmReconcile(false);
    }
  };

  const columns: ColumnDef<CashierShiftDto>[] = [
    { id: "doc", header: t("colShiftNo"), cell: (s) => <span className="font-mono text-xs">{s.documentNumber}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (s) => (
        <Badge variant={SHIFT_STATUS_BADGE_VARIANT[s.status as CashierShiftStatusType]}>
          {t(`shiftStatus.${s.status}`)}
        </Badge>
      ),
    },
    { id: "openedAt", header: t("colOpenedAt"), cell: (s) => <span className="text-xs">{formatDateTime(s.openedAt, locale)}</span> },
    {
      id: "float",
      header: t("openingFloat"),
      align: "right",
      cell: (s) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(s.openingFloatCash)}</span>,
    },
    {
      id: "expected",
      header: t("expectedDrawerCash"),
      align: "right",
      cell: (s) => (
        <span className="font-mono text-xs tabular-nums">
          {s.expectedDrawerCash == null ? "-" : formatCurrencyThb(s.expectedDrawerCash)}
        </span>
      ),
    },
    {
      id: "counted",
      header: t("colCounted"),
      align: "right",
      cell: (s) => (
        <span className="font-mono text-xs tabular-nums">
          {s.actualCashCounted == null ? "-" : formatCurrencyThb(s.actualCashCounted)}
        </span>
      ),
    },
    {
      id: "variance",
      header: t("colVariance"),
      align: "right",
      cell: (s) => (
        <span className="font-mono text-xs tabular-nums">
          {s.cashVariance == null ? "-" : formatCurrencyThb(s.cashVariance)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{tCommon("actions")}</span>,
      align: "right",
      cell: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="outline"
            title={t("btnViewShift")}
            aria-label={`${t("btnViewShift")} ${s.documentNumber}`}
            onClick={() => setDetailId(s.id)}
            className="h-8 w-8 rounded-full"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {s.status === "Closed" && canReconcile && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => setReconcileTarget(s)}
              className="h-8 rounded-full px-3 gap-1.5 text-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t("btnReconcile")}</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const actions = canOperate ? (
    shift ? (
      <Button
        type="button"
        variant="onDark"
        size="sm"
        disabled={isBusy}
        onClick={() => setShowClose(true)}
        className="h-9 rounded-full px-4 gap-1.5 text-xs"
      >
        <LogOut className="h-4 w-4" />
        <span>{t("closeDrawer")}</span>
      </Button>
    ) : (
      <Button
        type="button"
        variant="onDark"
        size="sm"
        disabled={isBusy}
        onClick={() => setShowOpen(true)}
        className="h-9 rounded-full px-4 gap-1.5 text-xs"
      >
        <LogIn className="h-4 w-4" />
        <span>{t("openDrawer")}</span>
      </Button>
    )
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="SHF" title={t("pageTitle")} description={t("pageDescription")} />
      {/* Exactly 1 Inverted Card on the cashier page per Ollama Minimal Design System */}
      <CashierShiftInvertedCard onOpenQuickWalkIn={openQuickWalkIn} actions={actions} />

      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{t("historyTitle")}</h3>
        <div className="w-48">
          <SelectPill
            aria-label={t("colStatus")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CashierShiftStatusType | "")}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allStatuses")}</option>
            {SHIFT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`shiftStatus.${s}`)}
              </option>
            ))}
          </SelectPill>
        </div>
      </div>
      <DataTable
        {...pg.tableProps(history?.pagination)}
        columns={columns}
        data={items}
        getRowId={(s) => s.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />

      <CashierShiftDetailSheet propertyId={activeProperty.id} shiftId={detailId} onClose={() => setDetailId(null)} />

      {/* Open shift */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("openTitle")}</DialogTitle>
            <DialogDescription>{t("openDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={executeOpen} className="space-y-4">
            <FormField id="open-float" label={t("openingFloat")} required error={openForm.formState.errors.openingFloatCash?.message}>
              <Controller
                name="openingFloatCash"
                control={openForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="open-float"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("openingFloat")}
                    hasError={Boolean(openForm.formState.errors.openingFloatCash)}
                  />
                )}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOpen(false)} className="rounded-full">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isBusy} className="rounded-full">
                {openMutation.isPending ? tCommon("loading") : t("openDrawer")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close shift */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("closeTitle")}</DialogTitle>
            <DialogDescription>{t("closeDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-[12px] bg-surface-soft p-3 text-xs">
              <div>
                <div className="text-mute">{t("expectedDrawerCash")}</div>
                <div data-testid="close-expected" className="font-mono tabular-nums text-ink">
                  {shift?.expectedDrawerCash == null ? "-" : formatCurrencyThb(shift.expectedDrawerCash)}
                </div>
              </div>
              <div>
                <div className="text-mute">{t("colVariance")}</div>
                <div data-testid="close-variance" className="mt-0 min-h-[16px] font-mono tabular-nums text-ink">
                  {variance == null ? (
                    <span className="invisible select-none" aria-hidden="true">
                      -
                    </span>
                  ) : (
                    formatCurrencyThb(variance)
                  )}
                </div>
              </div>
            </div>
            <FormField id="close-counted" label={t("actualCashCounted")} required error={closeForm.formState.errors.actualCashCounted?.message}>
              <Controller
                name="actualCashCounted"
                control={closeForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="close-counted"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("actualCashCounted")}
                    hasError={Boolean(closeForm.formState.errors.actualCashCounted)}
                  />
                )}
              />
            </FormField>
            <FormField
              id="close-remark"
              label={t("varianceRemark")}
              required={variance !== null && variance !== 0}
              error={closeForm.formState.errors.varianceRemark ? t("errorRemarkRequired") : undefined}
            >
              <Textarea id="close-remark" placeholder={t("placeholderVarianceRemark")} {...closeForm.register("varianceRemark")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowClose(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={isBusy}
              onClick={closeForm.handleSubmit(() => setShowConfirmClose(true))}
              className="rounded-full"
            >
              {t("closeDrawer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconcile (remark dialog then confirmation) */}
      <Dialog open={reconcileTarget !== null} onOpenChange={(o) => !o && setReconcileTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reconcileTitle")}</DialogTitle>
            <DialogDescription>{reconcileTarget?.documentNumber}</DialogDescription>
          </DialogHeader>
          <FormField id="reconcile-remark" label={t("reconcileRemark")}>
            <Textarea id="reconcile-remark" placeholder={t("placeholderReconcileRemark")} {...reconcileForm.register("remark")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReconcileTarget(null)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button type="button" disabled={isBusy} onClick={() => setShowConfirmReconcile(true)} className="rounded-full">
              {t("btnReconcile")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        isOpen={showConfirmClose}
        onClose={() => setShowConfirmClose(false)}
        onConfirm={executeClose}
        title={tCommon("dialog.confirmCloseShiftTitle")}
        message={tCommon("dialog.confirmCloseShiftMessage")}
        confirmText={t("closeDrawer")}
        variant="warning"
        isLoading={closeMutation.isPending}
      />
      <ConfirmationModal
        isOpen={showConfirmReconcile}
        onClose={() => setShowConfirmReconcile(false)}
        onConfirm={executeReconcile}
        title={t("confirmReconcileTitle")}
        message={t("confirmReconcileMessage")}
        confirmText={t("btnReconcile")}
        variant="danger"
        isLoading={reconcileMutation.isPending}
      />
    </div>
  );
}
