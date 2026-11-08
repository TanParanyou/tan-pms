"use client";

import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-picker";
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
import { PhotoAttachmentField } from "@/components/forms/photo-attachment-field";
import { useStagedPhoto } from "@/hooks/use-staged-photo";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useSubmitSlipMutation, useUpdateSlipMutation } from "../api/use-client-invoices";
import { buildSlipSchema, type SlipFormValues } from "../schemas/client-schemas";
import { CLIENT_SLIP_DEFAULTS } from "../constants";
import type { ClientPaymentSlipDto } from "../types";

export interface SlipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceDocumentNumber: string;
  outstanding: number;
  /** Pending slip to edit; omit to submit a new slip. */
  slip?: ClientPaymentSlipDto | null;
}

const toLocalInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 16) : "");

export function SlipDialog({ open, onOpenChange, invoiceId, invoiceDocumentNumber, outstanding, slip }: SlipDialogProps) {
  const t = useTranslations("client.portal.slip");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const submitMutation = useSubmitSlipMutation();
  const updateMutation = useUpdateSlipMutation();
  const photo = useStagedPhoto("", "PaymentSlip", "client");
  const inFlight = useRef(false);
  const [slipMissing, setSlipMissing] = useState(false);
  const isEdit = Boolean(slip);
  const isBusy = photo.isUploading || submitMutation.isPending || updateMutation.isPending;

  const form = useForm<SlipFormValues>({
    resolver: zodResolver(buildSlipSchema(outstanding)),
    values: slip
      ? {
          amount: slip.amount,
          transferReference: slip.transferReference ?? "",
          transferredAt: toLocalInput(slip.transferredAt),
        }
      : CLIENT_SLIP_DEFAULTS,
  });
  useUnsavedChanges(open && (form.formState.isDirty || photo.queuedFiles.length > 0));

  const close = () => {
    setSlipMissing(false);
    photo.clear();
    onOpenChange(false);
  };

  const submit = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    if (photo.queuedFiles.length === 0 && !slip?.slipFileKey) {
      setSlipMissing(true);
      return;
    }
    inFlight.current = true;
    try {
      // Deferred upload: happens only now; a failure aborts before the slip is saved.
      const slipFileKey = await photo.commit(slip?.slipFileKey);
      if (!slipFileKey) return;
      const req = {
        amount: v.amount,
        slipFileKey,
        transferReference: v.transferReference || undefined,
        transferredAt: v.transferredAt ? new Date(v.transferredAt).toISOString() : undefined,
      };
      if (slip) {
        await updateMutation.mutateAsync({ invoiceId, slipId: slip.id, req });
        toastSuccess(t("toastUpdated"));
      } else {
        await submitMutation.mutateAsync({ invoiceId, req });
        toastSuccess(t("toastSubmitted"));
      }
      form.reset(CLIENT_SLIP_DEFAULTS);
      close();
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("submitTitle")}</DialogTitle>
          <DialogDescription>{invoiceDocumentNumber}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField
            id="slip-amount"
            label={t("fieldAmount")}
            required
            helperText={t("outstandingHint", { amount: outstanding.toFixed(2) })}
            error={form.formState.errors.amount ? t("errorAmount") : undefined}
          >
            <Controller
              name="amount"
              control={form.control}
              render={({ field }) => (
                <CurrencyInput
                  id="slip-amount"
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t("placeholderAmount")}
                  disabled={isBusy}
                  hasError={Boolean(form.formState.errors.amount)}
                />
              )}
            />
          </FormField>
          <FormField id="slip-ref" label={t("fieldReference")}>
            <Input
              id="slip-ref"
              placeholder={t("placeholderReference")}
              disabled={isBusy}
              className="h-10 rounded-full font-mono text-xs"
              {...form.register("transferReference")}
            />
          </FormField>
          <FormField id="slip-transferred" label={t("fieldTransferredAt")}>
            <Controller
              name="transferredAt"
              control={form.control}
              render={({ field }) => (
                <DateTimeInput
                  id="slip-transferred"
                  mode="datetime"
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={isBusy}
                  placeholder={t("placeholderTransferredAt")}
                />
              )}
            />
          </FormField>
          <div className="space-y-1">
            <PhotoAttachmentField
              label={t("fieldSlipImage")}
              existingKey={slip?.slipFileKey}
              queuedFiles={photo.queuedFiles}
              stageFiles={(files) => {
                setSlipMissing(false);
                photo.stageFiles(files);
              }}
              removeFile={photo.removeFile}
              isUploading={photo.isUploading}
              scope="client"
              accept="image/*,.pdf"
            />
            {slipMissing && <p className="text-[11px] font-mono text-destructive">{t("errorSlipRequired")}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} className="rounded-full">
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
