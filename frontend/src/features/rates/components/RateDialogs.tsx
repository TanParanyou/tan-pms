"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/forms/currency-input";
import { NumberInput } from "@/components/forms/number-input";
import { FormField } from "@/components/forms/form-field";
import { LocalizedTextFields } from "@/components/forms/localized-text-fields";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { toLocalizedText } from "@/lib/i18n/localized-text";
import {
  useUpsertUtilityTariffMutation,
  useUpsertTaxProfileMutation,
  useUtilityTariffDetail,
  useTaxProfileDetail,
} from "../api/use-rates";
import {
  utilityTariffSchema,
  taxProfileSchema,
  type UtilityTariffFormValues,
  type TaxProfileFormValues,
} from "../schemas/rate-schemas";
import {
  BILLING_MODES,
  SYSTEM_CHARGE_CATEGORIES,
  TARIFF_FORM_DEFAULTS,
  TAX_FORM_DEFAULTS,
  TAX_MODES,
  UTILITY_TYPES,
} from "../constants";
import type { TaxProfileItemDto, UtilityTariffItemDto } from "../types";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  /** Existing record id (GET single is used to load it) or null to create. */
  id: string | null;
}

function Footer({ onCancel, isBusy, label }: { onCancel: () => void; isBusy: boolean; label: string }) {
  const tCommon = useTranslations("common");
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel} className="rounded-full">
        {tCommon("cancel")}
      </Button>
      <Button type="submit" disabled={isBusy} className="rounded-full">
        {isBusy ? tCommon("loading") : label}
      </Button>
    </DialogFooter>
  );
}

