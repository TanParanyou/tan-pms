"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityAutocomplete } from "@/components/ui/entity-autocomplete";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { PhotoAttachmentField } from "@/components/forms/photo-attachment-field";
import { useStagedPhoto } from "@/hooks/use-staged-photo";
import { ShiftNotOpenAlert } from "@/components/shared/shift-not-open-alert";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { useCustomerPicker } from "@/hooks/use-customer-picker";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";
import { stayCreateSchema, type StayCreateFormValues } from "../schemas/stay-schemas";
import { CHECK_IN_STAY_MODES, MS_PER_DAY, MS_PER_HOUR, STAY_CREATE_DEFAULTS } from "../constants";
import { useCheckInSubmit } from "../hooks/use-check-in";

export function StayCreateEditor() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const tStays = useTranslations("admin.stays");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const propertyId = activeProperty.id;

  const hierarchy = usePropertyHierarchy(propertyId);
  const customers = useCustomerPicker(propertyId);
  const { toastApiError } = useToast();
  const checkIn = useCheckInSubmit();
  const idDocument = useStagedPhoto(propertyId, "IdentityDocument");

  const [activeTab, setActiveTab] = useState("tab-room-mode");
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const [showNormalConfirm, setShowNormalConfirm] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    formState: { errors, isDirty },
  } = useForm<StayCreateFormValues>({
    resolver: zodResolver(stayCreateSchema),
    defaultValues: STAY_CREATE_DEFAULTS,
  });
  useUnsavedChanges(isDirty || idDocument.queuedFiles.length > 0);

  const selectedUnitId = watch("unitId");
  const selectedStayMode = watch("stayMode");

  // Only vacant units can be checked in; dirtiness comes from the same hierarchy response.
  const units = useMemo(() => (hierarchy.data?.units ?? []).filter((u) => u.occupancyStatus === "Vacant"), [hierarchy.data]);
  const unitOptions = useMemo(
    () =>
      units.map((u) => ({
        value: u.id,
        label: `${resolveLocalizedText(u.unitType.name, locale)} (${u.unitNumber})`,
        sublabel: `${resolveLocalizedText(u.building.name, locale)} - ${u.conditionStatus === "Clean" ? tStays("cleanBadge") : tStays("dirtyBadge")}`,
        code: u.unitNumber,
      })),
    [units, locale, tStays]
  );
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const selectedUnit = unitById.get(selectedUnitId);
  const isUnitDirty = selectedUnit !== undefined && selectedUnit.conditionStatus !== "Clean";

  const fieldToTabMap = {
    unitId: "tab-room-mode",
    customerId: "tab-room-mode",
    stayMode: "tab-room-mode",
    durationHours: "tab-room-mode",
    durationDays: "tab-room-mode",
    dirtyOverrideReason: "tab-room-mode",
    primaryGuestName: "tab-guests",
    primaryNationality: "tab-guests",
    primaryIdNumber: "tab-guests",
    primaryPhoneNumber: "tab-guests",
    keyDepositAmount: "tab-deposit",
  };
  const { hasTabError, firstErrorTab } = useFormTabErrors({ fieldToTabMap, errors });

  const onInvalidSubmit = () => {
    if (firstErrorTab) setActiveTab(firstErrorTab);
  };

  const onValidSubmit = (v: StayCreateFormValues) => {
    if (isUnitDirty) {
      if (!v.dirtyOverrideReason?.trim()) {
        setActiveTab("tab-room-mode");
        return;
      }
      setShowDirtyConfirm(true);
    } else {
      setShowNormalConfirm(true);
    }
  };

  const executeCheckIn = async () => {
    const v = getValues();
    const durationMs = v.stayMode === "Hourly" ? v.durationHours * MS_PER_HOUR : v.durationDays * MS_PER_DAY;
    // Deferred upload: only now; a failed upload aborts the check-in and keeps the form.
    let identityDocumentFileKey: string | undefined;
    try {
      identityDocumentFileKey = await idDocument.commit(null);
    } catch (err) {
      toastApiError(err);
      setShowDirtyConfirm(false);
      setShowNormalConfirm(false);
      return;
    }
    const stay = await checkIn.submit({
      propertyId,
      unitId: v.unitId,
      customerId: v.customerId,
      stayMode: v.stayMode,
      keyDepositAmount: v.keyDepositAmount,
      overrideDirtyCheckIn: isUnitDirty,
      overrideReason: isUnitDirty ? v.dirtyOverrideReason?.trim() : undefined,
      expectedCheckOutAt: new Date(Date.now() + durationMs).toISOString(),
      occupants: [
        {
          fullName: v.primaryGuestName,
          nationalityCode: v.primaryNationality,
          identityNumber: v.primaryIdNumber,
          isPrimaryOccupant: true,
          vehicleLicensePlate: v.primaryLicensePlate || undefined,
          phoneNumber: v.primaryPhoneNumber || undefined,
          identityDocumentFileKey,
        },
      ],
    });
    setShowDirtyConfirm(false);
    setShowNormalConfirm(false);
    if (stay) {
      idDocument.clear();
      router.push(`/admin/stays/${stay.id}`);
    }
  };

  if (hierarchy.isLoading) return <PageLoading message={tStays("loadingUnits")} />;
  if (hierarchy.isError) {
    return <EmptyState title={tStays("unitsLoadError")} actionLabel={tCommon("retry")} onAction={() => void hierarchy.refetch()} />;
  }

  const tabs: FormTabItem[] = [
    {
      id: "tab-room-mode",
      label: tStays("tabRoomMode"),
      hasError: hasTabError("tab-room-mode"),
      content: (
        <div className="space-y-4 pt-2">
          <FormField id="checkin-unit" label={tStays("fieldSelectUnit")} required error={errors.unitId ? tStays("errorUnitRequired") : undefined}>
            <Controller
              name="unitId"
              control={control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="checkin-unit"
                  options={unitOptions}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={tStays("placeholderUnit")}
                  searchPlaceholder={tStays("placeholderUnit")}
                  hasError={Boolean(errors.unitId)}
                  wrapperClassName="!mb-0"
                />
              )}
            />
          </FormField>

          <FormField
            id="checkin-customer"
            label={tStays("fieldCustomer")}
            required
            error={customers.isError ? tStays("customerSearchError") : errors.customerId ? tStays("errorCustomerRequired") : undefined}
            topRightAction={
              customers.isError ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void customers.refetch()} className="h-6 rounded-full px-2 text-[11px]">
                  {tCommon("retry")}
                </Button>
              ) : undefined
            }
          >
            <Controller
              name="customerId"
              control={control}
              render={({ field }) => (
                <EntityAutocomplete
                  id="checkin-customer"
                  options={customers.options}
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val);
                    customers.pick(val);
                  }}
                  onSearchChange={customers.setSearch}
                  isLoading={customers.isLoading}
                  placeholder={tStays("placeholderCustomer")}
                  searchPlaceholder={tStays("placeholderCustomer")}
                  hasError={Boolean(errors.customerId)}
                  wrapperClassName="!mb-0"
                />
              )}
            />
          </FormField>

          {isUnitDirty && (
            <div data-testid="dirty-unit-warning-box" className="space-y-2 rounded-[12px] border border-destructive/20 bg-destructive/10 p-3 text-xs">
              <div className="font-semibold text-destructive">{tStays("dirtyRoomAlert")}</div>
              <div className="space-y-1">
                <Label htmlFor="dirty-override-reason" className="text-[11px] font-medium text-destructive">
                  {tStays("fieldDirtyOverrideReason")}
                </Label>
                <Controller
                  name="dirtyOverrideReason"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="dirty-override-reason"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder={tStays("dirtyOverridePlaceholder")}
                      className="h-9 rounded-full bg-canvas text-xs"
                    />
                  )}
                />
              </div>
            </div>
          )}

          <FormField label={tStays("fieldStayMode")}>
            <Controller
              name="stayMode"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  {CHECK_IN_STAY_MODES.map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={field.value === mode ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange(mode)}
                      className="h-8 rounded-full px-4 font-mono text-xs"
                    >
                      {tModes(mode)}
                    </Button>
                  ))}
                </div>
              )}
            />
          </FormField>

          {selectedStayMode === "Hourly" ? (
            <FormField id="duration-hours" label={tStays("fieldDurationHours")}>
              <Controller
                name="durationHours"
                control={control}
                render={({ field }) => (
                  <Input id="duration-hours" type="number" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))} placeholder={tStays("fieldDurationHours")} className="h-10 rounded-full font-mono text-xs" />
                )}
              />
            </FormField>
          ) : (
            <FormField id="duration-days" label={tStays("fieldDurationDays")}>
              <Controller
                name="durationDays"
                control={control}
                render={({ field }) => (
                  <Input id="duration-days" type="number" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))} placeholder={tStays("fieldDurationDays")} className="h-10 rounded-full font-mono text-xs" />
                )}
              />
            </FormField>
          )}
        </div>
      ),
    },
    {
      id: "tab-guests",
      label: tStays("tabGuests"),
      hasError: hasTabError("tab-guests"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="primary-guest-name" label={tStays("fieldPrimaryGuestName")} required error={errors.primaryGuestName ? tStays("errorGuestRequired") : undefined}>
              <Controller name="primaryGuestName" control={control} render={({ field }) => (
                <Input id="primary-guest-name" value={field.value} onChange={field.onChange} placeholder={tCommon("placeholders.guestName")} className="h-10 rounded-full text-xs" />
              )} />
            </FormField>
            <FormField id="primary-nationality" label={tStays("fieldNationality")} required error={errors.primaryNationality ? tStays("errorGuestRequired") : undefined}>
              <Controller name="primaryNationality" control={control} render={({ field }) => (
                <Input id="primary-nationality" value={field.value} onChange={field.onChange} placeholder={tStays("fieldNationality")} className="h-10 rounded-full font-mono text-xs" />
              )} />
            </FormField>
            <FormField id="primary-id-number" label={tStays("fieldIdentityNumber")} required error={errors.primaryIdNumber ? tStays("errorGuestRequired") : undefined}>
              <Controller name="primaryIdNumber" control={control} render={({ field }) => (
                <Input id="primary-id-number" value={field.value} onChange={field.onChange} placeholder={tCommon("placeholders.nationalId")} className="h-10 rounded-full font-mono text-xs" />
              )} />
            </FormField>
            <FormField id="primary-phone" label={tStays("fieldPhone")}>
              <Controller name="primaryPhoneNumber" control={control} render={({ field }) => (
                <Input id="primary-phone" value={field.value ?? ""} onChange={field.onChange} placeholder={tCommon("placeholders.quickWalkInPhone")} className="h-10 rounded-full font-mono text-xs" />
              )} />
            </FormField>
            <FormField id="primary-license-plate" label={tStays("fieldLicensePlate")}>
              <Controller name="primaryLicensePlate" control={control} render={({ field }) => (
                <Input id="primary-license-plate" value={field.value ?? ""} onChange={field.onChange} placeholder={tStays("fieldLicensePlate")} className="h-10 rounded-full font-mono text-xs" />
              )} />
            </FormField>
          </div>
          <PhotoAttachmentField
            label={tStays("fieldAttachIdPhoto")}
            queuedFiles={idDocument.queuedFiles}
            stageFiles={idDocument.stageFiles}
            removeFile={idDocument.removeFile}
            isUploading={idDocument.isUploading}
            accept="image/*,.pdf"
          />
        </div>
      ),
    },
    {
      id: "tab-deposit",
      label: tStays("tabDeposit"),
      hasError: hasTabError("tab-deposit"),
      content: (
        <div className="space-y-4 pt-2">
          <FormField id="key-deposit-amount" label={tStays("fieldKeyDepositAmount")} error={errors.keyDepositAmount ? tStays("errorDepositInvalid") : undefined}>
            <Controller
              name="keyDepositAmount"
              control={control}
              render={({ field }) => (
                <CurrencyInput id="key-deposit-amount" value={field.value} onValueChange={field.onChange} placeholder={tStays("fieldKeyDepositAmount")} hasError={Boolean(errors.keyDepositAmount)} />
              )}
            />
          </FormField>
          <p className="text-xs text-body">{tStays("depositNote")}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {checkIn.shiftNotOpen && <ShiftNotOpenAlert />}
      <p className="text-xs text-mute">
        {tStays("monthlyHint")}{" "}
        <Link href="/admin/leases/create" className="font-medium underline">
          {tStays("monthlyHintLink")}
        </Link>
      </p>
      <PageHeader
        prefixCode="STY"
        title={tStays("modalTitleCheckIn")}
        description={tStays("modalDescCheckIn")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/stays">
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-4 font-mono text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            <Button type="button" size="sm" onClick={handleSubmit(onValidSubmit, onInvalidSubmit)} disabled={checkIn.isPending || idDocument.isUploading} className="h-9 gap-1.5 rounded-full px-5 text-xs">
              <Save className="h-4 w-4" />
              <span>{checkIn.isPending ? tCommon("loading") : tStays("saveCheckIn")}</span>
            </Button>
          </div>
        }
      />

      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <form onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}>
          <FormTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
        </form>
      </div>

      <ConfirmationModal
        isOpen={showNormalConfirm}
        onClose={() => setShowNormalConfirm(false)}
        onConfirm={executeCheckIn}
        title={tStays("confirmCheckInTitle")}
        message={tStays("confirmCheckInMessage")}
        confirmText={tStays("saveCheckIn")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={checkIn.isPending || idDocument.isUploading}
      />
      <ConfirmationModal
        isOpen={showDirtyConfirm}
        onClose={() => setShowDirtyConfirm(false)}
        onConfirm={executeCheckIn}
        title={tStays("confirmDirtyOverrideTitle")}
        message={tStays("confirmDirtyOverrideMessage")}
        confirmText={tStays("saveCheckIn")}
        cancelText={tCommon("cancel")}
        variant="danger"
        isLoading={checkIn.isPending || idDocument.isUploading}
      />
    </div>
  );
}
