"use client";

import React, { useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectPill } from "@/components/ui/select-pill";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormField } from "@/components/forms/form-field";
import { LocalizedTextFields } from "@/components/forms/localized-text-fields";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { isShiftNotOpenError } from "@/components/shared/shift-not-open-alert";
import { formatCurrencyThb } from "@/lib/formatters";
import { resolveLocalizedText, toLocalizedText } from "@/lib/i18n/localized-text";
import {
  useAddFolioChargeMutation,
  useVoidFolioChargeMutation,
  useRecordFolioPaymentMutation,
  useReverseFolioPaymentMutation,
} from "../api/use-stays";
import {
  folioChargeSchema,
  folioPaymentSchema,
  reversePaymentSchema,
  type FolioChargeFormValues,
  type FolioPaymentFormValues,
  type ReversePaymentFormValues,
} from "../schemas/stay-schemas";
import {
  CHARGE_FORM_DEFAULTS,
  FOLIO_PAYMENT_METHODS,
  FOLIO_TAX_MODES,
  PAYMENT_FORM_DEFAULTS,
  PERMISSION_INVOICES_VOID,
} from "../constants";
import type { StayDetailDto } from "../types";

export interface StayFolioPanelProps {
  propertyId: string;
  stay: StayDetailDto;
  onShiftNotOpen: (flag: boolean) => void;
}

