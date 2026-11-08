"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { FormField } from "@/components/forms/form-field";
import { PhotoAttachmentField } from "@/components/forms/photo-attachment-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { StoredFileViewer } from "@/components/shared/stored-file-viewer";
import { useStagedPhoto } from "@/hooks/use-staged-photo";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import {
  WORK_ORDER_STATUS_BADGE_VARIANT,
  WORK_ORDER_PRIORITY_BADGE_VARIANT,
} from "@/features/work-orders/constants";
import type { WorkOrderItemDto, WorkOrderPriorityType, WorkOrderStatusType } from "@/features/work-orders/types";
import { useClientLeases } from "../api/use-client-leases";
import {
  useClientWorkOrder,
  useCreateClientWorkOrderMutation,
  useUpdateClientWorkOrderMutation,
  useCancelClientWorkOrderMutation,
} from "../api/use-client-operations";
import { clientWorkOrderSchema, type ClientWorkOrderFormValues } from "../schemas/client-schemas";
import { CLIENT_WORK_ORDER_DEFAULTS, CLIENT_WORK_ORDER_PRIORITIES } from "../constants";

/** Single dynamic route body: id="create" creates, any other id views, edits (Open) or cancels (Open). */
export function ClientWorkOrderEditor({ workOrderId }: { workOrderId: string }) {
  if (workOrderId === "create") return <WorkOrderBody />;
  return <WorkOrderLoader workOrderId={workOrderId} />;
}

