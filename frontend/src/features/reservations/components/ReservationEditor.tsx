"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Ban, BadgeCheck, DoorOpen, SearchCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectPill } from "@/components/ui/select-pill";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { DateTimeInput } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/forms/currency-input";
import { NumberInput } from "@/components/forms/number-input";
import { FormField } from "@/components/forms/form-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { useCustomerPicker } from "@/hooks/use-customer-picker";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { localInputToIso, toLocalInput } from "@/lib/datetime";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";
import {
  useAdminReservationDetail,
  useAdminAvailabilityQuery,
  useCreateAdminReservationMutation,
  useUpdateAdminReservationMutation,
  useAssignReservationUnitMutation,
  useConfirmAdminReservationMutation,
  useCancelAdminReservationMutation,
  useDeleteAdminReservationMutation,
} from "../api/use-reservations";
import { AvailabilityInspectorDialog } from "./AvailabilityInspectorDialog";
import { reservationFormSchema, type ReservationFormValues } from "../schemas/reservation-schemas";
import {
  CONFIRMABLE_RESERVATION_STATUSES,
  DELETABLE_RESERVATION_STATUSES,
  EDITABLE_RESERVATION_STATUSES,
  PERMISSION_RESERVATIONS_MANAGE,
  RESERVATION_FORM_DEFAULTS,
  RESERVATION_STATUS_BADGE_VARIANT,
  RESERVATION_STAY_MODES,
} from "../constants";
import type { ReservationItemDto } from "../types";

/** Single dynamic route body: id="create" creates, any other id views / edits / confirms / cancels / deletes. */
export function ReservationEditor({ reservationId }: { reservationId: string }) {
  const { activeProperty } = useAdminWorkspace();
  const t = useTranslations("admin.reservations");
  const tCommon = useTranslations("common");
  const isCreate = reservationId === "create";
  const hierarchy = usePropertyHierarchy(activeProperty.id);
  const detail = useAdminReservationDetail(activeProperty.id, reservationId);

  if (hierarchy.isLoading || (!isCreate && detail.isLoading)) return <PageLoading message={t("loadingReservation")} />;
  if (hierarchy.isError || (!isCreate && detail.isError)) {
    return (
      <EmptyState
        title={t("loadDetailError")}
        actionLabel={tCommon("retry")}
        onAction={() => {
          void hierarchy.refetch();
          if (!isCreate) void detail.refetch();
        }}
      />
    );
  }
  if (!isCreate && !detail.data) return <EmptyState title={t("notFound")} />;
  return <ReservationBody propertyId={activeProperty.id} unitTypes={hierarchy.data?.unitTypes ?? []} reservation={detail.data} />;
}

interface BodyProps {
  propertyId: string;
  unitTypes: NonNullable<ReturnType<typeof usePropertyHierarchy>["data"]>["unitTypes"];
  reservation?: ReservationItemDto;
}

