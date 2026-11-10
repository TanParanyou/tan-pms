"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Ban, Clock, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-picker";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormField } from "@/components/forms/form-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { ShiftNotOpenAlert, isShiftNotOpenError } from "@/components/shared/shift-not-open-alert";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { localInputToIso, toLocalInput } from "@/lib/datetime";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import {
  useAdminStayDetail,
  useUpdateStayMutation,
  useCancelStayMutation,
  useExtendStayMutation,
  useCheckOutStayMutation,
} from "../api/use-stays";
import {
  extendStaySchema,
  checkOutSchema,
  updateStaySchema,
  type ExtendStayFormValues,
  type CheckOutFormValues,
  type UpdateStayFormValues,
} from "../schemas/stay-schemas";
import { EXTEND_HOUR_OPTIONS, PERMISSION_STAY_CHECKOUT, STAY_STATUS_BADGE_VARIANT } from "../constants";
import type { StayDetailDto } from "../types";
import { StayFolioPanel } from "./StayFolioPanel";
import { StayOccupantsPanel } from "./StayOccupantsPanel";

export interface StayDetailEditorProps {
  stayId: string;
}

/** Stay detail route body: view, edit note / expected check-out, extend, cancel mistaken check-in, folio, occupants, check-out. */
export function StayDetailEditor({ stayId }: StayDetailEditorProps) {
  const { activeProperty } = useAdminWorkspace();
  const t = useTranslations("admin.stays");
  const tCommon = useTranslations("common");
  const { data, isLoading, isError, refetch } = useAdminStayDetail(activeProperty.id, stayId);
  if (isLoading) return <PageLoading message={t("loadingStay")} />;
  if (isError) return <EmptyState title={t("loadStayError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />;
  if (!data) return <EmptyState title={t("stayNotFound")} />;
  return <StayBody propertyId={activeProperty.id} stay={data} />;
}

function StayBody({ propertyId, stay }: { propertyId: string; stay: StayDetailDto }) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.stays");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canCheckOut = hasPermission(PERMISSION_STAY_CHECKOUT);
  const isActive = stay.status === "Active";
  const isHourly = stay.stayMode === "Hourly";

  const updateM = useUpdateStayMutation(propertyId);
  const cancelM = useCancelStayMutation(propertyId);
  const extendM = useExtendStayMutation(propertyId);
  const checkOutM = useCheckOutStayMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy = updateM.isPending || cancelM.isPending || extendM.isPending || checkOutM.isPending;
  const [shiftNotOpen, setShiftNotOpen] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [showConfirmExtend, setShowConfirmExtend] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showConfirmCheckOut, setShowConfirmCheckOut] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const editForm = useForm<UpdateStayFormValues>({
    resolver: zodResolver(updateStaySchema),
    values: { note: stay.note ?? "", expectedCheckOutAt: toLocalInput(stay.expectedCheckOutAt) },
  });
  const extendForm = useForm<ExtendStayFormValues>({ resolver: zodResolver(extendStaySchema), defaultValues: { additionalHours: 1 } });
  const checkOutForm = useForm<CheckOutFormValues>({ resolver: zodResolver(checkOutSchema), defaultValues: { keyDepositDeduction: 0, deductionReason: "" } });
  useUnsavedChanges(editForm.formState.isDirty || checkOutForm.formState.isDirty);

  const deduction = checkOutForm.watch("keyDepositDeduction");
  const unsettled = stay.folio.balanceDue > 0;

  const submitEdit = editForm.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      await updateM.mutateAsync({
        id: stay.id,
        req: { note: v.note || undefined, expectedCheckOutAt: v.expectedCheckOutAt ? localInputToIso(v.expectedCheckOutAt) : undefined },
      });
      toastSuccess(t("toastStayUpdated"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const executeExtend = async () => {
    if (isBusy) return;
    try {
      await extendM.mutateAsync({ stayId: stay.id, req: { additionalHours: extendForm.getValues("additionalHours") } });
      toastSuccess(t("toastExtended"));
      setShowExtend(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowConfirmExtend(false);
    }
  };

  const executeCheckOut = async () => {
    if (isBusy) return;
    const v = checkOutForm.getValues();
    try {
      await checkOutM.mutateAsync({
        stayId: stay.id,
        req: { keyDepositDeductionAmount: v.keyDepositDeduction, deductionOrRefundReason: v.deductionReason ?? "" },
      });
      toastSuccess(t("saveCheckOut"));
      router.push("/admin/stays");
    } catch (err) {
      setShiftNotOpen(isShiftNotOpenError(err));
      toastApiError(err);
      setShowConfirmCheckOut(false);
    }
  };

  const handleCancel = async (reason: string): Promise<boolean> => {
    try {
      await cancelM.mutateAsync({ id: stay.id, reason });
      toastSuccess(t("toastStayCancelled"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {shiftNotOpen && <ShiftNotOpenAlert />}
      <PageHeader
        prefixCode="STY"
        title={`${stay.documentNumber} - ${stay.unit.unitNumber}`}
        description={`${stay.customer.fullName} - ${tModes(stay.stayMode)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/stays">
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {isActive && isHourly && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowExtend(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Clock className="h-4 w-4" />
                <span>{t("actionExtend")}</span>
              </Button>
            )}
            {isActive && canCheckOut && (
              <Button type="button" size="sm" disabled={isBusy} onClick={() => setShowCheckOut(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <LogOut className="h-4 w-4" />
                <span>{t("actionCheckOut")}</span>
              </Button>
            )}
            {isActive && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowCancel(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Ban className="h-4 w-4" />
                <span>{t("btnCancelStay")}</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label={t("colStatus")}>
          <div className="flex flex-wrap gap-1">
            <Badge variant={STAY_STATUS_BADGE_VARIANT[stay.status]}>{t(`stayStatus${stay.status}`)}</Badge>
            {stay.isOvertime && <Badge variant="destructive">{t("overtimeLabel")}</Badge>}
          </div>
        </DetailItem>
        <DetailItem label={t("colCheckInAt")}>{formatDateTime(stay.checkInAt, locale)}</DetailItem>
        <DetailItem label={t("colExpectedCheckOut")}>{stay.expectedCheckOutAt ? formatDateTime(stay.expectedCheckOutAt, locale) : "-"}</DetailItem>
        <DetailItem label={t("colCheckOutAt")}>{stay.checkOutAt ? formatDateTime(stay.checkOutAt, locale) : "-"}</DetailItem>
        <DetailItem label={t("keyDepositTitle")}>
          {formatCurrencyThb(stay.keyDepositAmount)} / {formatCurrencyThb(stay.keyDepositBalance)}
        </DetailItem>
        <DetailItem label={t("fieldNote")}>{stay.note ?? "-"}</DetailItem>
        {stay.cancelReason != null && <DetailItem label={t("cancelReasonLabel")}>{stay.cancelReason}</DetailItem>}
        {stay.reservationDocumentNumber && <DetailItem label={t("reservationLabel")}>{stay.reservationDocumentNumber}</DetailItem>}
      </div>

      {isActive && (
        <form onSubmit={submitEdit} className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
          <h3 className="text-sm font-semibold text-ink">{t("sectionEditStay")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="stay-expected" label={t("colExpectedCheckOut")}>
              <Controller name="expectedCheckOutAt" control={editForm.control} render={({ field }) => (
                <DateTimeInput id="stay-expected" mode="datetime" value={field.value ?? ""} onValueChange={field.onChange} disabled={isBusy} placeholder={t("colExpectedCheckOut")} />
              )} />
            </FormField>
            <FormField id="stay-note" label={t("fieldNote")}>
              <Textarea id="stay-note" placeholder={t("placeholderNote")} disabled={isBusy} {...editForm.register("note")} />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
              {updateM.isPending ? tCommon("loading") : tCommon("save")}
            </Button>
          </div>
        </form>
      )}

      <StayFolioPanel propertyId={propertyId} stay={stay} onShiftNotOpen={setShiftNotOpen} />
      <StayOccupantsPanel propertyId={propertyId} stay={stay} />

      <Dialog open={showExtend} onOpenChange={setShowExtend}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("modalTitleExtend", { doc: stay.documentNumber, unit: stay.unit.unitNumber })}</DialogTitle>
            <DialogDescription>{t("capNotice")}</DialogDescription>
          </DialogHeader>
          <FormField id="extend-hours" label={t("fieldAdditionalHours")}>
            <SelectPill id="extend-hours" wrapperClassName="!mb-0" {...extendForm.register("additionalHours", { valueAsNumber: true })}>
              {EXTEND_HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {t(`extendOption${h}`)}
                </option>
              ))}
            </SelectPill>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowExtend(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button type="button" disabled={extendM.isPending} onClick={() => setShowConfirmExtend(true)} className="rounded-full">
              {t("saveExtend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationModal isOpen={showConfirmExtend} onClose={() => setShowConfirmExtend(false)} onConfirm={executeExtend} title={t("confirmExtendTitle")} message={t("confirmExtendMessage")} confirmText={t("saveExtend")} variant="info" isLoading={extendM.isPending} />

      <Dialog open={showCheckOut} onOpenChange={setShowCheckOut}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("modalTitleCheckOut", { doc: stay.documentNumber })}</DialogTitle>
            <DialogDescription>{t("modalDescCheckOut")}</DialogDescription>
          </DialogHeader>
          {unsettled && (
            <p className="rounded-[12px] bg-destructive/10 p-3 text-xs text-destructive" data-testid="unsettled-warning">
              {t("folioUnsettledWarning", { amount: formatCurrencyThb(stay.folio.balanceDue) })}
            </p>
          )}
          <form onSubmit={checkOutForm.handleSubmit(() => setShowConfirmCheckOut(true))} className="space-y-3">
            <FormField id="checkout-deduction" label={t("fieldDeductionAmount")} helperText={`${t("keyDepositTitle")}: ${formatCurrencyThb(stay.keyDepositBalance)}`} error={checkOutForm.formState.errors.keyDepositDeduction ? t("errorAmount") : undefined}>
              <Controller name="keyDepositDeduction" control={checkOutForm.control} render={({ field }) => (
                <CurrencyInput id="checkout-deduction" value={field.value} onValueChange={field.onChange} max={stay.keyDepositBalance} placeholder={t("fieldDeductionAmount")} wrapperClassName="!mb-0" />
              )} />
            </FormField>
            <FormField id="checkout-reason" label={t("fieldDeductionReason")} required={deduction > 0}>
              <Input id="checkout-reason" placeholder={t("deductionReasonPlaceholder")} className="h-10 rounded-full text-xs" {...checkOutForm.register("deductionReason")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCheckOut(false)} className="rounded-full">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={checkOutM.isPending} className="rounded-full">
                {t("saveCheckOut")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationModal isOpen={showConfirmCheckOut} onClose={() => setShowConfirmCheckOut(false)} onConfirm={executeCheckOut} title={t("confirmCheckOutTitle")} message={t("confirmCheckOutMessage")} confirmText={t("saveCheckOut")} variant="warning" isLoading={checkOutM.isPending} />

      <ReasonDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title={t("cancelStayTitle")}
        description={t("cancelStayDescription")}
        actionText={t("btnCancelStay")}
        confirmTitle={t("confirmCancelStayTitle")}
        confirmMessage={t("confirmCancelStayMessage", { document: stay.documentNumber })}
        isLoading={cancelM.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}