export function UtilityTariffDialog({ open, onOpenChange, propertyId, id }: DialogProps) {
  const t = useTranslations("admin.rates");
  const detail = useUtilityTariffDetail(propertyId, open ? id : null);
  const tCommon = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{id ? t("modalTitleEditTariff") : t("modalTitleCreateTariff")}</DialogTitle>
        </DialogHeader>
        {id && detail.isLoading && <MonoSpinner label={tCommon("loading")} />}
        {id && detail.isError && <EmptyState title={t("loadTariffError")} actionLabel={tCommon("retry")} onAction={() => void detail.refetch()} />}
        {(!id || detail.data) && open && (
          <TariffForm propertyId={propertyId} tariff={detail.data} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TariffForm({ propertyId, tariff, onDone }: { propertyId: string; tariff?: UtilityTariffItemDto; onDone: () => void }) {
  const t = useTranslations("admin.rates");
  const tL = useTranslations("common.localized");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useUpsertUtilityTariffMutation(propertyId);
  const inFlight = useRef(false);
  const form = useForm<UtilityTariffFormValues>({
    resolver: zodResolver(utilityTariffSchema),
    defaultValues: tariff
      ? {
          utilityType: tariff.utilityType,
          nameTh: tariff.name.th,
          nameEn: tariff.name.en ?? "",
          billingMode: tariff.billingMode,
          ratePerUnit: tariff.ratePerUnit,
          minimumChargeAmount: tariff.minimumChargeAmount,
          includedUnits: tariff.includedUnits,
          baseMinimumAmount: tariff.baseMinimumAmount,
          flatRateAmount: tariff.flatRateAmount,
          flatRatePerOccupant: tariff.flatRatePerOccupant,
          meterMaxDigits: tariff.meterMaxDigits,
        }
      : TARIFF_FORM_DEFAULTS,
  });
  useUnsavedChanges(form.formState.isDirty);
  const submit = form.handleSubmit(async (v) => {
    if (mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({ ...v, name: toLocalizedText(v.nameTh, v.nameEn) });
      toastSuccess(t("toastTariffSaved"));
      onDone();
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });
  const money = (name: "ratePerUnit" | "minimumChargeAmount" | "baseMinimumAmount" | "flatRateAmount", label: string) => (
    <FormField id={`tf-${name}`} label={label}>
      <Controller name={name} control={form.control} render={({ field }) => (
        <CurrencyInput id={`tf-${name}`} value={field.value} onValueChange={field.onChange} placeholder={label} wrapperClassName="!mb-0" />
      )} />
    </FormField>
  );
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField id="tf-type" label={t("colUtilityType")}>
          <SelectPill id="tf-type" disabled={Boolean(tariff) || mutation.isPending} wrapperClassName="!mb-0" {...form.register("utilityType")}>
            {UTILITY_TYPES.map((u) => (
              <option key={u} value={u}>
                {u === "Water" ? t("waterType") : t("electricType")}
              </option>
            ))}
          </SelectPill>
        </FormField>
        <FormField id="tf-mode" label={t("fieldBillingMode")}>
          <SelectPill id="tf-mode" disabled={mutation.isPending} wrapperClassName="!mb-0" {...form.register("billingMode")}>
            {BILLING_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`billingMode${m}`)}
              </option>
            ))}
          </SelectPill>
        </FormField>
      </div>
      <LocalizedTextFields
        idPrefix="tf-name"
        labelTh={tL("labelNameTh")}
        labelEn={tL("labelNameEn")}
        valueTh={form.watch("nameTh")}
        valueEn={form.watch("nameEn") ?? ""}
        onChangeTh={(v) => form.setValue("nameTh", v, { shouldDirty: true, shouldValidate: true })}
        onChangeEn={(v) => form.setValue("nameEn", v, { shouldDirty: true })}
        placeholderTh={tL("placeholderTh")}
        placeholderEn={tL("placeholderEn")}
        errorTh={form.formState.errors.nameTh ? tL("errorThaiRequired") : undefined}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {money("ratePerUnit", t("fieldRatePerUnit"))}
        {money("minimumChargeAmount", t("fieldMinimumChargeAmount"))}
        {money("baseMinimumAmount", t("fieldBaseMinimumAmount"))}
        {money("flatRateAmount", t("fieldFlatRateAmount"))}
        <FormField id="tf-included" label={t("fieldIncludedUnits")}>
          <Controller name="includedUnits" control={form.control} render={({ field }) => (
            <NumberInput id="tf-included" value={field.value} onValueChange={field.onChange} decimals={2} min={0} placeholder={t("fieldIncludedUnits")} wrapperClassName="!mb-0" />
          )} />
        </FormField>
        <FormField id="tf-digits" label={t("fieldMeterMaxDigits")}>
          <Controller name="meterMaxDigits" control={form.control} render={({ field }) => (
            <NumberInput id="tf-digits" value={field.value} onValueChange={field.onChange} decimals={0} min={1} max={12} placeholder={t("fieldMeterMaxDigits")} wrapperClassName="!mb-0" />
          )} />
        </FormField>
      </div>
      <Controller name="flatRatePerOccupant" control={form.control} render={({ field }) => (
        <div className="flex items-center gap-2">
          <Switch id="tf-per-occupant" checked={field.value} onCheckedChange={field.onChange} />
          <Label htmlFor="tf-per-occupant" className="text-xs">{t("fieldFlatRatePerOccupant")}</Label>
        </div>
      )} />
      <Footer onCancel={onDone} isBusy={mutation.isPending} label={tCommon("save")} />
    </form>
  );
}