function ReservationBody({ propertyId, unitTypes, reservation }: BodyProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.reservations");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_RESERVATIONS_MANAGE);
  const isEdit = reservation !== undefined;
  const status = reservation?.status;
  const editable = !isEdit || EDITABLE_RESERVATION_STATUSES.includes(status ?? "");

  const customers = useCustomerPicker(propertyId);
  const createM = useCreateAdminReservationMutation(propertyId);
  const updateM = useUpdateAdminReservationMutation(propertyId);
  const assignM = useAssignReservationUnitMutation(propertyId);
  const confirmM = useConfirmAdminReservationMutation(propertyId);
  const cancelM = useCancelAdminReservationMutation(propertyId);
  const deleteM = useDeleteAdminReservationMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy = createM.isPending || updateM.isPending || assignM.isPending || confirmM.isPending || cancelM.isPending || deleteM.isPending;

  const [showSave, setShowSave] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showNoShow, setShowNoShow] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [assignUnitId, setAssignUnitId] = useState("");

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationFormSchema),
    values: reservation
      ? {
          customerId: reservation.customer.id,
          unitTypeId: reservation.unitType.id,
          unitId: reservation.assignedUnit?.id ?? "",
          stayMode: reservation.stayMode,
          slotStartAt: toLocalInput(reservation.slotStartAt),
          slotEndAt: toLocalInput(reservation.slotEndAt),
          depositAmount: reservation.depositAmount,
          guestCount: reservation.guestCount ?? 1,
          note: reservation.note ?? "",
          confirmImmediately: false,
        }
      : RESERVATION_FORM_DEFAULTS,
  });
  useUnsavedChanges(form.formState.isDirty);
  const v = form.watch();
  const window = useMemo(() => {
    const start = localInputToIso(v.slotStartAt);
    const end = localInputToIso(v.slotEndAt);
    return start && end && new Date(end) > new Date(start) ? { checkIn: start, checkOut: end, stayMode: v.stayMode } : null;
  }, [v.slotStartAt, v.slotEndAt, v.stayMode]);
  const availability = useAdminAvailabilityQuery(propertyId, window);
  const typeAvailability = (availability.data?.items ?? []).filter((i) => i.unitType.id === v.unitTypeId);
  const unitOptions = typeAvailability.flatMap((i) => i.availableUnits);

  const execute = async () => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    const values = form.getValues();
    try {
      if (reservation) {
        await updateM.mutateAsync({
          id: reservation.id,
          req: {
            unitTypeId: values.unitTypeId,
            unitId: values.unitId || undefined,
            slotStartAt: localInputToIso(values.slotStartAt),
            slotEndAt: localInputToIso(values.slotEndAt),
            guestCount: values.guestCount,
            note: values.note || undefined,
          },
        });
        toastSuccess(t("toastUpdated"));
        form.reset(values);
      } else {
        const created = await createM.mutateAsync({
          customerId: values.customerId,
          unitTypeId: values.unitTypeId,
          unitId: values.unitId || undefined,
          stayMode: values.stayMode,
          slotStartAt: localInputToIso(values.slotStartAt),
          slotEndAt: localInputToIso(values.slotEndAt),
          depositAmount: values.depositAmount,
          confirmImmediately: values.confirmImmediately,
        });
        toastSuccess(t("toastCreated"));
        form.reset(values);
        router.push(`/admin/reservations/${created.id}`);
      }
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowSave(false);
    }
  };

  const executeConfirm = async () => {
    if (!reservation || isBusy) return;
    try {
      await confirmM.mutateAsync(reservation.id);
      toastSuccess(t("toastConfirmed"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowConfirm(false);
    }
  };
  const executeAssign = async () => {
    if (!reservation || !assignUnitId || isBusy) return;
    try {
      await assignM.mutateAsync({ id: reservation.id, req: { unitId: assignUnitId } });
      toastSuccess(t("toastAssigned"));
      setShowAssign(false);
      setAssignUnitId("");
    } catch (err) {
      toastApiError(err);
    }
  };
  const handleCancel = (markNoShow: boolean) => async (reason: string): Promise<boolean> => {
    if (!reservation) return false;
    try {
      await cancelM.mutateAsync({ id: reservation.id, req: { reason, markNoShow } });
      toastSuccess(markNoShow ? t("toastNoShow") : t("toastCancelled"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };
  const executeDelete = async () => {
    if (!reservation || isBusy) return;
    try {
      await deleteM.mutateAsync(reservation.id);
      toastSuccess(t("toastDeleted"));
      router.push("/admin/reservations");
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="RES"
        title={reservation ? reservation.documentNumber : t("modalTitleCreate")}
        description={reservation ? t("detailDescription") : t("modalDescCreate")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/reservations">
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {reservation && canManage && !reservation.assignedUnit && editable && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowAssign(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <DoorOpen className="h-4 w-4" />
                <span>{t("actionAssignUnit")}</span>
              </Button>
            )}
            {reservation && canManage && CONFIRMABLE_RESERVATION_STATUSES.includes(reservation.status) && (
              <Button type="button" size="sm" disabled={isBusy} onClick={() => setShowConfirm(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <BadgeCheck className="h-4 w-4" />
                <span>{t("actionConfirm")}</span>
              </Button>
            )}
            {reservation && canManage && editable && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowCancel(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Ban className="h-4 w-4" />
                <span>{t("typeCancel")}</span>
              </Button>
            )}
            {reservation && canManage && reservation.status === "Confirmed" && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowNoShow(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Ban className="h-4 w-4" />
                <span>{t("typeNoShow")}</span>
              </Button>
            )}
            {reservation && canManage && DELETABLE_RESERVATION_STATUSES.includes(reservation.status) && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowDelete(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Trash2 className="h-4 w-4" />
                <span>{t("btnDelete")}</span>
              </Button>
            )}
          </div>
        }
      />

      {reservation && (
        <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label={t("colStatusDeposit")}>
            <Badge variant={RESERVATION_STATUS_BADGE_VARIANT[reservation.status]}>{t(`status${reservation.status}`)}</Badge>
          </DetailItem>
          <DetailItem label={t("colCustomer")}>{reservation.customer.fullName}</DetailItem>
          <DetailItem label={t("colUnitTypeUnit")}>
            {resolveLocalizedText(reservation.unitType.name, locale)} / {reservation.assignedUnit ? reservation.assignedUnit.unitNumber : t("quotaUnassignedBadge")}
          </DetailItem>
          <DetailItem label={t("fieldDepositAmount")}>{formatCurrencyThb(reservation.depositAmount)}</DetailItem>
          <DetailItem label={t("holdExpiresAt")}>{formatDateTime(reservation.holdExpiresAt, locale)}</DetailItem>
          {reservation.cancellationReason != null && <DetailItem label={t("cancelReason")}>{reservation.cancellationReason}</DetailItem>}
        </div>
      )}

      {canManage && (
        <form onSubmit={form.handleSubmit(() => setShowSave(true))} className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
          {isEdit && !editable && <p className="text-xs text-mute">{t("editLockedHint")}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="res-customer"
              label={t("fieldCustomer")}
              required
              error={customers.isError ? t("customerSearchError") : form.formState.errors.customerId ? t("errorCustomerRequired") : undefined}
            >
              <Controller
                name="customerId"
                control={form.control}
                render={({ field }) => (
                  <EntityAutocomplete
                    id="res-customer"
                    options={reservation ? [{ value: reservation.customer.id, label: `${reservation.customer.fullName} (${reservation.customer.maskedNationalId})` }, ...customers.options.filter((o) => o.value !== reservation.customer.id)] : customers.options}
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      customers.pick(val);
                    }}
                    onSearchChange={customers.setSearch}
                    isLoading={customers.isLoading}
                    disabled={isEdit || isBusy}
                    placeholder={t("placeholderCustomer")}
                    searchPlaceholder={t("placeholderCustomer")}
                    hasError={Boolean(form.formState.errors.customerId)}
                    wrapperClassName="!mb-0"
                  />
                )}
              />
            </FormField>
            <FormField id="res-mode" label={t("fieldStayMode")}>
              <SelectPill id="res-mode" disabled={isEdit || isBusy} wrapperClassName="!mb-0" {...form.register("stayMode")}>
                {RESERVATION_STAY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {tModes(m)}
                  </option>
                ))}
              </SelectPill>
            </FormField>
            <FormField id="res-start" label={t("fieldSlotStart")} required>
              <Controller name="slotStartAt" control={form.control} render={({ field }) => (
                <DateTimeInput id="res-start" mode="datetime" value={field.value} onValueChange={field.onChange} disabled={!editable || isBusy} hasError={Boolean(form.formState.errors.slotStartAt)} placeholder={t("fieldSlotStart")} />
              )} />
            </FormField>
            <FormField id="res-end" label={t("fieldSlotEnd")} required error={form.formState.errors.slotEndAt ? t("errorSlotWindow") : undefined}>
              <Controller name="slotEndAt" control={form.control} render={({ field }) => (
                <DateTimeInput id="res-end" mode="datetime" value={field.value} onValueChange={field.onChange} disabled={!editable || isBusy} hasError={Boolean(form.formState.errors.slotEndAt)} placeholder={t("fieldSlotEnd")} />
              )} />
            </FormField>
            <FormField id="res-unit-type" label={t("fieldUnitType")} required error={form.formState.errors.unitTypeId ? t("errorUnitTypeRequired") : undefined}>
              <SelectPill id="res-unit-type" disabled={!editable || isBusy} wrapperClassName="!mb-0" {...form.register("unitTypeId")}>
                <option value="">{t("placeholderUnitType")}</option>
                {unitTypes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {resolveLocalizedText(u.name, locale)} ({u.code})
                  </option>
                ))}
              </SelectPill>
            </FormField>
            <FormField id="res-unit" label={t("fieldSpecificUnit")}>
              <SelectPill id="res-unit" disabled={!editable || isBusy} wrapperClassName="!mb-0" {...form.register("unitId")}>
                <option value="">{t("allocationQuota")}</option>
                {reservation?.assignedUnit && !unitOptions.some((u) => u.id === reservation.assignedUnit?.id) && (
                  <option value={reservation.assignedUnit.id}>{reservation.assignedUnit.unitNumber}</option>
                )}
                {unitOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNumber} ({resolveLocalizedText(u.buildingName, locale)})
                  </option>
                ))}
              </SelectPill>
            </FormField>
            <FormField id="res-deposit" label={t("fieldDepositAmount")}>
              <Controller name="depositAmount" control={form.control} render={({ field }) => (
                <CurrencyInput id="res-deposit" value={field.value} onValueChange={field.onChange} placeholder={t("fieldDepositAmount")} disabled={isEdit || isBusy} wrapperClassName="!mb-0" />
              )} />
            </FormField>
            <FormField id="res-guests" label={t("fieldGuestCount")}>
              <Controller name="guestCount" control={form.control} render={({ field }) => (
                <NumberInput id="res-guests" value={field.value} onValueChange={field.onChange} decimals={0} min={1} max={20} placeholder={t("fieldGuestCount")} disabled={!editable || isBusy} wrapperClassName="!mb-0" />
              )} />
            </FormField>
          </div>
          <FormField id="res-note" label={t("fieldNote")}>
            <Textarea id="res-note" placeholder={t("placeholderNote")} disabled={!editable || isBusy} {...form.register("note")} />
          </FormField>
          {window && (
            <div className="rounded-[12px] bg-surface-soft p-3 text-xs text-body" data-testid="availability-hint">
              {availability.isLoading && <span>{tCommon("loading")}</span>}
              {availability.isError && <span className="text-destructive">{t("availabilityError")}</span>}
              {availability.data && typeAvailability.length === 0 && <span>{t("availabilityPickType")}</span>}
              <Button type="button" size="sm" variant="outline" onClick={() => setShowInspector(true)} className="ml-3 h-7 gap-1 rounded-full px-3 text-[11px]">
                <SearchCheck className="h-3.5 w-3.5" />
                <span>{t("inspectAvailability")}</span>
              </Button>
              {typeAvailability.map((i) => (
                <span key={i.unitType.id}>{t("availabilityNet", { count: i.netAvailableQuota })}</span>
              ))}
            </div>
          )}
          {!isEdit && (
            <Controller name="confirmImmediately" control={form.control} render={({ field }) => (
              <div className="flex items-center gap-2">
                <Switch id="res-confirm-now" checked={field.value} disabled={isBusy} onCheckedChange={field.onChange} />
                <Label htmlFor="res-confirm-now" className="text-xs">{t("fieldConfirmImmediately")}</Label>
              </div>
            )} />
          )}
          {editable && (
            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
                {isBusy ? tCommon("loading") : isEdit ? tCommon("save") : t("saveCreate")}
              </Button>
            </div>
          )}
        </form>
      )}

      <ConfirmationModal isOpen={showSave} onClose={() => setShowSave(false)} onConfirm={execute} title={isEdit ? t("confirmUpdateTitle") : t("confirmCreateTitle")} message={isEdit ? t("confirmUpdateMessage") : t("confirmCreateMessage")} confirmText={isEdit ? tCommon("save") : t("saveCreate")} variant="info" isLoading={createM.isPending || updateM.isPending} />
      <ConfirmationModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={executeConfirm} title={t("confirmModalTitle")} message={t("confirmModalMessage")} confirmText={t("actionConfirm")} variant="warning" isLoading={confirmM.isPending} />
      <ConfirmationModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={executeDelete} title={t("confirmDeleteTitle")} message={t("confirmDeleteMessage", { document: reservation?.documentNumber ?? "" })} confirmText={t("btnDelete")} variant="danger" isLoading={deleteM.isPending} />
      <AvailabilityInspectorDialog
        open={showInspector}
        onOpenChange={setShowInspector}
        propertyId={propertyId}
        initial={{ stayMode: v.stayMode, slotStartAt: v.slotStartAt, slotEndAt: v.slotEndAt }}
      />
      {reservation && (
        <>
          <ReasonDialog open={showCancel} onOpenChange={setShowCancel} title={t("modalTitleCancel", { doc: reservation.documentNumber })} description={t("modalDescCancel")} actionText={t("typeCancel")} confirmTitle={t("confirmCancelTitle")} confirmMessage={t("confirmCancelMessage")} isLoading={cancelM.isPending} onConfirm={handleCancel(false)} />
          <ReasonDialog open={showNoShow} onOpenChange={setShowNoShow} title={t("modalTitleCancel", { doc: reservation.documentNumber })} description={t("modalDescCancel")} actionText={t("typeNoShow")} confirmTitle={t("confirmCancelTitle")} confirmMessage={t("confirmCancelMessage")} isLoading={cancelM.isPending} onConfirm={handleCancel(true)} />
          <Dialog open={showAssign} onOpenChange={setShowAssign}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("modalTitleAssign", { doc: reservation.documentNumber })}</DialogTitle>
                <DialogDescription>{t("modalDescAssign")}</DialogDescription>
              </DialogHeader>
              <FormField id="assign-unit" label={t("selectUnitLabel")}>
                <SelectPill id="assign-unit" value={assignUnitId} onChange={(e) => setAssignUnitId(e.target.value)} wrapperClassName="!mb-0">
                  <option value="">{t("placeholderUnit")}</option>
                  {unitOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber} ({resolveLocalizedText(u.buildingName, locale)})
                    </option>
                  ))}
                </SelectPill>
              </FormField>
              {unitOptions.length === 0 && <p className="text-xs text-mute">{t("noCleanUnits")}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAssign(false)} className="rounded-full">
                  {tCommon("cancel")}
                </Button>
                <Button type="button" disabled={!assignUnitId || assignM.isPending} onClick={() => void executeAssign()} className="rounded-full">
                  {assignM.isPending ? tCommon("loading") : t("saveAssign")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