/** Folio: charges table (void with reason), add charge, record payment, reverse payment (admin.invoices.void). */
export function StayFolioPanel({ propertyId, stay, onShiftNotOpen }: StayFolioPanelProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.stays");
  const tL = useTranslations("common.localized");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canVoid = hasPermission(PERMISSION_INVOICES_VOID);
  const isActive = stay.status === "Active";

  const addCharge = useAddFolioChargeMutation(propertyId);
  const voidCharge = useVoidFolioChargeMutation(propertyId);
  const recordPayment = useRecordFolioPaymentMutation(propertyId);
  const reversePayment = useReverseFolioPaymentMutation(propertyId);
  const chargeInFlight = useRef(false);
  const paymentInFlight = useRef(false);
  const isBusy = addCharge.isPending || voidCharge.isPending || recordPayment.isPending || reversePayment.isPending;
  const [voidTarget, setVoidTarget] = useState<{ id: string; description: string } | null>(null);
  const [showReverse, setShowReverse] = useState(false);
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);

  const chargeForm = useForm<FolioChargeFormValues>({ resolver: zodResolver(folioChargeSchema), defaultValues: CHARGE_FORM_DEFAULTS });
  const paymentForm = useForm<FolioPaymentFormValues>({ resolver: zodResolver(folioPaymentSchema), defaultValues: PAYMENT_FORM_DEFAULTS });
  const reverseForm = useForm<ReversePaymentFormValues>({ resolver: zodResolver(reversePaymentSchema), defaultValues: { ...PAYMENT_FORM_DEFAULTS, reason: "" } });
  useUnsavedChanges(chargeForm.formState.isDirty || paymentForm.formState.isDirty);

  const submitCharge = chargeForm.handleSubmit(async (v) => {
    if (isBusy || chargeInFlight.current) return;
    chargeInFlight.current = true;
    try {
      await addCharge.mutateAsync({ stayId: stay.id, req: { description: toLocalizedText(v.descriptionTh, v.descriptionEn), amount: v.amount, taxMode: v.taxMode } });
      toastSuccess(t("toastChargeAdded"));
      chargeForm.reset(CHARGE_FORM_DEFAULTS);
    } catch (err) {
      toastApiError(err);
    } finally {
      chargeInFlight.current = false;
    }
  });

  const submitPayment = paymentForm.handleSubmit(async (v) => {
    if (isBusy || paymentInFlight.current) return;
    paymentInFlight.current = true;
    try {
      await recordPayment.mutateAsync({ stayId: stay.id, req: v });
      onShiftNotOpen(false);
      toastSuccess(t("toastPaymentRecorded"));
      paymentForm.reset(PAYMENT_FORM_DEFAULTS);
    } catch (err) {
      onShiftNotOpen(isShiftNotOpenError(err));
      toastApiError(err);
    } finally {
      paymentInFlight.current = false;
    }
  });

  const executeVoid = async (reason: string): Promise<boolean> => {
    if (!voidTarget) return false;
    try {
      await voidCharge.mutateAsync({ stayId: stay.id, chargeId: voidTarget.id, reason });
      toastSuccess(t("toastChargeVoided"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  const executeReverse = async () => {
    if (isBusy) return;
    const v = reverseForm.getValues();
    try {
      await reversePayment.mutateAsync({ stayId: stay.id, req: v });
      onShiftNotOpen(false);
      toastSuccess(t("toastPaymentReversed"));
      reverseForm.reset({ ...PAYMENT_FORM_DEFAULTS, reason: "" });
      setShowReverse(false);
    } catch (err) {
      onShiftNotOpen(isShiftNotOpenError(err));
      toastApiError(err);
    } finally {
      setShowReverseConfirm(false);
    }
  };

  return (
    <div className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{t("sectionFolio")}</h3>
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums">
          <span>{t("totalChargesLabel")}: {formatCurrencyThb(stay.folio.totalCharges)}</span>
          <span>{t("totalPaymentsLabel")}: {formatCurrencyThb(stay.folio.totalPayments)}</span>
          <span data-testid="folio-balance" className="font-semibold">{t("balanceDueLabel")}: {formatCurrencyThb(stay.folio.balanceDue)}</span>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colChargeDesc")}</TableHead>
            <TableHead>{t("colChargeTaxMode")}</TableHead>
            <TableHead className="text-right">{t("colChargeAmount")}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{tCommon("actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stay.folio.charges.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-mute">
                {t("noCharges")}
              </TableCell>
            </TableRow>
          ) : (
            stay.folio.charges.map((c) => (
              <TableRow key={c.id} className={c.isVoided ? "opacity-60" : undefined}>
                <TableCell className="text-xs">
                  <div className={c.isVoided ? "line-through" : undefined}>{resolveLocalizedText(c.description, locale)}</div>
                  {c.isVoided && (
                    <div className="text-[11px] text-destructive" data-testid="charge-void-reason">
                      {t("voidedLabel")}: {c.voidReason ?? "-"}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">{t(`taxMode${c.taxMode}`)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{formatCurrencyThb(c.amount)}</TableCell>
                <TableCell className="text-right">
                  {isActive && canVoid && !c.isVoided && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      title={t("btnVoidCharge")}
                      aria-label={`${t("btnVoidCharge")} ${resolveLocalizedText(c.description, locale)}`}
                      disabled={isBusy}
                      onClick={() => setVoidTarget({ id: c.id, description: resolveLocalizedText(c.description, locale) })}
                      className="h-8 w-8 rounded-full"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {c.isVoided && <Badge variant="outline">{t("voidedLabel")}</Badge>}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {isActive && (
        <div className="grid grid-cols-1 gap-6 border-t border-hairline pt-4 lg:grid-cols-2">
          <form onSubmit={submitCharge} className="space-y-3">
            <h4 className="text-xs font-semibold text-ink">{t("tabAddCharge")}</h4>
            <LocalizedTextFields
              idPrefix="charge-desc"
              labelTh={t("fieldChargeDescTh")}
              labelEn={t("fieldChargeDescEn")}
              valueTh={chargeForm.watch("descriptionTh")}
              valueEn={chargeForm.watch("descriptionEn") ?? ""}
              onChangeTh={(v) => chargeForm.setValue("descriptionTh", v, { shouldDirty: true, shouldValidate: true })}
              onChangeEn={(v) => chargeForm.setValue("descriptionEn", v, { shouldDirty: true })}
              placeholderTh={tL("placeholderTh")}
              placeholderEn={tL("placeholderEn")}
              errorTh={chargeForm.formState.errors.descriptionTh ? tL("errorThaiRequired") : undefined}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField id="charge-amount" label={t("fieldChargeAmount")} error={chargeForm.formState.errors.amount ? t("errorAmount") : undefined}>
                <Controller name="amount" control={chargeForm.control} render={({ field }) => (
                  <CurrencyInput id="charge-amount" value={field.value} onValueChange={field.onChange} placeholder={t("fieldChargeAmount")} disabled={isBusy} wrapperClassName="!mb-0" />
                )} />
              </FormField>
              <FormField id="charge-tax" label={t("fieldTaxMode")}>
                <SelectPill id="charge-tax" disabled={isBusy} wrapperClassName="!mb-0" {...chargeForm.register("taxMode")}>
                  {FOLIO_TAX_MODES.map((m) => (
                    <option key={m} value={m}>
                      {t(`taxMode${m}`)}
                    </option>
                  ))}
                </SelectPill>
              </FormField>
            </div>
            <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
              {addCharge.isPending ? tCommon("loading") : t("saveAddCharge")}
            </Button>
          </form>

          <form onSubmit={submitPayment} className="space-y-3">
            <h4 className="text-xs font-semibold text-ink">{t("tabRecordPayment")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="payment-amount" label={t("fieldPaymentAmount")} error={paymentForm.formState.errors.amount ? t("errorAmount") : undefined}>
                <Controller name="amount" control={paymentForm.control} render={({ field }) => (
                  <CurrencyInput id="payment-amount" value={field.value} onValueChange={field.onChange} placeholder={t("fieldPaymentAmount")} disabled={isBusy} wrapperClassName="!mb-0" />
                )} />
              </FormField>
              <FormField id="payment-method" label={t("fieldPaymentMethod")}>
                <SelectPill id="payment-method" disabled={isBusy} wrapperClassName="!mb-0" {...paymentForm.register("paymentMethod")}>
                  {FOLIO_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`method${m}`)}
                    </option>
                  ))}
                </SelectPill>
              </FormField>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
                {recordPayment.isPending ? tCommon("loading") : t("saveRecordPayment")}
              </Button>
              {canVoid && (
                <Button type="button" variant="outline" disabled={isBusy} onClick={() => setShowReverse(true)} className="h-10 gap-1.5 rounded-full px-5 text-xs">
                  <Undo2 className="h-4 w-4" />
                  <span>{t("btnReversePayment")}</span>
                </Button>
              )}
            </div>
          </form>
        </div>
      )}

      <ReasonDialog
        open={voidTarget !== null}
        onOpenChange={(o) => !o && setVoidTarget(null)}
        title={t("voidChargeTitle")}
        description={t("voidChargeDescription")}
        actionText={t("btnVoidCharge")}
        confirmTitle={t("confirmVoidChargeTitle")}
        confirmMessage={t("confirmVoidChargeMessage", { description: voidTarget?.description ?? "" })}
        isLoading={voidCharge.isPending}
        onConfirm={executeVoid}
      />

      <Dialog open={showReverse} onOpenChange={setShowReverse}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reversePaymentTitle")}</DialogTitle>
            <DialogDescription>{t("reversePaymentDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={reverseForm.handleSubmit(() => setShowReverseConfirm(true))} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField id="reverse-amount" label={t("fieldPaymentAmount")} error={reverseForm.formState.errors.amount ? t("errorAmount") : undefined}>
                <Controller name="amount" control={reverseForm.control} render={({ field }) => (
                  <CurrencyInput id="reverse-amount" value={field.value} onValueChange={field.onChange} placeholder={t("fieldPaymentAmount")} wrapperClassName="!mb-0" />
                )} />
              </FormField>
              <FormField id="reverse-method" label={t("fieldPaymentMethod")}>
                <SelectPill id="reverse-method" wrapperClassName="!mb-0" {...reverseForm.register("paymentMethod")}>
                  {FOLIO_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(`method${m}`)}
                    </option>
                  ))}
                </SelectPill>
              </FormField>
            </div>
            <FormField id="reverse-reason" label={t("fieldReverseReason")} required error={reverseForm.formState.errors.reason ? t("errorReasonRequired") : undefined}>
              <Textarea id="reverse-reason" placeholder={t("placeholderReverseReason")} {...reverseForm.register("reason")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReverse(false)} className="rounded-full">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" variant="destructive" disabled={reversePayment.isPending} className="rounded-full">
                {t("btnReversePayment")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={showReverseConfirm}
        onClose={() => setShowReverseConfirm(false)}
        onConfirm={executeReverse}
        title={t("confirmReverseTitle")}
        message={t("confirmReverseMessage")}
        confirmText={t("btnReversePayment")}
        variant="danger"
        isLoading={reversePayment.isPending}
      />
    </div>
  );
}