function WorkOrderLoader({ workOrderId }: { workOrderId: string }) {
  const t = useTranslations("client.portal.workOrders");
  const tCommon = useTranslations("common");
  const { data, isLoading, isError, refetch } = useClientWorkOrder(workOrderId);
  if (isLoading) return <PageLoading message={tCommon("loading")} />;
  if (isError) return <EmptyState title={t("detailLoadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />;
  if (!data) return <EmptyState title={t("notFound")} />;
  return <WorkOrderBody workOrder={data} />;
}

function WorkOrderBody({ workOrder }: { workOrder?: WorkOrderItemDto }) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.workOrders");
  const tWo = useTranslations("admin.workOrders");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const isEdit = workOrder !== undefined;
  const status = workOrder?.status as WorkOrderStatusType | undefined;
  const isOpen = !isEdit || status === "Open";

  const leases = useClientLeases();
  const createMutation = useCreateClientWorkOrderMutation();
  const updateMutation = useUpdateClientWorkOrderMutation();
  const cancelMutation = useCancelClientWorkOrderMutation();
  const photo = useStagedPhoto("", "WorkOrderPhoto", "client");
  const inFlight = useRef(false);
  const [showCancel, setShowCancel] = useState(false);
  const isBusy = photo.isUploading || createMutation.isPending || updateMutation.isPending || cancelMutation.isPending;

  const form = useForm<ClientWorkOrderFormValues>({
    resolver: zodResolver(clientWorkOrderSchema),
    values: workOrder
      ? {
          unitId: workOrder.unit.id,
          issueSummary: workOrder.issueSummary,
          description: workOrder.description ?? "",
          priority: workOrder.priority as WorkOrderPriorityType,
        }
      : CLIENT_WORK_ORDER_DEFAULTS,
  });
  useUnsavedChanges(form.formState.isDirty || photo.queuedFiles.length > 0);

  const submit = form.handleSubmit(async (v) => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    try {
      // Deferred upload: only on submit; failure leaves the form untouched.
      const beforePhotoFileKey = await photo.commit(workOrder?.beforePhotoFileKey);
      if (workOrder) {
        await updateMutation.mutateAsync({
          id: workOrder.id,
          req: { issueSummary: v.issueSummary, description: v.description || undefined, priority: v.priority, beforePhotoFileKey },
        });
        photo.clear();
        toastSuccess(t("toastUpdated"));
      } else {
        const created = await createMutation.mutateAsync({
          unitId: v.unitId,
          issueSummary: v.issueSummary,
          description: v.description || undefined,
          priority: v.priority,
          beforePhotoFileKey,
        });
        photo.clear();
        toastSuccess(t("toastCreated"));
        form.reset(v);
        router.push(`/client/work-orders/${created.id}`);
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
            <Link href="/client/work-orders">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {workOrder && status === "Open" && (
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
          <DetailItem label={t("colStatus")}>
            <Badge variant={WORK_ORDER_STATUS_BADGE_VARIANT[status]}>{tWo(`status.${status}`)}</Badge>
          </DetailItem>
          <DetailItem label={t("colPriority")}>
            <Badge variant={WORK_ORDER_PRIORITY_BADGE_VARIANT[workOrder.priority as WorkOrderPriorityType]}>
              {tWo(`priority.${workOrder.priority}`)}
            </Badge>
          </DetailItem>
          <DetailItem label={t("colUnit")}>
            {workOrder.unit.unitNumber} ({resolveLocalizedText(workOrder.unit.buildingName, locale)})
          </DetailItem>
          <DetailItem label={t("colTechnician")}>{workOrder.assignedTechnician?.fullName ?? "-"}</DetailItem>
          {status === "Completed" && (
            <>
              <DetailItem label={t("resolutionNotes")}>{workOrder.resolutionNotes ?? "-"}</DetailItem>
              <DetailItem label={t("repairCost")}>{formatCurrencyThb(workOrder.tenantChargeAmount)}</DetailItem>
              <DetailItem label={t("afterPhoto")}>
                <StoredFileViewer fileKey={workOrder.afterPhotoFileKey} scope="client" />
              </DetailItem>
            </>
          )}
          {status === "Cancelled" && <DetailItem label={t("cancelReason")}>{workOrder.cancelReason ?? "-"}</DetailItem>}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <h3 className="text-sm font-semibold text-ink">{isEdit ? t("sectionEdit") : t("sectionCreate")}</h3>
        {isEdit && !isOpen && <p className="text-xs text-mute">{t("editOnlyWhenOpen")}</p>}
        <FormField id="cwo-unit" label={t("fieldUnit")} required error={form.formState.errors.unitId ? t("errorUnitRequired") : undefined}>
          <Controller
            name="unitId"
            control={form.control}
            render={({ field }) => (
              <SelectPill
                id="cwo-unit"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                disabled={isEdit || isBusy || leases.isLoading}
                hasError={Boolean(form.formState.errors.unitId)}
                wrapperClassName="!mb-0"
              >
                <option value="">{t("placeholderUnit")}</option>
                {(leases.data?.items ?? []).map((l) => (
                  <option key={l.unit.id} value={l.unit.id}>
                    {l.unit.unitNumber} ({resolveLocalizedText(l.unit.buildingName, locale)})
                  </option>
                ))}
                {workOrder && !(leases.data?.items ?? []).some((l) => l.unit.id === workOrder.unit.id) && (
                  <option value={workOrder.unit.id}>{workOrder.unit.unitNumber}</option>
                )}
              </SelectPill>
            )}
          />
        </FormField>
        {leases.isError && <p className="text-xs text-destructive">{t("unitsLoadError")}</p>}
        <FormField id="cwo-summary" label={t("fieldSummary")} required error={form.formState.errors.issueSummary ? t("errorSummaryRequired") : undefined}>
          <Input
            id="cwo-summary"
            placeholder={t("placeholderSummary")}
            disabled={!isOpen || isBusy}
            className="h-10 rounded-full text-sm"
            {...form.register("issueSummary")}
          />
        </FormField>
        <FormField id="cwo-description" label={t("fieldDescription")}>
          <Textarea id="cwo-description" placeholder={t("placeholderDescription")} disabled={!isOpen || isBusy} {...form.register("description")} />
        </FormField>
        <FormField id="cwo-priority" label={t("colPriority")}>
          <SelectPill id="cwo-priority" disabled={!isOpen || isBusy} wrapperClassName="!mb-0" {...form.register("priority")}>
            {CLIENT_WORK_ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {tWo(`priority.${p}`)}
              </option>
            ))}
          </SelectPill>
        </FormField>
        <PhotoAttachmentField
          label={t("fieldPhoto")}
          existingKey={workOrder?.beforePhotoFileKey}
          queuedFiles={photo.queuedFiles}
          stageFiles={photo.stageFiles}
          removeFile={photo.removeFile}
          isUploading={photo.isUploading}
          disabled={!isOpen}
          scope="client"
        />
        {isOpen && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
              {isBusy ? tCommon("loading") : isEdit ? tCommon("save") : t("btnSubmit")}
            </Button>
          </div>
        )}
      </form>

      {workOrder && (
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
      )}
    </div>
  );
}