export function TaxProfileDialog({ open, onOpenChange, propertyId, id }: DialogProps) {
  const t = useTranslations("admin.rates");
  const tCommon = useTranslations("common");
  const detail = useTaxProfileDetail(propertyId, open ? id : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{id ? t("modalTitleEditTax") : t("modalTitleCreateTax")}</DialogTitle>
        </DialogHeader>
        {id && detail.isLoading && <MonoSpinner label={tCommon("loading")} />}
        {id && detail.isError && <EmptyState title={t("loadTaxError")} actionLabel={tCommon("retry")} onAction={() => void detail.refetch()} />}
        {(!id || detail.data) && open && <TaxForm propertyId={propertyId} tax={detail.data} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TaxForm({ propertyId, tax, onDone }: { propertyId: string; tax?: TaxProfileItemDto; onDone: () => void }) {
  const t = useTranslations("admin.rates");
  const tL = useTranslations("common.localized");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useUpsertTaxProfileMutation(propertyId);
  const inFlight = useRef(false);
  const isSystemCategory = Boolean(
    tax && SYSTEM_CHARGE_CATEGORIES.includes(tax.chargeCategoryCode as (typeof SYSTEM_CHARGE_CATEGORIES)[number])
  );
  const form = useForm<TaxProfileFormValues>({
    resolver: zodResolver(taxProfileSchema),
    defaultValues: tax
      ? {
          chargeCategoryCode: tax.chargeCategoryCode,
          nameTh: tax.name.th,
          nameEn: tax.name.en ?? "",
          taxMode: tax.taxMode,
          vatRatePercent: tax.vatRatePercent,
          defaultWithholdingTaxPercent: tax.defaultWithholdingTaxPercent,
          isActive: tax.isActive,
        }
      : TAX_FORM_DEFAULTS,
  });
  useUnsavedChanges(form.formState.isDirty);
  const submit = form.handleSubmit(async (v) => {
    if (mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({
        id: tax?.id,
        chargeCategoryCode: isSystemCategory && tax ? tax.chargeCategoryCode : v.chargeCategoryCode,
        name: toLocalizedText(v.nameTh, v.nameEn),
        taxMode: v.taxMode,
        vatRatePercent: v.vatRatePercent,
        defaultWithholdingTaxPercent: v.defaultWithholdingTaxPercent,
        isActive: v.isActive,
      });
      toastSuccess(t("toastTaxSaved"));
      onDone();
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });
  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField id="tx-category" label={t("colChargeCategory")} required error={form.formState.errors.chargeCategoryCode ? tCommon("required") : undefined}>
        <Input
          id="tx-category"
          placeholder={t("placeholderCode")}
          disabled={isSystemCategory || mutation.isPending}
          className="h-10 rounded-full font-mono text-xs"
          {...form.register("chargeCategoryCode")}
        />
      </FormField>
      <LocalizedTextFields
        idPrefix="tx-name"
        labelTh={tL("labelNameTh")}
        labelEn={tL("labelNameEn")}
        valueTh={form.watch("nameTh")}
        valueEn={form.watch("nameEn") ?? ""}
        onChangeTh={(v) => form.setValue("nameTh", v, { shouldDirty: true, shouldValidate: true })}
        onChangeEn={(v) => form.setValue("nameEn", v, { shouldDirty: true })}
        placeholderTh={tL("placeholderTh")}
        placeholderEn={tL("placeholderEn")}
        errorTh={form.formState.errors.nameTh ? tL("errorThaiRequired") : undefined}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField id="tx-mode" label={t("fieldTaxMode")}>
          <SelectPill id="tx-mode" disabled={mutation.isPending} wrapperClassName="!mb-0" {...form.register("taxMode")}>
            {TAX_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`taxMode${m}`)}
              </option>
            ))}
          </SelectPill>
        </FormField>
        <FormField id="tx-vat" label={t("fieldVatRatePercent")}>
          <Controller name="vatRatePercent" control={form.control} render={({ field }) => (
            <NumberInput id="tx-vat" value={field.value} onValueChange={field.onChange} decimals={2} min={0} max={100} placeholder={t("fieldVatRatePercent")} wrapperClassName="!mb-0" />
          )} />
        </FormField>
        <FormField id="tx-wht" label={t("fieldDefaultWhtPercent")}>
          <Controller name="defaultWithholdingTaxPercent" control={form.control} render={({ field }) => (
            <NumberInput id="tx-wht" value={field.value} onValueChange={field.onChange} decimals={2} min={0} max={100} placeholder={t("fieldDefaultWhtPercent")} wrapperClassName="!mb-0" />
          )} />
        </FormField>
      </div>
      <Controller name="isActive" control={form.control} render={({ field }) => (
        <div className="flex items-center gap-2">
          <Switch id="tx-active" checked={field.value} onCheckedChange={field.onChange} />
          <Label htmlFor="tx-active" className="text-xs">{t("fieldIsActive")}</Label>
        </div>
      )} />
      <Footer onCancel={onDone} isBusy={mutation.isPending} label={tCommon("save")} />
    </form>
  );
}
