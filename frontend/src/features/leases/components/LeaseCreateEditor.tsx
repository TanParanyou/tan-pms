"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EntityAutocomplete, type EntityAutocompleteOption } from "@/components/ui/entity-autocomplete";
import { DateTimeInput } from "@/components/ui/date-picker";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { CurrencyInput } from "@/components/forms/currency-input";
import { NumberInput } from "@/components/forms/number-input";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";
import { useCreateLeaseMutation, useAdminCustomerSearch } from "../api/use-leases";
import { leaseCreateSchema, type LeaseCreateFormValues } from "../schemas/lease-schemas";
import {
  LEASE_CREATE_DEFAULTS,
  LEASE_CREATE_TAB_IDS,
  LEASE_FIELD_TO_TAB,
  EMPTY_OCCUPANT,
  EMPTY_VEHICLE,
  CUSTOMER_SEARCH_DEBOUNCE_MS,
} from "../constants";

export function LeaseCreateEditor() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.leases");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { toastSuccess, toastApiError } = useToast();
  const createMutation = useCreateLeaseMutation(activeProperty.id);

  const [activeTab, setActiveTab] = useState<string>(LEASE_CREATE_TAB_IDS.terms);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LeaseCreateFormValues>({
    resolver: zodResolver(leaseCreateSchema),
    defaultValues: LEASE_CREATE_DEFAULTS,
  });
  const occupants = useFieldArray({ control, name: "occupants" });
  const vehicles = useFieldArray({ control, name: "vehicles" });

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap: LEASE_FIELD_TO_TAB,
    errors,
  });

  const { data: hierarchy, isPlaceholderData: isUnitsPlaceholder } = usePropertyHierarchy(activeProperty.id);
  const unitOptions = useMemo(
    () =>
      isUnitsPlaceholder
        ? []
        : (hierarchy?.units ?? [])
            .filter((u) => u.supportedStayModes.includes("Monthly"))
            .map((u) => ({
              value: u.id,
              label: `${resolveLocalizedText(u.unitType.name, locale)} (${u.unitNumber})`,
              sublabel: resolveLocalizedText(u.building.name, locale),
              disabled: u.occupancyStatus !== "Vacant",
            })),
    [hierarchy, isUnitsPlaceholder, locale]
  );

  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebouncedValue(customerSearch.trim(), CUSTOMER_SEARCH_DEBOUNCE_MS);
  const { data: customerData, isLoading: isCustomersLoading } = useAdminCustomerSearch(
    activeProperty.id,
    debouncedCustomerSearch
  );
  // Keep the picked customer in the options even after the search text changes.
  const [pickedCustomer, setPickedCustomer] = useState<EntityAutocompleteOption | null>(null);
  const customerMap = useMemo(
    () => new Map((customerData?.items ?? []).map((c) => [c.id, { value: c.id, label: `${c.fullName} (${c.maskedNationalId})` }])),
    [customerData]
  );
  const customerOptions = useMemo(() => {
    const options = Array.from(customerMap.values());
    return pickedCustomer && !customerMap.has(pickedCustomer.value)
      ? [pickedCustomer, ...options]
      : options;
  }, [customerMap, pickedCustomer]);

  const onValid = () => setShowConfirm(true);
  const onInvalid = () => {
    if (firstErrorTab) setActiveTab(firstErrorTab);
  };

  const executeCreate = async () => {
    const v = getValues();
    try {
      await createMutation.mutateAsync({
        unitId: v.unitId,
        customerId: v.customerId,
        startDate: v.startDate,
        endDate: v.endDate,
        monthlyRentAmount: v.monthlyRentAmount,
        securityDepositAmount: v.securityDepositAmount,
        initialWaterMeterReading: v.initialWaterMeterReading,
        initialElectricMeterReading: v.initialElectricMeterReading,
        occupants: v.occupants,
        vehicles: v.vehicles,
      });
      toastSuccess(t("toastCreated"));
      setShowConfirm(false);
      router.push("/admin/leases");
    } catch (err) {
      setShowConfirm(false);
      toastApiError(err);
    }
  };

  const tabs: FormTabItem[] = [
    {
      id: LEASE_CREATE_TAB_IDS.terms,
      label: t("tabTerms"),
      hasError: hasTabError(LEASE_CREATE_TAB_IDS.terms),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="lease-unit" label={t("fieldUnit")} required error={errors.unitId?.message}>
              <Controller
                name="unitId"
                control={control}
                render={({ field }) => (
                  <EntityAutocomplete
                    id="lease-unit"
                    options={unitOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("placeholderUnit")}
                    searchPlaceholder={t("placeholderUnit")}
                    hasError={Boolean(errors.unitId)}
                    wrapperClassName="!mb-0"
                  />
                )}
              />
            </FormField>
            <FormField id="lease-customer" label={t("fieldCustomer")} required error={errors.customerId?.message}>
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <EntityAutocomplete
                    id="lease-customer"
                    options={customerOptions}
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setPickedCustomer(customerMap.get(val) ?? null);
                    }}
                    onSearchChange={setCustomerSearch}
                    isLoading={isCustomersLoading}
                    placeholder={t("placeholderCustomer")}
                    searchPlaceholder={t("placeholderCustomer")}
                    hasError={Boolean(errors.customerId)}
                    wrapperClassName="!mb-0"
                  />
                )}
              />
            </FormField>
            <FormField id="lease-start" label={t("fieldStartDate")} required error={errors.startDate?.message}>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DateTimeInput
                    id="lease-start"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldStartDate")}
                    hasError={Boolean(errors.startDate)}
                  />
                )}
              />
            </FormField>
            <FormField id="lease-end" label={t("fieldEndDate")} required error={errors.endDate?.message}>
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <DateTimeInput
                    id="lease-end"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldEndDate")}
                    hasError={Boolean(errors.endDate)}
                  />
                )}
              />
            </FormField>
            <FormField id="lease-rent" label={t("fieldMonthlyRent")} required error={errors.monthlyRentAmount?.message}>
              <Controller
                name="monthlyRentAmount"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="lease-rent"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldMonthlyRent")}
                    hasError={Boolean(errors.monthlyRentAmount)}
                  />
                )}
              />
            </FormField>
            <FormField id="lease-deposit" label={t("fieldSecurityDeposit")} required error={errors.securityDepositAmount?.message}>
              <Controller
                name="securityDepositAmount"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    id="lease-deposit"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("fieldSecurityDeposit")}
                    hasError={Boolean(errors.securityDepositAmount)}
                  />
                )}
              />
            </FormField>
          </div>
        </div>
      ),
    },
    {
      id: LEASE_CREATE_TAB_IDS.meters,
      label: t("tabMeters"),
      hasError: hasTabError(LEASE_CREATE_TAB_IDS.meters),
      content: (
        <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
          <FormField id="lease-water" label={t("fieldWaterReading")} required error={errors.initialWaterMeterReading?.message}>
            <Controller
              name="initialWaterMeterReading"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="lease-water"
                  value={field.value}
                  onValueChange={field.onChange}
                  min={0}
                  decimals={2}
                  step={0.01}
                  unitSuffix="m3"
                  placeholder={tCommon("placeholders.waterReading")}
                  hasError={Boolean(errors.initialWaterMeterReading)}
                />
              )}
            />
          </FormField>
          <FormField id="lease-electric" label={t("fieldElectricReading")} required error={errors.initialElectricMeterReading?.message}>
            <Controller
              name="initialElectricMeterReading"
              control={control}
              render={({ field }) => (
                <NumberInput
                  id="lease-electric"
                  value={field.value}
                  onValueChange={field.onChange}
                  min={0}
                  decimals={2}
                  step={0.01}
                  unitSuffix="kWh"
                  placeholder={tCommon("placeholders.electricReading")}
                  hasError={Boolean(errors.initialElectricMeterReading)}
                />
              )}
            />
          </FormField>
        </div>
      ),
    },
    {
      id: LEASE_CREATE_TAB_IDS.people,
      label: t("tabPeople"),
      hasError: hasTabError(LEASE_CREATE_TAB_IDS.people),
      content: (
        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("sectionOccupants")}</h3>
              <Button
                type="button"
                size="sm"
                onClick={() => occupants.append(EMPTY_OCCUPANT)}
                className="h-9 rounded-full px-4 gap-1.5 text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>{t("btnAddOccupant")}</span>
              </Button>
            </div>
            {occupants.fields.length === 0 && <p className="text-xs text-mute">{t("noOccupants")}</p>}
            {occupants.fields.map((row, index) => (
              <div key={row.id} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[2fr_1fr_2fr_auto_auto]">
                <FormField id={`occ-name-${index}`} label={t("fieldFullName")} error={errors.occupants?.[index]?.fullName?.message}>
                  <Input
                    id={`occ-name-${index}`}
                    placeholder={tCommon("placeholders.guestName")}
                    className="h-10 rounded-full text-sm"
                    {...register(`occupants.${index}.fullName`)}
                  />
                </FormField>
                <FormField id={`occ-nat-${index}`} label={t("fieldNationality")} error={errors.occupants?.[index]?.nationalityCode?.message}>
                  <Input
                    id={`occ-nat-${index}`}
                    placeholder={t("fieldNationality")}
                    className="h-10 rounded-full font-mono text-sm"
                    {...register(`occupants.${index}.nationalityCode`)}
                  />
                </FormField>
                <FormField id={`occ-id-${index}`} label={t("fieldIdentityNumber")} error={errors.occupants?.[index]?.identityNumber?.message}>
                  <Input
                    id={`occ-id-${index}`}
                    placeholder={tCommon("placeholders.nationalId")}
                    className="h-10 rounded-full font-mono text-sm"
                    {...register(`occupants.${index}.identityNumber`)}
                  />
                </FormField>
                <Controller
                  name={`occupants.${index}.isPrimaryOccupant`}
                  control={control}
                  render={({ field }) => (
                    <div className="flex h-10 items-center gap-2">
                      <Checkbox
                        id={`occ-primary-${index}`}
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c)}
                      />
                      <Label htmlFor={`occ-primary-${index}`} className="text-xs">
                        {t("fieldPrimary")}
                      </Label>
                    </div>
                  )}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={t("btnRemove")}
                  title={t("btnRemove")}
                  onClick={() => occupants.remove(index)}
                  className="h-10 w-10 rounded-full"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("sectionVehicles")}</h3>
              <Button
                type="button"
                size="sm"
                onClick={() => vehicles.append(EMPTY_VEHICLE)}
                className="h-9 rounded-full px-4 gap-1.5 text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>{t("btnAddVehicle")}</span>
              </Button>
            </div>
            {vehicles.fields.length === 0 && <p className="text-xs text-mute">{t("noVehicles")}</p>}
            {vehicles.fields.map((row, index) => (
              <div key={row.id} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_2fr_auto]">
                <FormField id={`veh-plate-${index}`} label={t("fieldLicensePlate")} error={errors.vehicles?.[index]?.licensePlate?.message}>
                  <Input
                    id={`veh-plate-${index}`}
                    placeholder={t("fieldLicensePlate")}
                    className="h-10 rounded-full font-mono text-sm"
                    {...register(`vehicles.${index}.licensePlate`)}
                  />
                </FormField>
                <FormField id={`veh-prov-${index}`} label={t("fieldProvince")}>
                  <Input
                    id={`veh-prov-${index}`}
                    placeholder={t("fieldProvince")}
                    className="h-10 rounded-full text-sm"
                    {...register(`vehicles.${index}.province`)}
                  />
                </FormField>
                <FormField id={`veh-model-${index}`} label={t("fieldBrandModel")}>
                  <Input
                    id={`veh-model-${index}`}
                    placeholder={t("fieldBrandModel")}
                    className="h-10 rounded-full text-sm"
                    {...register(`vehicles.${index}.vehicleBrandModel`)}
                  />
                </FormField>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={t("btnRemove")}
                  title={t("btnRemove")}
                  onClick={() => vehicles.remove(index)}
                  className="h-10 w-10 rounded-full"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="LSE"
        title={t("createTitle")}
        description={t("createDescription")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/leases">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit(onValid, onInvalid)}
              disabled={createMutation.isPending}
              className="h-9 rounded-full px-5 gap-1.5 text-xs"
            >
              <Save className="h-4 w-4" />
              <span>{t("btnSaveLease")}</span>
            </Button>
          </div>
        }
      />
      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <form onSubmit={handleSubmit(onValid, onInvalid)}>
          <FormTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
        </form>
      </div>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeCreate}
        title={t("confirmCreateTitle")}
        message={t("confirmCreateMessage")}
        confirmText={t("btnSaveLease")}
        variant="info"
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
