"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { CurrencyInput } from "@/components/forms/currency-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { LocalizedTextFields } from "@/components/forms/localized-text-fields";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import {
  useAdminStayDetail,
  useExtendStayMutation,
  useAddFolioChargeMutation,
  useRecordFolioPaymentMutation,
  useCheckOutStayMutation,
} from "../api/use-stays";
import {
  extendStaySchema,
  folioChargeSchema,
  folioPaymentSchema,
  checkOutSchema,
  type ExtendStayFormValues,
  type FolioChargeFormValues,
  type FolioPaymentFormValues,
  type CheckOutFormValues,
} from "../schemas/stay-schemas";
import { ArrowLeft, Clock, LogOut, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import type { FolioTaxModeType, FolioPaymentMethodType } from "../types";

export interface StayDetailEditorProps {
  stayId: string;
}

export function StayDetailEditor({ stayId }: StayDetailEditorProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const { activeProperty } = useAdminWorkspace();
  const tStays = useTranslations("admin.stays");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  const { data: stay, isLoading } = useAdminStayDetail(activeProperty.id, stayId);

  // Mutations
  const extendMutation = useExtendStayMutation(activeProperty.id);
  const addChargeMutation = useAddFolioChargeMutation(activeProperty.id);
  const recordPaymentMutation = useRecordFolioPaymentMutation(activeProperty.id);
  const checkOutMutation = useCheckOutStayMutation(activeProperty.id);

  // Modals & Active Tab
  const [activeTab, setActiveTab] = useState("tab-charges");
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showConfirmExtend, setShowConfirmExtend] = useState(false);
  const [showConfirmCheckOut, setShowConfirmCheckOut] = useState(false);

  // Extend Stay Form
  const extendForm = useForm({
    resolver: zodResolver(extendStaySchema),
    defaultValues: { additionalHours: 1 },
  });

  // Folio Charge Form
  const chargeForm = useForm({
    resolver: zodResolver(folioChargeSchema),
    defaultValues: {
      descriptionTh: "",
      descriptionEn: "",
      amount: 150,
      taxMode: "VatIncluded" as FolioTaxModeType,
    },
  });

  // Folio Payment Form
  const paymentForm = useForm({
    resolver: zodResolver(folioPaymentSchema),
    defaultValues: {
      amount: stay?.folio.balanceDue ?? 100,
      paymentMethod: "Cash" as FolioPaymentMethodType,
    },
  });

  // Check-Out Form
  const checkOutForm = useForm({
    resolver: zodResolver(checkOutSchema),
    defaultValues: {
      keyDepositDeduction: 0,
      deductionReason: "",
    },
  });

  useUnsavedChanges(chargeForm.formState.isDirty || paymentForm.formState.isDirty);
  const { toastSuccess, toastApiError } = useToast();

  if (isLoading || !stay) {
    return <PageLoading message={tStays("loadingStay")} />;
  }

  const handleExecuteExtend = async () => {
    try {
      const values = extendForm.getValues();
      await extendMutation.mutateAsync({
        stayId: stay.id,
        req: { additionalHours: values.additionalHours },
      });
      toastSuccess(tStays("actionExtend"));
      setShowConfirmExtend(false);
      setShowExtendModal(false);
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleExecuteAddCharge = async (values: FolioChargeFormValues) => {
    try {
      await addChargeMutation.mutateAsync({
        stayId: stay.id,
        req: {
          description: { th: values.descriptionTh, en: values.descriptionEn },
          amount: values.amount,
          taxMode: values.taxMode,
        },
      });
      toastSuccess(tStays("saveAddCharge"));
      chargeForm.reset();
      setActiveTab("tab-charges");
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleExecutePayment = async (values: FolioPaymentFormValues) => {
    try {
      await recordPaymentMutation.mutateAsync({
        stayId: stay.id,
        req: {
          amount: values.amount,
          paymentMethod: values.paymentMethod,
        },
      });
      toastSuccess(tStays("saveRecordPayment"));
      paymentForm.reset();
      setActiveTab("tab-charges");
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleExecuteCheckOut = async () => {
    try {
      const values = checkOutForm.getValues();
      await checkOutMutation.mutateAsync({
        stayId: stay.id,
        req: {
          keyDepositDeductionAmount: values.keyDepositDeduction,
          deductionOrRefundReason: values.deductionReason ?? "",
        },
      });
      toastSuccess(tStays("saveCheckOut"));
      setShowConfirmCheckOut(false);
      setShowCheckOutModal(false);
      router.push("/admin/stays");
    } catch (err) {
      toastApiError(err);
    }
  };

  const isHourly = stay.stayMode === "Hourly";
  const remMinutes = stay.remainingMinutes ?? 0;

  const folioTabs: FormTabItem[] = [
    {
      id: "tab-charges",
      label: tStays("tabCharges"),
      content: (
        <div className="space-y-4 pt-2">
          {stay.folio.charges.length === 0 ? (
            <div className="p-4 text-center text-xs text-mute bg-surface-soft border border-hairline rounded-[12px]">
              No charges posted yet
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {stay.folio.charges.map((chg) => (
                <div
                  key={chg.id}
                  className="flex items-center justify-between p-3 rounded-[12px] border border-hairline bg-surface-soft/40 text-xs font-mono"
                >
                  <div>
                    <span className="font-medium text-ink">
                      {resolveLocalizedText(chg.description, locale)}
                    </span>
                    <Badge variant="outline" className="ml-2 text-[9px] px-1.5 py-0.2">
                      {chg.taxMode}
                    </Badge>
                  </div>
                  <span className="font-bold text-ink tabular-nums">
                    {formatCurrencyThb(chg.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Folio Summary Totals */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-surface-soft border border-hairline rounded-[12px] font-mono text-xs">
            <div>
              <span className="text-[10px] text-mute block">{tStays("totalChargesLabel")}</span>
              <span className="font-semibold text-ink">{formatCurrencyThb(stay.folio.totalCharges)}</span>
            </div>
            <div>
              <span className="text-[10px] text-mute block">{tStays("totalPaymentsLabel")}</span>
              <span className="font-semibold text-ink">{formatCurrencyThb(stay.folio.totalPayments)}</span>
            </div>
            <div>
              <span className="text-[10px] text-mute block">{tStays("balanceDueLabel")}</span>
              <span
                className={`font-bold text-sm ${
                  stay.folio.balanceDue > 0 ? "text-destructive" : "text-primary"
                }`}
              >
                {formatCurrencyThb(stay.folio.balanceDue)}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-add-charge",
      label: tStays("tabAddCharge"),
      content: (
        <form onSubmit={chargeForm.handleSubmit(handleExecuteAddCharge)} className="space-y-4 pt-2">
          <Controller
            name="descriptionTh"
            control={chargeForm.control}
            render={({ field: fieldTh }) => (
              <Controller
                name="descriptionEn"
                control={chargeForm.control}
                render={({ field: fieldEn }) => (
                  <LocalizedTextFields
                    idPrefix="charge-desc"
                    labelTh={tStays("fieldChargeDescTh")}
                    labelEn={tStays("fieldChargeDescEn")}
                    valueTh={fieldTh.value}
                    valueEn={fieldEn.value}
                    onChangeTh={fieldTh.onChange}
                    onChangeEn={fieldEn.onChange}
                    placeholderTh={tStays("fieldChargeDescTh")}
                    placeholderEn={tStays("fieldChargeDescEn")}
                    errorTh={chargeForm.formState.errors.descriptionTh?.message}
                    errorEn={chargeForm.formState.errors.descriptionEn?.message}
                  />
                )}
              />
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="charge-amount" className="text-xs font-medium text-ink">
                {tStays("fieldChargeAmount")}
              </Label>
              <Controller
                name="amount"
                control={chargeForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="charge-amount"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={tStays("fieldChargeAmount")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charge-tax-mode" className="text-xs font-medium text-ink">
                {tStays("fieldTaxMode")}
              </Label>
              <Controller
                name="taxMode"
                control={chargeForm.control}
                render={({ field }) => (
                  <SelectPill
                    id="charge-tax-mode"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value as FolioTaxModeType)}
                    className="h-10 text-xs"
                  >
                    <option value="VatIncluded">VatIncluded (7%)</option>
                    <option value="VatExcluded">VatExcluded (7%)</option>
                    <option value="Exempt">Exempt (0%)</option>
                  </SelectPill>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={addChargeMutation.isPending}
              className="rounded-full text-xs h-9 px-6 font-medium"
            >
              {tStays("saveAddCharge")}
            </Button>
          </div>
        </form>
      ),
    },
    {
      id: "tab-record-payment",
      label: tStays("tabRecordPayment"),
      content: (
        <form onSubmit={paymentForm.handleSubmit(handleExecutePayment)} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount" className="text-xs font-medium text-ink">
                {tStays("fieldPaymentAmount")}
              </Label>
              <Controller
                name="amount"
                control={paymentForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="payment-amount"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={tStays("fieldPaymentAmount")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method" className="text-xs font-medium text-ink">
                {tStays("fieldPaymentMethod")}
              </Label>
              <Controller
                name="paymentMethod"
                control={paymentForm.control}
                render={({ field }) => (
                  <SelectPill
                    id="payment-method"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value as FolioPaymentMethodType)}
                    className="h-10 text-xs"
                  >
                    <option value="Cash">{tStays("methodCash")}</option>
                    <option value="BankTransfer">{tStays("methodBankTransfer")}</option>
                    <option value="PromptPay">{tStays("methodPromptPay")}</option>
                  </SelectPill>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={recordPaymentMutation.isPending}
              className="rounded-full text-xs h-9 px-6 font-medium"
            >
              {tStays("saveRecordPayment")}
            </Button>
          </div>
        </form>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${stay.documentNumber} — Unit ${stay.unit.unitNumber}`}
        subtitle={`${stay.customer.fullName} • ${tModes(stay.stayMode)}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/stays">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>

            {stay.status === "Active" && isHourly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowExtendModal(true)}
                className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
              >
                <Clock className="h-4 w-4" />
                <span>+ {tStays("actionExtend")}</span>
              </Button>
            )}

            {stay.status === "Active" && (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowCheckOutModal(true)}
                className="rounded-full text-xs h-9 px-5 gap-1.5 bg-ink text-canvas hover:bg-neutral-800"
              >
                <LogOut className="h-4 w-4" />
                <span>{tStays("actionCheckOut")}</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Info Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 rounded-[12px] border border-hairline bg-canvas font-mono text-xs">
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Status</span>
          <Badge variant={stay.status === "Active" ? "default" : "outline"} className="rounded-full">
            {stay.status}
          </Badge>
        </div>
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Timer</span>
          {isHourly ? (
            <span className="font-semibold">
              {stay.isOvertime ? tStays("overtimeBadge", { minutes: Math.abs(remMinutes) }) : `${remMinutes}m remaining`}
            </span>
          ) : (
            <span>Daily Stay</span>
          )}
        </div>
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Deposit</span>
          <span className="font-semibold text-primary">{formatCurrencyThb(stay.keyDepositBalance)}</span>
        </div>
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Folio Balance Due</span>
          <span className={`font-bold ${stay.folio.balanceDue > 0 ? "text-destructive" : "text-primary"}`}>
            {formatCurrencyThb(stay.folio.balanceDue)}
          </span>
        </div>
      </div>

      {/* Folio Management */}
      <FormSection
        title={
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span>Guest Folio & Settlement</span>
          </div>
        }
      >
        <FormTabs tabs={folioTabs} value={activeTab} onValueChange={setActiveTab} />
      </FormSection>

      {/* Extend Modal */}
      <ConfirmationModal
        isOpen={showConfirmExtend}
        onClose={() => setShowConfirmExtend(false)}
        onConfirm={handleExecuteExtend}
        title={tStays("confirmExtendTitle")}
        message={tStays("confirmExtendMessage")}
        confirmText={tStays("saveExtend")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={extendMutation.isPending}
      />

      {/* Check-Out Dialog */}
      <Dialog open={showCheckOutModal} onOpenChange={setShowCheckOutModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tStays("confirmCheckOutTitle")}</DialogTitle>
            <DialogDescription>{tStays("confirmCheckOutMessage")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="checkout-deduction-amount" className="text-xs font-medium text-ink">
                {tStays("fieldDeductionAmount")}
              </Label>
              <Controller
                name="keyDepositDeduction"
                control={checkOutForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="checkout-deduction-amount"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={tStays("fieldDeductionAmount")}
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkout-deduction-reason" className="text-xs font-medium text-ink">
                {tStays("fieldDeductionReason")}
              </Label>
              <Controller
                name="deductionReason"
                control={checkOutForm.control}
                render={({ field }) => (
                  <Textarea
                    id="checkout-deduction-reason"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder={tStays("deductionReasonPlaceholder")}
                    className="min-h-[80px] text-xs"
                  />
                )}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-hairline">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCheckOutModal(false)}
              className="rounded-full text-xs h-9 px-4"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowCheckOutModal(false);
                setShowConfirmCheckOut(true);
              }}
              className="rounded-full text-xs h-9 px-5 bg-ink text-canvas hover:bg-neutral-800"
            >
              {tStays("actionCheckOut")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check-Out Modal */}
      <ConfirmationModal
        isOpen={showConfirmCheckOut}
        onClose={() => setShowConfirmCheckOut(false)}
        onConfirm={handleExecuteCheckOut}
        title={tStays("confirmCheckOutTitle")}
        message={tStays("confirmCheckOutMessage")}
        confirmText={tStays("saveCheckOut")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={checkOutMutation.isPending}
      />
    </div>
  );
}
