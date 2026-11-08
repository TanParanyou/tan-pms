"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
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
import { useUnitOptions } from "@/hooks/use-unit-options";
import { useAssigneeOptions } from "@/features/users/api/use-assignee-options";
import {
  useCreateHousekeepingTaskMutation,
  useAssignHousekeepingTaskMutation,
  useUpdateHousekeepingTaskMutation,
  useCompleteHousekeepingTaskMutation,
} from "../api/use-housekeeping";
import {
  createHousekeepingTaskSchema,
  assignHousekeepingTaskSchema,
  editHousekeepingNoteSchema,
  type CreateHousekeepingTaskFormValues,
  type AssignHousekeepingTaskFormValues,
  type EditHousekeepingNoteFormValues,
} from "../schemas/housekeeping-schemas";
import { HOUSEKEEPING_EMPTY_CREATE } from "../constants";
import type { HousekeepingTaskDto } from "../types";

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function CreateHousekeepingTaskDialog({ open, onOpenChange, propertyId }: BaseDialogProps) {
  const t = useTranslations("admin.housekeeping");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useCreateHousekeepingTaskMutation(propertyId);
  const units = useUnitOptions(propertyId);
  const assignees = useAssigneeOptions();
  const inFlight = useRef(false);
  const form = useForm<CreateHousekeepingTaskFormValues>({
    resolver: zodResolver(createHousekeepingTaskSchema),
    defaultValues: HOUSEKEEPING_EMPTY_CREATE,
  });
  useUnsavedChanges(open && form.formState.isDirty);

  const submit = form.handleSubmit(async (values) => {
    if (mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({
        unitId: values.unitId,
        note: values.note || undefined,
        assignedStaffUserId: values.assignedStaffUserId || undefined,
      });
      toastSuccess(t("toastCreated"));
      form.reset(HOUSEKEEPING_EMPTY_CREATE);
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
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField id="hk-unit" label={t("fieldUnit")} required error={form.formState.errors.unitId ? t("errorUnitRequired") : undefined}>
            <Controller
              name="unitId"
              control={form.control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="hk-unit"
                  options={units.options}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t("placeholderUnit")}
                  searchPlaceholder={t("placeholderUnit")}
                  isLoading={units.isLoading}
                  hasError={Boolean(form.formState.errors.unitId)}
                  wrapperClassName="!mb-0"
                />
              )}
            />
          </FormField>
          <FormField id="hk-assignee" label={t("fieldAssignee")}>
            <Controller
              name="assignedStaffUserId"
              control={form.control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="hk-assignee"
                  options={assignees.options}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  placeholder={t("placeholderAssignee")}
                  searchPlaceholder={t("placeholderAssignee")}
                  isLoading={assignees.isLoading}
                  wrapperClassName="!mb-0"
                />
              )}
            />
          </FormField>
          <FormField id="hk-note" label={t("fieldNote")}>
            <Textarea id="hk-note" placeholder={t("placeholderNote")} {...form.register("note")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-full">
              {mutation.isPending ? tCommon("loading") : t("btnCreate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface TaskDialogProps extends BaseDialogProps {
  task: HousekeepingTaskDto | null;
}

export function AssignHousekeepingTaskDialog({ open, onOpenChange, propertyId, task }: TaskDialogProps) {
  const t = useTranslations("admin.housekeeping");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useAssignHousekeepingTaskMutation(propertyId);
  const assignees = useAssigneeOptions();
  const inFlight = useRef(false);
  const form = useForm<AssignHousekeepingTaskFormValues>({
    resolver: zodResolver(assignHousekeepingTaskSchema),
    values: { assignedStaffUserId: task?.assignedStaffUserId ?? "" },
  });
  useUnsavedChanges(open && form.formState.isDirty);

  const submit = form.handleSubmit(async (values) => {
    if (!task || mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({ taskId: task.id, req: { assignedStaffUserId: values.assignedStaffUserId } });
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
          <DialogDescription>{task?.sourceDocumentNumber}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField id="hk-assign-assignee" label={t("fieldAssignee")} required error={form.formState.errors.assignedStaffUserId ? t("errorAssigneeRequired") : undefined}>
            <Controller
              name="assignedStaffUserId"
              control={form.control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="hk-assign-assignee"
                  options={assignees.options}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t("placeholderAssignee")}
                  searchPlaceholder={t("placeholderAssignee")}
                  isLoading={assignees.isLoading}
                  hasError={Boolean(form.formState.errors.assignedStaffUserId)}
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

export function EditHousekeepingNoteDialog({ open, onOpenChange, propertyId, task }: TaskDialogProps) {
  const t = useTranslations("admin.housekeeping");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useUpdateHousekeepingTaskMutation(propertyId);
  const inFlight = useRef(false);
  const form = useForm<EditHousekeepingNoteFormValues>({
    resolver: zodResolver(editHousekeepingNoteSchema),
    values: { note: task?.note ?? "" },
  });
  useUnsavedChanges(open && form.formState.isDirty);

  const submit = form.handleSubmit(async (values) => {
    if (!task || mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({
        taskId: task.id,
        req: { note: values.note, assignedStaffUserId: task.assignedStaffUserId },
      });
      toastSuccess(t("toastUpdated"));
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
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{task?.sourceDocumentNumber}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField id="hk-edit-note" label={t("fieldNote")}>
            <Textarea id="hk-edit-note" placeholder={t("placeholderNote")} {...form.register("note")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="rounded-full">
              {mutation.isPending ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompleteHousekeepingTaskDialog({ open, onOpenChange, propertyId, task }: TaskDialogProps) {
  const t = useTranslations("admin.housekeeping");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useCompleteHousekeepingTaskMutation(propertyId);
  const inFlight = useRef(false);
  const [skipInspection, setSkipInspection] = React.useState(false);
  // Skipping only makes sense while still Cleaning; Inspecting tasks complete directly.
  const canSkip = task?.status === "Cleaning";

  const submit = async () => {
    if (!task || mutation.isPending || inFlight.current) return;
    inFlight.current = true;
    try {
      await mutation.mutateAsync({ taskId: task.id, req: { skipInspection: canSkip && skipInspection } });
      toastSuccess(t("toastCompleted"));
      setSkipInspection(false);
      onOpenChange(false);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("completeTitle")}</DialogTitle>
          <DialogDescription>{t("completeDescription")}</DialogDescription>
        </DialogHeader>
        {canSkip && (
          <div className="flex items-center gap-2">
            <Checkbox id="hk-skip" checked={skipInspection} onCheckedChange={(c) => setSkipInspection(c === true)} />
            <Label htmlFor="hk-skip" className="text-xs">
              {t("fieldSkipInspection")}
            </Label>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            {tCommon("cancel")}
          </Button>
          <Button type="button" disabled={mutation.isPending} onClick={() => void submit()} className="rounded-full">
            {mutation.isPending ? tCommon("loading") : t("btnComplete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
