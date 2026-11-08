"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Ban, CheckCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SelectPill } from "@/components/ui/select-pill";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { PageLoading } from "@/components/ui/mono-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/forms/form-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useUnitOptions } from "@/hooks/use-unit-options";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import {
  useAdminWorkOrder,
  useCreateWorkOrderMutation,
  useUpdateWorkOrderMutation,
  useCancelWorkOrderMutation,
} from "../api/use-work-orders";
import { workOrderFormSchema, type WorkOrderFormValues } from "../schemas/work-order-schemas";
import {
  PERMISSION_WORK_ORDERS_MANAGE,
  WORK_ORDER_FORM_DEFAULTS,
  WORK_ORDER_PRIORITY_OPTIONS,
  WORK_ORDER_STATUS_BADGE_VARIANT,
  WORK_ORDER_PRIORITY_BADGE_VARIANT,
} from "../constants";
import type { WorkOrderItemDto, WorkOrderPriorityType, WorkOrderStatusType } from "../types";
import { AssignWorkOrderDialog, ResolveWorkOrderDialog } from "./WorkOrderDialogs";

export interface WorkOrderEditorProps {
  workOrderId: string;
}

/** Single dynamic route body: id="create" creates, any other id views/edits. */
export function WorkOrderEditor({ workOrderId }: WorkOrderEditorProps) {
  if (workOrderId === "create") return <WorkOrderFormBody />;
  return <WorkOrderDetailLoader workOrderId={workOrderId} />;
}

