"use client";

import React from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { Alert } from "@/components/ui/alert";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/forms/currency-input";
import { NumberInput } from "@/components/forms/number-input";
import { FormField } from "@/components/forms/form-field";
import { useToast } from "@/hooks/use-toast";
import { moneyAmountSchema } from "@/lib/validators";
import { formatCurrencyThb, formatDecimal } from "@/lib/formatters";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { useSimulateRateMutation } from "../api/use-rates";
import type { RatePlanItemDto, TaxProfileItemDto, RateSimulationResponse } from "../types";

const simulatorSchema = z.object({
  ratePlanId: z.string().min(1, "Select a rate plan"),
  taxProfileId: z.string().min(1, "Select a tax profile"),
  durationMinutes: z.number().int().min(1),
  occupantCount: z.number().int().min(1).max(20),
  waterPreviousReading: z.number().min(0),
  waterCurrentReading: z.number().min(0),
  waterRolloverConfirmed: z.boolean(),
  electricPreviousReading: z.number().min(0),
  electricCurrentReading: z.number().min(0),
  electricRolloverConfirmed: z.boolean(),
  sampleLineAmount: moneyAmountSchema,
  applyWithholdingTax: z.boolean(),
});
type SimulatorValues = z.infer<typeof simulatorSchema>;

const DEFAULTS: SimulatorValues = {
  ratePlanId: "",
  taxProfileId: "",
  durationMinutes: 180,
  occupantCount: 1,
  waterPreviousReading: 0,
  waterCurrentReading: 0,
  waterRolloverConfirmed: false,
  electricPreviousReading: 0,
  electricCurrentReading: 0,
  electricRolloverConfirmed: false,
  sampleLineAmount: 1000,
  applyWithholdingTax: false,
};

export interface RateSimulatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  plans: RatePlanItemDto[];
  taxProfiles: TaxProfileItemDto[];
}

