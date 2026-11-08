"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectPill } from "@/components/ui/select-pill";
import { DateTimeInput } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useCreateLeaseIntentMutation, useUpdateLeaseIntentMutation } from "../api/use-client-leases";
import { leaseIntentSchema, type LeaseIntentFormValues } from "../schemas/client-schemas";
import { CLIENT_INTENT_DEFAULTS, LEASE_INTENT_TYPES } from "../constants";
import type { LeaseIntentDto, LeaseIntentType } from "../types";

export interface LeaseIntentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseId: string;
  leaseDocumentNumber: string;
  /** When set the dialog edits this Pending intent (type is fixed); otherwise it creates one. */
  intent?: LeaseIntentDto | null;
  defaultType?: LeaseIntentType;
}

export function LeaseIntentDialog({
  open,
  onOpenChange,
  leaseId,
  leaseDocumentNumber,
  intent,
  defaultType = "Renew",
}: LeaseIntentDialogProps) {
  const t = useTranslations("client.portal.intent");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const createMutation = useCreateLeaseIntentMutation();
  const updateMutation = useUpdateLeaseIntentMutation();
  const inFlight = useRef(false);
  const isEdit = Boolean(intent);
  const isBusy = createMutation.isPending || updateMutation.isPending;

  const form = useForm<LeaseIntentFormValues>({
    resolver: zodResolver(leaseIntentSchema),
    values: intent
      ? {
          intentType: intent.intentType as LeaseIntentType,
          desiredDate: intent.desiredDate,
          note: intent.note ?? "",
        }
      : { ...CLIENT_INTENT_DEFAULTS, intentType: defaultType },
  });
  useUnsavedChanges(open && form.formState.isDirty);

  const submit = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      if (intent) {
        await updateMutation.mutateAsync({
          intentId: intent.id,
          req: { desiredDate: v.desiredDate, note: v.note || undefined },
        });
        toastSuccess(t("toastUpdated"));
      } else {
        await createMutation.mutateAsync({
          leaseId,
          req: { intentType: v.intentType, desiredDate: v.desiredDate, note: v.note || undefined },
        });
        toastSuccess(t("toastCreated"));
      }
      form.reset({ ...CLIENT_INTENT_DEFAULTS, intentType: defaultType });
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
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{leaseDocumentNumber}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField id="intent-type" label={t("fieldType")} required>
            <SelectPill id="intent-type" disabled={isEdit || isBusy} wrapperClassName="!mb-0" {...form.register("intentType")}>
              {LEASE_INTENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}`)}
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField
            id="intent-date"
            label={t("fieldDesiredDate")}
            required
            error={form.formState.errors.desiredDate ? t("errorDateRequired") : undefined}
          >
            <Controller
              name="desiredDate"
              control={form.control}
              render={({ field }) => (
                <DateTimeInput
                  id="intent-date"
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isBusy}
                  hasError={Boolean(form.formState.errors.desiredDate)}
                  placeholder={t("placeholderDate")}
                />
              )}
            />
          </FormField>
          <FormField id="intent-note" label={t("fieldNote")}>
            <Textarea id="intent-note" placeholder={t("placeholderNote")} disabled={isBusy} {...form.register("note")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isBusy} className="rounded-full">
              {isBusy ? tCommon("loading") : isEdit ? tCommon("save") : t("btnSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
