"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/forms/currency-input";
import { NumberInput } from "@/components/forms/number-input";
import { FormField } from "@/components/forms/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useUpdateLeaseMutation } from "../api/use-leases";
import { leaseEditSchema, type LeaseEditFormValues } from "../schemas/lease-schemas";
import type { LeaseItemDto } from "../types";

export interface LeaseEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  lease: LeaseItemDto;
}

export function LeaseEditDialog({ open, onOpenChange, propertyId, lease }: LeaseEditDialogProps) {
  const t = useTranslations("admin.leases");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useUpdateLeaseMutation(propertyId);
  const inFlight = useRef(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const form = useForm<LeaseEditFormValues>({
    resolver: zodResolver(leaseEditSchema),
    values: {
      monthlyRentAmount: lease.monthlyRentAmount,
      initialWaterMeterReading: lease.initialWaterMeterReading,
      initialElectricMeterReading: lease.initialElectricMeterReading,
      reason: "",
    },
  });
  useUnsavedChanges(open && form.formState.isDirty);

  const execute = async () => {
    if (mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    const v = form.getValues();
    try {
      await mutation.mutateAsync({
        leaseId: lease.id,
        req: {
          monthlyRentAmount: v.monthlyRentAmount,
          initialWaterMeterReading: v.initialWaterMeterReading,
          initialElectricMeterReading: v.initialElectricMeterReading,
          reason: v.reason,
        },
      });
      toastSuccess(t("toastLeaseUpdated"));
      setShowConfirm(false);
      onOpenChange(false);
    } catch (err) {
      setShowConfirm(false);
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editLeaseTitle")}</DialogTitle>
            <DialogDescription>{t("editLeaseDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField id="edit-rent" label={t("fieldMonthlyRent")} required error={form.formState.errors.monthlyRentAmount?.message}>
              <Controller
                name="monthlyRentAmount"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="edit-rent"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldMonthlyRent")}
                    hasError={Boolean(form.formState.errors.monthlyRentAmount)}
                  />
                )}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="edit-water" label={t("fieldWaterReading")} required error={form.formState.errors.initialWaterMeterReading?.message}>
                <Controller
                  name="initialWaterMeterReading"
                  control={form.control}
                  render={({ field }) => (
                    <NumberInput
                      id="edit-water"
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t("fieldWaterReading")}
                      hasError={Boolean(form.formState.errors.initialWaterMeterReading)}
                    />
                  )}
                />
              </FormField>
              <FormField id="edit-electric" label={t("fieldElectricReading")} required error={form.formState.errors.initialElectricMeterReading?.message}>
                <Controller
                  name="initialElectricMeterReading"
                  control={form.control}
                  render={({ field }) => (
                    <NumberInput
                      id="edit-electric"
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t("fieldElectricReading")}
                      hasError={Boolean(form.formState.errors.initialElectricMeterReading)}
                    />
                  )}
                />
              </FormField>
            </div>
            <FormField id="edit-reason" label={t("fieldEditReason")} required error={form.formState.errors.reason ? t("errorReasonRequired") : undefined}>
              <Textarea id="edit-reason" placeholder={t("placeholderEditReason")} {...form.register("reason")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={form.handleSubmit(() => setShowConfirm(true))}
              className="rounded-full"
            >
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={execute}
        title={t("confirmEditLeaseTitle")}
        message={t("confirmEditLeaseMessage")}
        confirmText={tCommon("save")}
        variant="warning"
        isLoading={mutation.isPending}
      />
    </>
  );
}