/** Quote and tax simulator: every figure shown comes from the backend response, nothing is calculated here. */
export function RateSimulatorDialog({ open, onOpenChange, propertyId, plans, taxProfiles }: RateSimulatorDialogProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.rates");
  const tCommon = useTranslations("common");
  const { toastApiError } = useToast();
  const mutation = useSimulateRateMutation(propertyId);
  const form = useForm<SimulatorValues>({ resolver: zodResolver(simulatorSchema), defaultValues: DEFAULTS });
  const result: RateSimulationResponse | undefined = mutation.data;

  const submit = form.handleSubmit(async (v) => {
    if (mutation.isPending) return;
    try {
      await mutation.mutateAsync(v);
    } catch (err) {
      toastApiError(err);
    }
  });

  const num = (name: keyof SimulatorValues, label: string, decimals = 0) => (
    <FormField id={`sim-${name}`} label={label}>
      <Controller
        name={name}
        control={form.control}
        render={({ field }) => (
          <NumberInput id={`sim-${name}`} value={Number(field.value)} onValueChange={field.onChange} decimals={decimals} min={0} placeholder={label} disabled={mutation.isPending} wrapperClassName="!mb-0" />
        )}
      />
    </FormField>
  );
  const check = (name: "waterRolloverConfirmed" | "electricRolloverConfirmed" | "applyWithholdingTax", label: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field }) => (
        <div className="flex items-center gap-2">
          <Checkbox id={`sim-${name}`} checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
          <Label htmlFor={`sim-${name}`} className="text-xs">{label}</Label>
        </div>
      )}
    />
  );
  const row = (label: string, value: string, testId?: string) => (
    <div className="flex items-center justify-between gap-3 border-b border-hairline py-1 text-xs">
      <span className="text-body">{label}</span>
      <span className="font-mono tabular-nums text-ink" data-testid={testId}>{value}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("simTitle")}</DialogTitle>
          <DialogDescription>{t("simDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="sim-plan" label={t("selectRatePlan")} required error={form.formState.errors.ratePlanId ? tCommon("required") : undefined}>
              <SelectPill id="sim-plan" disabled={mutation.isPending} wrapperClassName="!mb-0" {...form.register("ratePlanId")}>
                <option value="">{t("selectRatePlan")}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {resolveLocalizedText(p.name, locale)}
                  </option>
                ))}
              </SelectPill>
            </FormField>
            <FormField id="sim-tax" label={t("selectTaxProfile")} required error={form.formState.errors.taxProfileId ? tCommon("required") : undefined}>
              <SelectPill id="sim-tax" disabled={mutation.isPending} wrapperClassName="!mb-0" {...form.register("taxProfileId")}>
                <option value="">{t("selectTaxProfile")}</option>
                {taxProfiles.map((x) => (
                  <option key={x.id} value={x.id}>
                    {resolveLocalizedText(x.name, locale)} ({t(`taxMode${x.taxMode}`)})
                  </option>
                ))}
              </SelectPill>
            </FormField>
            {num("durationMinutes", t("durationMinutesLabel"))}
            {num("occupantCount", t("fieldOccupantCount"))}
            {num("waterPreviousReading", `${t("waterType")} - ${t("prevReadingLabel")}`, 2)}
            {num("waterCurrentReading", `${t("waterType")} - ${t("currReadingLabel")}`, 2)}
            {num("electricPreviousReading", `${t("electricType")} - ${t("prevReadingLabel")}`, 2)}
            {num("electricCurrentReading", `${t("electricType")} - ${t("currReadingLabel")}`, 2)}
            <FormField id="sim-sampleLineAmount" label={t("sampleLineAmountLabel")}>
              <Controller name="sampleLineAmount" control={form.control} render={({ field }) => (
                <CurrencyInput id="sim-sampleLineAmount" value={field.value} onValueChange={field.onChange} placeholder={t("sampleLineAmountLabel")} disabled={mutation.isPending} wrapperClassName="!mb-0" />
              )} />
            </FormField>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {check("waterRolloverConfirmed", `${t("waterType")} - ${t("confirmRolloverLabel")}`)}
            {check("electricRolloverConfirmed", `${t("electricType")} - ${t("confirmRolloverLabel")}`)}
            {check("applyWithholdingTax", t("applyWhtLabel"))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {t("closeSimulator")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-full">
              {mutation.isPending ? tCommon("loading") : t("btnSimulate")}
            </Button>
          </div>
        </form>

        {mutation.isPending && <MonoSpinner label={tCommon("loading")} />}
        {mutation.isError && (
          <Alert variant="danger" data-testid="sim-error">
            <span>{t("simError")} </span>
            <Button type="button" size="sm" variant="outline" onClick={() => void submit()} className="h-7 rounded-full px-3 text-xs">
              {tCommon("retry")}
            </Button>
          </Alert>
        )}
        {result && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="sim-result">
            <section className="space-y-1 rounded-[12px] border border-hairline p-4">
              <h4 className="text-xs font-semibold text-ink">{t("simSectionHourly")}</h4>
              {row(t("extraHoursResult"), String(result.hourlyQuote.extraHours))}
              {row(t("rawChargeResult"), formatCurrencyThb(result.hourlyQuote.rawCharge))}
              {row(t("finalChargeResult"), formatCurrencyThb(result.hourlyQuote.finalHourlyRoomCharge), "sim-final-charge")}
              {result.hourlyQuote.isCappedToDailyRate && <Badge variant="warning">{t("cappedNotice")}</Badge>}
            </section>
            <section className="space-y-1 rounded-[12px] border border-hairline p-4">
              <h4 className="text-xs font-semibold text-ink">{t("simSectionUtility")}</h4>
              {[result.waterQuote, result.electricQuote].map((q) => (
                <div key={q.utilityType}>
                  {row(`${q.utilityType === "Water" ? t("waterType") : t("electricType")} - ${t("usageUnitsResult")}`, formatDecimal(q.usageUnits))}
                  {row(t("utilityChargeResult"), formatCurrencyThb(q.chargeAmount), `sim-${q.utilityType}-charge`)}
                  {q.usedRollover && <Badge variant="warning">{t("rolloverWarning")}</Badge>}
                </div>
              ))}
            </section>
            <section className="space-y-1 rounded-[12px] border border-hairline p-4 sm:col-span-2">
              <h4 className="text-xs font-semibold text-ink">{t("simSectionTax")}</h4>
              {row(t("subTotalResult"), formatCurrencyThb(result.taxQuote.subTotal))}
              {row(`${t("vatResult")} (${result.taxQuote.vatRatePercent}%)`, formatCurrencyThb(result.taxQuote.vatAmount), "sim-vat")}
              {row(t("invoiceTotalResult"), formatCurrencyThb(result.taxQuote.invoiceTotal))}
              {row(`${t("whtResult")} (${result.taxQuote.withholdingTaxPercent}%)`, formatCurrencyThb(result.taxQuote.withholdingTaxAmount), "sim-wht")}
              {row(t("netPayableResult"), formatCurrencyThb(result.taxQuote.netPayable), "sim-net")}
            </section>
          </div>
        )}
        <DialogFooter className="sr-only" />
      </DialogContent>
    </Dialog>
  );
}
