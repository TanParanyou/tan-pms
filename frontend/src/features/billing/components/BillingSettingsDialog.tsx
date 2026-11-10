"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import type { BillingSettingsDto } from "@/features/client/types";
import { useBillingSettings, useUpdateBillingSettingsMutation } from "../api/use-billing";
import { PERMISSION_PROPERTIES_MANAGE_BILLING_SETTINGS, MAX_PAYMENT_TERMS_DAYS } from "../constants";

const settingsSchema = z.object({
  paymentTermsDays: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= MAX_PAYMENT_TERMS_DAYS), "Payment terms must be between 0 and 365 days"),
});
type SettingsValues = z.infer<typeof settingsSchema>;

export interface BillingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function BillingSettingsDialog({ open, onOpenChange, propertyId }: BillingSettingsDialogProps) {
  const t = useTranslations("admin.billing");
  const tCommon = useTranslations("common");
  const query = useBillingSettings(propertyId, open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settingsTitle")}</DialogTitle>
          <DialogDescription>{t("settingsDescription")}</DialogDescription>
        </DialogHeader>
        {query.isLoading && <MonoSpinner label={tCommon("loading")} />}
        {query.isError && <EmptyState title={t("settingsLoadError")} actionLabel={tCommon("retry")} onAction={() => void query.refetch()} />}
        {query.data && <SettingsForm propertyId={propertyId} settings={query.data} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ propertyId, settings, onDone }: { propertyId: string; settings: BillingSettingsDto; onDone: () => void }) {
  const t = useTranslations("admin.billing");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canEdit = hasPermission(PERMISSION_PROPERTIES_MANAGE_BILLING_SETTINGS);
  const mutation = useUpdateBillingSettingsMutation(propertyId);
  const inFlight = useRef(false);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { paymentTermsDays: settings.paymentTermsDays == null ? "" : String(settings.paymentTermsDays) },
  });
  useUnsavedChanges(form.formState.isDirty);

  const submit = form.handleSubmit(async (v) => {
    if (mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({ paymentTermsDays: v.paymentTermsDays === "" ? null : Number(v.paymentTermsDays) });
      toastSuccess(t("settingsSaved"));
      form.reset(v);
      onDone();
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField
        id="billing-terms"
        label={t("fieldPaymentTerms")}
        helperText={t("paymentTermsHint")}
        error={form.formState.errors.paymentTermsDays ? t("errorPaymentTerms") : undefined}
      >
        <Input
          id="billing-terms"
          inputMode="numeric"
          placeholder={t("placeholderPaymentTerms")}
          disabled={!canEdit || mutation.isPending}
          className="h-10 rounded-full font-mono text-sm"
          {...form.register("paymentTermsDays")}
        />
      </FormField>
      <p className="text-xs text-body" data-testid="effective-terms">
        {t("effectiveTerms", { days: settings.effectivePaymentTermsDays })}
      </p>
      {!canEdit && <p className="text-xs text-mute">{t("settingsReadOnly")}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} className="rounded-full">
          {tCommon("cancel")}
        </Button>
        {canEdit && (
          <Button type="submit" disabled={mutation.isPending} className="rounded-full">
            {mutation.isPending ? tCommon("loading") : tCommon("save")}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}
