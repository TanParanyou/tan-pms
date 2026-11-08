"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
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
import { FormField } from "@/components/forms/form-field";
import { PhotoAttachmentField } from "@/components/forms/photo-attachment-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useStagedPhoto } from "@/hooks/use-staged-photo";
import { useAssigneeOptions } from "@/features/users/api/use-assignee-options";
import { useAssignWorkOrderMutation, useResolveWorkOrderMutation } from "../api/use-work-orders";
import {
  workOrderAssignSchema,
  workOrderResolveSchema,
  type WorkOrderAssignFormValues,
  type WorkOrderResolveFormValues,
} from "../schemas/work-order-schemas";
import { WORK_ORDER_RESOLVE_DEFAULTS } from "../constants";
import type { WorkOrderItemDto } from "../types";

interface WorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  workOrder: WorkOrderItemDto;
}

export function AssignWorkOrderDialog({ open, onOpenChange, propertyId, workOrder }: WorkOrderDialogProps) {
  const t = useTranslations("admin.workOrders");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useAssignWorkOrderMutation(propertyId);
  const assignees = useAssigneeOptions();
  const inFlight = useRef(false);
  const form = useForm<WorkOrderAssignFormValues>({
    resolver: zodResolver(workOrderAssignSchema),
    values: { technicianUserId: workOrder.assignedTechnicianUserId ?? "" },
  });
  useUnsavedChanges(open && form.formState.isDirty);

  const submit = form.handleSubmit(async (values) => {
    if (mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({ id: workOrder.id, req: { technicianUserId: values.technicianUserId } });
      toastSuccess(t("toastAssigned"));
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
          <DialogTitle>{t("assignTitle")}</DialogTitle>
          <DialogDescription>{workOrder.documentNumber}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField
            id="wo-technician"
            label={t("fieldTechnician")}
            required
            error={form.formState.errors.technicianUserId ? t("errorTechnicianRequired") : undefined}
          >
            <Controller
              name="technicianUserId"
              control={form.control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="wo-technician"
                  options={assignees.options}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t("placeholderTechnician")}
                  searchPlaceholder={t("placeholderTechnician")}
                  isLoading={assignees.isLoading}
                  hasError={Boolean(form.formState.errors.technicianUserId)}
                  wrapperClassName="!mb-0"
                />
              )}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-full">
              {mutation.isPending ? tCommon("loading") : t("btnAssign")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveWorkOrderDialog({ open, onOpenChange, propertyId, workOrder }: WorkOrderDialogProps) {
  const t = useTranslations("admin.workOrders");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useResolveWorkOrderMutation(propertyId);
  const photo = useStagedPhoto(propertyId, "WorkOrderPhoto");
  const inFlight = useRef(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const form = useForm<WorkOrderResolveFormValues>({
    resolver: zodResolver(workOrderResolveSchema),
    defaultValues: WORK_ORDER_RESOLVE_DEFAULTS,
  });
  useUnsavedChanges(open && (form.formState.isDirty || photo.queuedFiles.length > 0));

  const cost = form.watch("repairCostAmount");
  const chargeToTenant = form.watch("chargeToTenant");

  const execute = async () => {
    if (mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    const v = form.getValues();
    try {
      const afterPhotoFileKey = await photo.commit(v.afterPhotoFileKey);
      await mutation.mutateAsync({
        id: workOrder.id,
        req: {
          resolutionNotes: v.resolutionNotes,
          afterPhotoFileKey,
          repairCostAmount: v.repairCostAmount,
          chargeToTenant: v.chargeToTenant,
        },
      });
      toastSuccess(t("toastResolved"));
      form.reset(WORK_ORDER_RESOLVE_DEFAULTS);
      photo.clear();
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
            <DialogTitle>{t("resolveTitle")}</DialogTitle>
            <DialogDescription>{t("resolveDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FormField
              id="wo-notes"
              label={t("fieldResolutionNotes")}
              required
              error={form.formState.errors.resolutionNotes ? t("errorNotesRequired") : undefined}
            >
              <Textarea id="wo-notes" placeholder={t("placeholderResolutionNotes")} {...form.register("resolutionNotes")} />
            </FormField>
            <PhotoAttachmentField
              label={t("fieldAfterPhoto")}
              queuedFiles={photo.queuedFiles}
              stageFiles={photo.stageFiles}
              removeFile={photo.removeFile}
              isUploading={photo.isUploading}
            />
            <FormField id="wo-cost" label={t("fieldRepairCost")} error={form.formState.errors.repairCostAmount?.message}>
              <Controller
                name="repairCostAmount"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="wo-cost"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldRepairCost")}
                    hasError={Boolean(form.formState.errors.repairCostAmount)}
                  />
                )}
              />
            </FormField>
            <Controller
              name="chargeToTenant"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch id="wo-charge" checked={field.value} onCheckedChange={field.onChange} />
                  <Label htmlFor="wo-charge" className="text-xs">
                    {t("fieldChargeToTenant")}
                  </Label>
                </div>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={mutation.isPending || photo.isUploading}
              onClick={form.handleSubmit(() => setShowConfirm(true))}
              className="rounded-full"
            >
              {t("btnResolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={execute}
        title={t("confirmResolveTitle")}
        message={chargeToTenant && cost > 0 ? t("confirmResolveChargeMessage") : t("confirmResolveMessage")}
        confirmText={t("btnResolve")}
        variant={chargeToTenant && cost > 0 ? "warning" : "info"}
        isLoading={mutation.isPending || photo.isUploading}
      />
    </>
  );
}
