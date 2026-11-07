"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SelectPill } from "@/components/ui/select-pill";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/forms/currency-input";
import { DateTimeInput } from "@/components/ui/date-picker";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb } from "@/lib/formatters";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import {
  useAdminReservationDetail,
  useCreateAdminReservationMutation,
  useAssignReservationUnitMutation,
  useConfirmAdminReservationMutation,
  useCancelAdminReservationMutation,
} from "../api/use-reservations";
import {
  SAMPLE_UNIT_TYPES,
  SAMPLE_ASSIGNABLE_UNITS,
  SAMPLE_CUSTOMERS,
  CUSTOMER_MAP,
} from "../constants";
import {
  createReservationSchema,
  assignUnitSchema,
  cancelReservationSchema,
  type CreateReservationFormValues,
  type AssignUnitFormValues,
  type CancelReservationFormValues,
} from "../schemas/reservation-schemas";
import { ArrowLeft, CheckCircle2, Save, XCircle } from "lucide-react";
import Link from "next/link";
import type { StayModeType } from "@/constants/master-data";

export interface ReservationEditorProps {
  reservationId: string;
}

export function ReservationEditor({ reservationId }: ReservationEditorProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const { activeProperty } = useAdminWorkspace();
  const tRes = useTranslations("admin.reservations");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  const isCreate = reservationId === "create";

  const { data: reservation, isLoading } = useAdminReservationDetail(
    activeProperty.id,
    reservationId
  );

  const createMutation = useCreateAdminReservationMutation(activeProperty.id);
  const assignMutation = useAssignReservationUnitMutation(activeProperty.id);
  const confirmMutation = useConfirmAdminReservationMutation(activeProperty.id);
  const cancelMutation = useCancelAdminReservationMutation(activeProperty.id);

  const [activeTab, setActiveTab] = useState("tab-details");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(SAMPLE_CUSTOMERS[0].id);

  const customerOptions = SAMPLE_CUSTOMERS.map((c) => ({
    value: c.id,
    label: c.fullName,
    sublabel: c.maskedNationalId,
  }));

  const { toastSuccess, toastApiError } = useToast();

  // Create Form
  const createForm = useForm<CreateReservationFormValues>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      unitTypeId: SAMPLE_UNIT_TYPES[0].id,
      stayMode: "Daily",
      checkIn: "2026-11-08",
      checkOut: "2026-11-10",
      customerName: "Jane Doe",
      customerPhone: "081-999-8877",
      customerEmail: "jane.doe@example.com",
      depositAmount: 1500,
      specialRequests: "",
    },
  });

  useUnsavedChanges(createForm.formState.isDirty);

  // Assign Unit Form
  const assignForm = useForm<AssignUnitFormValues>({
    resolver: zodResolver(assignUnitSchema),
    defaultValues: {
      unitId: Object.values(SAMPLE_ASSIGNABLE_UNITS)[0]?.[0]?.id ?? "",
    },
  });

  // Cancel Form
  const cancelForm = useForm<CancelReservationFormValues>({
    resolver: zodResolver(cancelReservationSchema),
    defaultValues: {
      cancellationReason: "",
    },
  });

  const fieldToTabMap = {
    unitTypeId: "tab-details",
    stayMode: "tab-details",
    checkIn: "tab-details",
    checkOut: "tab-details",
    customerName: "tab-customer",
    customerPhone: "tab-customer",
    customerEmail: "tab-customer",
    depositAmount: "tab-deposit",
  };

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap,
    errors: createForm.formState.errors,
  });

  if (!isCreate && (isLoading || !reservation)) {
    return <PageLoading message={tRes("loadingReservation")} />;
  }

  const handleExecuteCreate = async (values: CreateReservationFormValues) => {
    try {
      await createMutation.mutateAsync({
        customerId: selectedCustomerId,
        unitTypeId: values.unitTypeId,
        stayMode: values.stayMode,
        slotStartAt: `${values.checkIn}T14:00:00Z`,
        slotEndAt: `${values.checkOut}T12:00:00Z`,
        depositAmount: values.depositAmount,
        confirmImmediately: true,
      });
      toastSuccess(tRes("saveSuccess") || tCommon("save"));
      router.push("/admin/reservations");
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleExecuteAssign = async (values: AssignUnitFormValues) => {
    if (!reservation) return;
    try {
      await assignMutation.mutateAsync({
        reservationId: reservation.id,
        req: { unitId: values.unitId },
      });
      toastSuccess(tRes("actionAssignUnit"));
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleExecuteConfirm = async () => {
    if (!reservation) return;
    try {
      await confirmMutation.mutateAsync(reservation.id);
      toastSuccess(tRes("actionConfirm"));
      setShowConfirmModal(false);
    } catch (err) {
      toastApiError(err);
    }
  };

  const handleExecuteCancel = async () => {
    if (!reservation) return;
    try {
      const values = cancelForm.getValues();
      await cancelMutation.mutateAsync({
        reservationId: reservation.id,
        req: { reason: values.cancellationReason, markNoShow: false },
      });
      toastSuccess(tRes("actionCancel"));
      setShowCancelModal(false);
      router.push("/admin/reservations");
    } catch (err) {
      toastApiError(err);
    }
  };

  if (isCreate) {
    const createTabs: FormTabItem[] = [
      {
        id: "tab-details",
        label: tRes("tabRoomSelection"),
        hasError: hasTabError("tab-details"),
        content: (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-unit-type" className="text-xs font-medium text-ink">
                {tRes("fieldUnitType")}
              </Label>
              <Controller
                name="unitTypeId"
                control={createForm.control}
                render={({ field }) => (
                  <SelectPill
                    id="create-unit-type"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 text-xs font-mono"
                  >
                    {SAMPLE_UNIT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {resolveLocalizedText(t.name, locale)} ({t.code})
                      </option>
                    ))}
                  </SelectPill>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tRes("fieldStayMode")}
              </Label>
              <Controller
                name="stayMode"
                control={createForm.control}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    {(["Hourly", "Daily", "Monthly"] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        variant={field.value === mode ? "default" : "outline"}
                        size="sm"
                        onClick={() => field.onChange(mode)}
                        className="rounded-full text-xs font-mono h-8 px-4"
                      >
                        {tModes(mode)}
                      </Button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-check-in" className="text-xs font-medium text-ink">
                  {tRes("fieldCheckIn")}
                </Label>
                <Controller
                  name="checkIn"
                  control={createForm.control}
                  render={({ field }) => (
                    <DateTimeInput
                      id="create-check-in"
                      mode="date"
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={tRes("fieldCheckIn")}
                      className="h-10 rounded-full font-mono text-xs"
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-check-out" className="text-xs font-medium text-ink">
                  {tRes("fieldCheckOut")}
                </Label>
                <Controller
                  name="checkOut"
                  control={createForm.control}
                  render={({ field }) => (
                    <DateTimeInput
                      id="create-check-out"
                      mode="date"
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={tRes("fieldCheckOut")}
                      className="h-10 rounded-full font-mono text-xs"
                    />
                  )}
                />
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "tab-customer",
        label: tRes("tabGuestInfo"),
        hasError: hasTabError("tab-customer"),
        content: (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="reservation-customer-autocomplete" className="text-xs font-medium text-ink">
                {tRes("fieldCustomer")}
              </Label>
              <EntityAutocomplete
                id="reservation-customer-autocomplete"
                options={customerOptions}
                value={selectedCustomerId}
                onValueChange={(val) => {
                  setSelectedCustomerId(val);
                  const cust = CUSTOMER_MAP[val];
                  if (cust) {
                    createForm.setValue("customerName", cust.fullName, { shouldDirty: true });
                  }
                }}
                placeholder={tRes("fieldCustomer")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-customer-name" className="text-xs font-medium text-ink">
                {tRes("fieldCustomerName")}
              </Label>
              <Controller
                name="customerName"
                control={createForm.control}
                render={({ field }) => (
                  <Input
                    id="create-customer-name"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={tCommon("placeholders.guestName")}
                    className="h-10 rounded-full text-xs"
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="create-customer-phone" className="text-xs font-medium text-ink">
                  {tRes("fieldCustomerPhone")}
                </Label>
                <Controller
                  name="customerPhone"
                  control={createForm.control}
                  render={({ field }) => (
                    <Input
                      id="create-customer-phone"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={tCommon("placeholders.quickWalkInPhone")}
                      className="h-10 rounded-full font-mono text-xs"
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-customer-email" className="text-xs font-medium text-ink">
                  {tRes("fieldCustomerEmail")}
                </Label>
                <Controller
                  name="customerEmail"
                  control={createForm.control}
                  render={({ field }) => (
                    <Input
                      id="create-customer-email"
                      type="email"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="guest@example.com"
                      className="h-10 rounded-full font-mono text-xs"
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-special-requests" className="text-xs font-medium text-ink">
                {tRes("reasonLabel")}
              </Label>
              <Controller
                name="specialRequests"
                control={createForm.control}
                render={({ field }) => (
                  <Textarea
                    id="create-special-requests"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder={tRes("reasonPlaceholder")}
                    className="min-h-[80px] text-xs"
                  />
                )}
              />
            </div>
          </div>
        ),
      },
      {
        id: "tab-deposit",
        label: tRes("tabPaymentProof"),
        hasError: hasTabError("tab-deposit"),
        content: (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-deposit-amount" className="text-xs font-medium text-ink">
                {tRes("fieldDepositAmount")}
              </Label>
              <Controller
                name="depositAmount"
                control={createForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="create-deposit-amount"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={tRes("fieldDepositAmount")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
          </div>
        ),
      },
    ];

    return (
      <div className="space-y-6">
        <PageHeader
          prefixCode="RES"
          title={tRes("modalTitleCreate")}
          description={tRes("modalDescCreate")}
          actions={
            <div className="flex items-center gap-2">
              <Link href="/admin/reservations">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{tCommon("back")}</span>
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                onClick={createForm.handleSubmit(handleExecuteCreate, () => {
                  if (firstErrorTab) setActiveTab(firstErrorTab);
                })}
                disabled={createMutation.isPending}
                className="rounded-full text-xs h-9 px-5 gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>{tRes("btnSubmitCreate")}</span>
              </Button>
            </div>
          }
        />

        <FormSection>
          <FormTabs tabs={createTabs} value={activeTab} onValueChange={setActiveTab} />
        </FormSection>
      </div>
    );
  }

  if (!reservation) {
    return <PageLoading message={tRes("loadingReservation")} />;
  }

  // View / Edit / Assign Unit
  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="RES"
        title={`${reservation.documentNumber} — ${reservation.customer.fullName}`}
        description={`${resolveLocalizedText(reservation.unitType.name, locale)} • ${tModes(
          reservation.stayMode as StayModeType
        )}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/reservations">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>

            {reservation.status === "PendingVerification" && (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowConfirmModal(true)}
                disabled={confirmMutation.isPending}
                className="rounded-full text-xs h-9 px-4 gap-1.5 bg-ink text-canvas hover:bg-neutral-800"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{tRes("actionConfirm")}</span>
              </Button>
            )}

            {reservation.status !== "Cancelled" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                className="rounded-full text-xs h-9 px-4 gap-1.5 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4" />
                <span>{tRes("actionCancel")}</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 rounded-[12px] border border-hairline bg-canvas font-mono text-xs">
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Status</span>
          <Badge variant="outline" className="rounded-full">
            {reservation.status}
          </Badge>
        </div>
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Assigned Unit</span>
          <span className="font-semibold text-primary">
            {reservation.assignedUnit ? `Unit ${reservation.assignedUnit.unitNumber}` : "Unassigned"}
          </span>
        </div>
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Check-in / Out</span>
          <span>
            {reservation.slotStartAt.slice(0, 10)} → {reservation.slotEndAt.slice(0, 10)}
          </span>
        </div>
        <div>
          <span className="text-mute text-[10px] uppercase block mb-1">Deposit</span>
          <span className="font-semibold">{formatCurrencyThb(reservation.depositAmount)}</span>
        </div>
      </div>

      {/* Assign Unit Box */}
      <FormSection title={tRes("modalTitleAssign")}>
        <form onSubmit={assignForm.handleSubmit(handleExecuteAssign)} className="flex items-end gap-3">
          <div className="flex-1">
            <FormField
              id="assign-unit-select"
              label={tRes("fieldSelectUnit")}
              error={assignForm.formState.errors.unitId?.message}
            >
              <Controller
                name="unitId"
                control={assignForm.control}
                render={({ field }) => (
                  <SelectPill
                    id="assign-unit-select"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 text-xs font-mono"
                  >
                    {Object.values(SAMPLE_ASSIGNABLE_UNITS).flat().map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unitNumber} ({resolveLocalizedText(u.buildingName, locale)}) —{" "}
                        {u.conditionStatus}
                      </option>
                    ))}
                  </SelectPill>
                )}
              />
            </FormField>
          </div>
          <Button
            type="submit"
            disabled={assignMutation.isPending}
            className="rounded-full text-xs h-10 px-6 font-medium"
          >
            {tRes("btnAssignConfirm")}
          </Button>
        </form>
      </FormSection>

      {/* Confirm Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleExecuteConfirm}
        title={tRes("confirmApproveTitle")}
        message={tRes("confirmApproveMessage")}
        confirmText={tRes("actionConfirm")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={confirmMutation.isPending}
      />

      {/* Cancel Modal */}
      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleExecuteCancel}
        title={tRes("confirmCancelTitle")}
        message={tRes("confirmCancelMessage")}
        confirmText={tRes("actionCancel")}
        cancelText={tCommon("cancel")}
        variant="danger"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
