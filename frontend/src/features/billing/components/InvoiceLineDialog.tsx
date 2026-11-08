"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { SelectPill } from "@/components/ui/select-pill";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormField } from "@/components/forms/form-field";
import { LocalizedTextFields } from "@/components/forms/localized-text-fields";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useAddInvoiceLineMutation, useUpdateInvoiceLineMutation } from "../api/use-billing";
import { invoiceLineSchema, type InvoiceLineFormValues } from "../schemas/billing-schemas";
import { INVOICE_LINE_DEFAULTS, TAX_MODE_OPTIONS } from "../constants";
import type { InvoiceLineDto, TaxModeType } from "../types";

export interface InvoiceLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  invoiceId: string;
  /** null = add a new line, otherwise edit this line. */
  line: InvoiceLineDto | null;
}

export function InvoiceLineDialog({ open, onOpenChange, propertyId, invoiceId, line }: InvoiceLineDialogProps) {
  const t = useTranslations("admin.billing");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const addMutation = useAddInvoiceLineMutation(propertyId);
  const updateMutation = useUpdateInvoiceLineMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy = addMutation.isPending || updateMutation.isPending;

  const form = useForm<InvoiceLineFormValues>({
    resolver: zodResolver(invoiceLineSchema),
    values: line
      ? {
          descriptionTh: line.description.th,
          descriptionEn: line.description.en ?? "",
          lineAmount: line.lineAmount,
          taxMode: line.taxMode as TaxModeType,
        }
      : INVOICE_LINE_DEFAULTS,
  });
  useUnsavedChanges(open && form.formState.isDirty);

  const submit = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    const req = {
      description: { th: v.descriptionTh, en: v.descriptionEn || undefined },
      lineAmount: v.lineAmount,
      taxMode: v.taxMode,
    };
    try {
      if (line) {
        await updateMutation.mutateAsync({ invoiceId, lineId: line.id, req });
        toastSuccess(t("toastLineUpdated"));
      } else {
        await addMutation.mutateAsync({ invoiceId, req });
        toastSuccess(t("toastLineAdded"));
      }
      form.reset(INVOICE_LINE_DEFAULTS);
      onOpenChange(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{line ? t("editLineTitle") : t("addLineTitle")}</DialogTitle>
          <DialogDescription>{t("lineDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Controller
            control={form.control}
            name="descriptionTh"
            render={({ field: thField }) => (
              <Controller
                control={form.control}
                name="descriptionEn"
                render={({ field: enField }) => (
                  <LocalizedTextFields
                    idPrefix="invoice-line-desc"
                    labelTh={t("fieldDescriptionTh")}
                    labelEn={t("fieldDescriptionEn")}
                    valueTh={thField.value}
                    valueEn={enField.value ?? ""}
                    onChangeTh={thField.onChange}
                    onChangeEn={enField.onChange}
                    placeholderTh={t("placeholderDescriptionTh")}
                    placeholderEn={t("placeholderDescriptionEn")}
                    errorTh={form.formState.errors.descriptionTh ? t("errorDescriptionRequired") : undefined}
                  />
                )}
              />
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="line-amount" label={t("fieldLineAmount")} required error={form.formState.errors.lineAmount?.message}>
              <Controller
                name="lineAmount"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="line-amount"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldLineAmount")}
                    hasError={Boolean(form.formState.errors.lineAmount)}
                  />
                )}
              />
            </FormField>
            <FormField id="line-tax" label={t("fieldTaxMode")} required>
              <SelectPill id="line-tax" wrapperClassName="!mb-0" {...form.register("taxMode")}>
                {TAX_MODE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {t(`taxMode.${m}`)}
                  </option>
                ))}
              </SelectPill>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isBusy} className="rounded-full">
              {isBusy ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
