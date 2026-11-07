"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { NumberInput } from "@/components/forms/number-input";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { LocalizedTextFields } from "@/components/forms/localized-text-fields";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import {
  useRatePlanDetail,
  useUpsertRatePlanMutation,
} from "../api/use-rates";
import { SAMPLE_UNIT_TYPE_REFS } from "../constants";
import {
  upsertRatePlanSchema,
  type UpsertRatePlanFormValues,
} from "../schemas/rate-schemas";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export interface RatePlanEditorProps {
  ratePlanId: string;
}

export function RatePlanEditor({ ratePlanId }: RatePlanEditorProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const { activeProperty } = useAdminWorkspace();
  const tRates = useTranslations("admin.rates");
  const tCommon = useTranslations("common");

  const isCreate = ratePlanId === "create";

  const { data: planDetail, isLoading } = useRatePlanDetail(activeProperty.id, ratePlanId);
  const upsertMutation = useUpsertRatePlanMutation(activeProperty.id);

  const [activeTab, setActiveTab] = useState("tab-hourly");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const form = useForm<UpsertRatePlanFormValues>({
    resolver: zodResolver(upsertRatePlanSchema),
    defaultValues: {
      code: planDetail?.code ?? "",
      nameTh: planDetail?.name.th ?? "",
      nameEn: planDetail?.name.en ?? "",
      unitTypeId: planDetail?.unitType.id ?? SAMPLE_UNIT_TYPE_REFS[0].id,
      basePackageHours: planDetail?.hourlyPackage.basePackageHours ?? 3,
      basePackagePrice: planDetail?.hourlyPackage.basePackagePrice ?? 450,
      additionalHourPrice: planDetail?.hourlyPackage.additionalHourPrice ?? 120,
      weekdayRate: planDetail?.dailyRate.weekdayRate ?? 890,
      weekendRate: planDetail?.dailyRate.weekendRate ?? 1090,
      baseRentPrice: planDetail?.monthlyRate.monthlyRentRate ?? 12000,
      securityDepositMonths: planDetail?.monthlyRate.securityDepositMonths ?? 2,
    },
  });

  const fieldToTabMap = {
    code: "tab-general",
    nameTh: "tab-general",
    nameEn: "tab-general",
    unitTypeId: "tab-general",
    basePackageHours: "tab-hourly",
    basePackagePrice: "tab-hourly",
    additionalHourPrice: "tab-hourly",
    weekdayRate: "tab-daily",
    weekendRate: "tab-daily",
    baseRentPrice: "tab-monthly",
    securityDepositMonths: "tab-monthly",
  };

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap,
    errors: form.formState.errors,
  });

  useUnsavedChanges(form.formState.isDirty);
  const { toastSuccess, toastApiError } = useToast();

  if (!isCreate && (isLoading || !planDetail)) {
    return <PageLoading message={tRates("loadingRatePlan")} />;
  }

  const handleValidSubmit = () => {
    setShowConfirmModal(true);
  };

  const executeUpsert = async () => {
    try {
      const values = form.getValues();
      await upsertMutation.mutateAsync({
        id: isCreate ? undefined : ratePlanId,
        code: values.code,
        name: { th: values.nameTh, en: values.nameEn },
        unitTypeId: values.unitTypeId,
        supportedStayModes: ["Hourly", "Daily", "Monthly"],
        hourlyPackage: {
          basePackageHours: values.basePackageHours,
          basePackagePrice: values.basePackagePrice,
          additionalHourPrice: values.additionalHourPrice,
          gracePeriodMinutes: 15,
          autoCapToDailyRate: 1200,
          turnaroundBufferMinutes: 30,
        },
        dailyRate: {
          weekdayRate: values.weekdayRate,
          weekendRate: values.weekendRate,
          holidaySurchargeAmount: 200,
          extraGuestPrice: 250,
        },
        monthlyRate: {
          monthlyRentRate: values.baseRentPrice,
          minimumLeaseMonths: 1,
          securityDepositMonths: values.securityDepositMonths,
        },
        isActive: true,
      });
      toastSuccess(tCommon("save"));
      setShowConfirmModal(false);
      router.push("/admin/rates");
    } catch (err) {
      toastApiError(err);
    }
  };

  const tabs: FormTabItem[] = [
    {
      id: "tab-general",
      label: tRates("tabGeneral"),
      hasError: hasTabError("tab-general"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="plan-code-input"
              label={tRates("fieldPlanCode")}
              required
              error={form.formState.errors.code?.message}
            >
              <Controller
                name="code"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="plan-code-input"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="RP-STD-2026"
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </FormField>

            <FormField
              id="plan-unit-type"
              label={tRates("fieldUnitType")}
              required
              error={form.formState.errors.unitTypeId?.message}
            >
              <Controller
                name="unitTypeId"
                control={form.control}
                render={({ field }) => (
                  <SelectPill
                    id="plan-unit-type"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 text-xs font-mono"
                  >
                    {SAMPLE_UNIT_TYPE_REFS.map((ut) => (
                      <option key={ut.id} value={ut.id}>
                        {resolveLocalizedText(ut.name, locale)} ({ut.code})
                      </option>
                    ))}
                  </SelectPill>
                )}
              />
            </FormField>
          </div>

          <Controller
            name="nameTh"
            control={form.control}
            render={({ field: fieldTh }) => (
              <Controller
                name="nameEn"
                control={form.control}
                render={({ field: fieldEn }) => (
                  <LocalizedTextFields
                    idPrefix="plan-name"
                    labelTh={tRates("fieldNameTh")}
                    labelEn={tRates("fieldNameEn")}
                    valueTh={fieldTh.value}
                    valueEn={fieldEn.value}
                    onChangeTh={fieldTh.onChange}
                    onChangeEn={fieldEn.onChange}
                    placeholderTh={tRates("fieldNameTh")}
                    placeholderEn={tRates("fieldNameEn")}
                    errorTh={form.formState.errors.nameTh?.message}
                    errorEn={form.formState.errors.nameEn?.message}
                  />
                )}
              />
            )}
          />
        </div>
      ),
    },
    {
      id: "tab-hourly",
      label: tRates("tabHourly"),
      hasError: hasTabError("tab-hourly"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="base-pkg-hours" className="text-xs font-medium text-ink">
                {tRates("fieldBasePackageHours")}
              </Label>
              <Controller
                name="basePackageHours"
                control={form.control}
                render={({ field }) => (
                  <NumberInput
                    id="base-pkg-hours"
                    decimals={0}
                    min={1}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="3"
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="base-pkg-price" className="text-xs font-medium text-ink">
                {tRates("fieldBasePackagePrice")}
              </Label>
              <Controller
                name="basePackagePrice"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="base-pkg-price"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="450"
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-hour-price" className="text-xs font-medium text-ink">
                {tRates("fieldAdditionalHourPrice")}
              </Label>
              <Controller
                name="additionalHourPrice"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="add-hour-price"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="120"
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
      id: "tab-daily",
      label: tRates("tabDaily"),
      hasError: hasTabError("tab-daily"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="weekday-rate" className="text-xs font-medium text-ink">
                {tRates("fieldWeekdayRate")}
              </Label>
              <Controller
                name="weekdayRate"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="weekday-rate"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="890"
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="weekend-rate" className="text-xs font-medium text-ink">
                {tRates("fieldWeekendRate")}
              </Label>
              <Controller
                name="weekendRate"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="weekend-rate"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="1090"
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
      id: "tab-monthly",
      label: tRates("tabMonthly"),
      hasError: hasTabError("tab-monthly"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="base-rent-price" className="text-xs font-medium text-ink">
                {tRates("fieldBaseRentPrice")}
              </Label>
              <Controller
                name="baseRentPrice"
                control={form.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="base-rent-price"
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="12000"
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sec-deposit-months" className="text-xs font-medium text-ink">
                {tRates("fieldSecurityDepositMonths")}
              </Label>
              <Controller
                name="securityDepositMonths"
                control={form.control}
                render={({ field }) => (
                  <NumberInput
                    id="sec-deposit-months"
                    decimals={0}
                    min={1}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="2"
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="RAT"
        title={isCreate ? tRates("modalTitleCreate") : tRates("modalTitleEdit")}
        description={tRates("description")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/rates">
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
              onClick={form.handleSubmit(handleValidSubmit, () => {
                if (firstErrorTab) setActiveTab(firstErrorTab);
              })}
              disabled={upsertMutation.isPending}
              className="rounded-full text-xs h-9 px-5 gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{tRates("saveRatePlan")}</span>
            </Button>
          </div>
        }
      />

      <FormSection>
        <form onSubmit={form.handleSubmit(handleValidSubmit)}>
          <FormTabs tabs={tabs} value={activeTab} onValueChange={setActiveTab} />
        </form>
      </FormSection>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={executeUpsert}
        title={tRates("confirmSaveTitle")}
        message={tRates("confirmSaveMessage")}
        confirmText={tRates("saveRatePlan")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={upsertMutation.isPending}
      />
    </div>
  );
}