function WorkOrderDetailLoader({ workOrderId }: { workOrderId: string }) {
  const t = useTranslations("admin.workOrders");
  const { activeProperty } = useAdminWorkspace();
  const { data, isLoading, isError, refetch } = useAdminWorkOrder(activeProperty.id, workOrderId);

  if (isLoading) return <PageLoading message={t("loading")} />;
  if (isError) {
    return <EmptyState title={t("loadError")} actionLabel={t("btnRetry")} onAction={() => void refetch()} />;
  }
  if (!data) return <EmptyState title={t("notFound")} />;
  return <WorkOrderFormBody workOrder={data} />;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-mute">{label}</div>
      <div className="break-all text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

function WorkOrderFormBody({ workOrder }: { workOrder?: WorkOrderItemDto }) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.workOrders");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_WORK_ORDERS_MANAGE);
  const propertyId = activeProperty.id;

  const isEdit = workOrder !== undefined;
  const status = workOrder?.status as WorkOrderStatusType | undefined;
  const isOpen = !isEdit || status === "Open";
  const canEditFields = canManage && isOpen;
  const hasPostedCharge = workOrder ? workOrder.chargeDocumentNumber != null || workOrder.tenantChargeAmount > 0 : false;
  const canCancel = isEdit && status !== "Cancelled" && !(status === "Completed" && hasPostedCharge);

  const units = useUnitOptions(propertyId);
  const createMutation = useCreateWorkOrderMutation(propertyId);
  const updateMutation = useUpdateWorkOrderMutation(propertyId);
  const cancelMutation = useCancelWorkOrderMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy = createMutation.isPending || updateMutation.isPending || cancelMutation.isPending;

  const [showAssign, setShowAssign] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderFormSchema),
    values: workOrder
      ? {
          unitId: workOrder.unit.id,
          issueSummary: workOrder.issueSummary,
          description: workOrder.description ?? "",
          priority: workOrder.priority as WorkOrderPriorityType,
          beforePhotoFileKey: workOrder.beforePhotoFileKey ?? "",
        }
      : WORK_ORDER_FORM_DEFAULTS,
  });
  useUnsavedChanges(form.formState.isDirty);

  const submit = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      if (workOrder) {
        await updateMutation.mutateAsync({
          id: workOrder.id,
          req: {
            issueSummary: v.issueSummary,
            description: v.description || undefined,
            priority: v.priority,
            beforePhotoFileKey: v.beforePhotoFileKey || undefined,
          },
        });
        toastSuccess(t("toastUpdated"));
      } else {
        const created = await createMutation.mutateAsync({
          unitId: v.unitId,
          issueSummary: v.issueSummary,
          description: v.description || undefined,
          priority: v.priority,
          beforePhotoFileKey: v.beforePhotoFileKey || undefined,
        });
        toastSuccess(t("toastCreated"));
        form.reset(v);
        router.push(`/admin/work-orders/${created.id}`);
      }
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  });

  const handleCancel = async (reason: string): Promise<boolean> => {
    if (!workOrder) return false;
    try {
      await cancelMutation.mutateAsync({ id: workOrder.id, reason });
      toastSuccess(t("toastCancelled"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="WKO"
        title={workOrder ? workOrder.documentNumber : t("createTitle")}
        description={workOrder ? t("detailDescription") : t("createDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/work-orders">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {workOrder && canManage && (status === "Open" || status === "InProgress") && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowAssign(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <UserPlus className="h-4 w-4" />
                <span>{t("btnAssign")}</span>
              </Button>
            )}
            {workOrder && canManage && status === "InProgress" && (
              <Button type="button" size="sm" disabled={isBusy} onClick={() => setShowResolve(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <CheckCheck className="h-4 w-4" />
                <span>{t("btnResolve")}</span>
              </Button>
            )}
            {canManage && canCancel && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowCancel(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <Ban className="h-4 w-4" />
                <span>{t("btnCancel")}</span>
              </Button>
            )}
          </div>
        }
      />

      {workOrder && status && (
        <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
          <Item label={t("colStatus")}>
            <Badge variant={WORK_ORDER_STATUS_BADGE_VARIANT[status]}>{t(`status.${status}`)}</Badge>
          </Item>
          <Item label={t("colPriority")}>
            <Badge variant={WORK_ORDER_PRIORITY_BADGE_VARIANT[workOrder.priority as WorkOrderPriorityType]}>
              {t(`priority.${workOrder.priority}`)}
            </Badge>
          </Item>
          <Item label={t("colUnit")}>
            {workOrder.unit.unitNumber} ({resolveLocalizedText(workOrder.unit.buildingName, locale)})
          </Item>
          <Item label={t("colTechnician")}>
            {workOrder.assignedTechnicianUserId ? (
              <span className="font-mono text-xs">{workOrder.assignedTechnicianUserId}</span>
            ) : (
              "-"
            )}
          </Item>
          {(status === "Completed" || status === "Cancelled") && (
            <>
              <Item label={t("fieldResolutionNotes")}>{workOrder.resolutionNotes ?? "-"}</Item>
              <Item label={t("fieldAfterPhoto")}>{workOrder.afterPhotoFileKey ?? "-"}</Item>
              <Item label={t("fieldRepairCost")}>{formatCurrencyThb(workOrder.tenantChargeAmount)}</Item>
              <Item label={t("chargeDocument")}>{workOrder.chargeDocumentNumber ?? "-"}</Item>
              {status === "Cancelled" && <Item label={t("cancelReason")}>{workOrder.cancelReason ?? "-"}</Item>}
            </>
          )}
        </div>
      )}

      {canManage && (
        <form onSubmit={submit} className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
          <h3 className="text-sm font-semibold text-ink">{isEdit ? t("sectionEdit") : t("sectionCreate")}</h3>
          {isEdit && !isOpen && <p className="text-xs text-mute">{t("editOnlyWhenOpen")}</p>}
          <FormField id="wo-unit" label={t("fieldUnit")} required error={form.formState.errors.unitId ? t("errorUnitRequired") : undefined}>
            <Controller
              name="unitId"
              control={form.control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="wo-unit"
                  options={units.options}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t("placeholderUnit")}
                  searchPlaceholder={t("placeholderUnit")}
                  isLoading={units.isLoading}
                  disabled={isEdit || isBusy}
                  hasError={Boolean(form.formState.errors.unitId)}
                  wrapperClassName="!mb-0"
                />
              )}
            />
          </FormField>
          <FormField id="wo-summary" label={t("fieldSummary")} required error={form.formState.errors.issueSummary ? t("errorSummaryRequired") : undefined}>
            <Input
              id="wo-summary"
              placeholder={t("placeholderSummary")}
              disabled={!canEditFields || isBusy}
              className="h-10 rounded-full text-sm"
              {...form.register("issueSummary")}
            />
          </FormField>
          <FormField id="wo-description" label={t("fieldDescription")}>
            <Textarea id="wo-description" placeholder={t("placeholderDescription")} disabled={!canEditFields || isBusy} {...form.register("description")} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="wo-priority" label={t("colPriority")}>
              <SelectPill id="wo-priority" disabled={!canEditFields || isBusy} wrapperClassName="!mb-0" {...form.register("priority")}>
                {WORK_ORDER_PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </SelectPill>
            </FormField>
            <FormField id="wo-before" label={t("fieldBeforePhoto")} helperText={t("photoKeyHint")}>
              <Input
                id="wo-before"
                placeholder={t("placeholderPhotoKey")}
                disabled={!canEditFields || isBusy}
                className="h-10 rounded-full font-mono text-xs"
                {...form.register("beforePhotoFileKey")}
              />
            </FormField>
          </div>
          {canEditFields && (
            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
                {isBusy ? tCommon("loading") : isEdit ? tCommon("save") : t("btnCreate")}
              </Button>
            </div>
          )}
        </form>
      )}

      {workOrder && (
        <>
          <AssignWorkOrderDialog open={showAssign} onOpenChange={setShowAssign} propertyId={propertyId} workOrder={workOrder} />
          <ResolveWorkOrderDialog open={showResolve} onOpenChange={setShowResolve} propertyId={propertyId} workOrder={workOrder} />
          <ReasonDialog
            open={showCancel}
            onOpenChange={setShowCancel}
            title={t("cancelTitle")}
            description={t("cancelDescription")}
            actionText={t("btnCancel")}
            confirmTitle={t("confirmCancelTitle")}
            confirmMessage={t("confirmCancelMessage", { document: workOrder.documentNumber })}
            isLoading={cancelMutation.isPending}
            onConfirm={handleCancel}
          />
        </>
      )}
    </div>
  );
}
