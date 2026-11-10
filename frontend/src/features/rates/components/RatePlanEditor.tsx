"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { CurrencyInput } from "@/components/forms/currency-input";
import { NumberInput } from "@/components/forms/number-input";
import { FormField } from "@/components/forms/form-field";
import { LocalizedTextFields } from "@/components/forms/localized-text-fields";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText, toLocalizedText } from "@/lib/i18n/localized-text";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";
import { useRatePlanDetail, useUpsertRatePlanMutation, useDeleteRatePlanMutation } from "../api/use-rates";
import { upsertRatePlanSchema, type UpsertRatePlanFormValues } from "../schemas/rate-schemas";
import { PERMISSION_RATES_MANAGE, RATE_PLAN_FORM_DEFAULTS, RATE_STAY_MODES } from "../constants";
import type { RatePlanItemDto } from "../types";

type MoneyField = "basePackagePrice" | "additionalHourPrice" | "autoCapToDailyRate" | "weekdayRate" | "weekendRate" | "holidaySurchargeAmount" | "extraGuestPrice" | "monthlyRentRate";
type IntField = "basePackageHours" | "gracePeriodMinutes" | "turnaroundBufferMinutes" | "minimumLeaseMonths" | "securityDepositMonths";

export function RatePlanEditor({ ratePlanId }: { ratePlanId: string }) {
  const { activeProperty } = useAdminWorkspace();
  const t = useTranslations("admin.rates");
  const tCommon = useTranslations("common");
  const isCreate = ratePlanId === "create";
  const hierarchy = usePropertyHierarchy(activeProperty.id);
  const plan = useRatePlanDetail(activeProperty.id, ratePlanId);

  if (hierarchy.isLoading || (!isCreate && plan.isLoading)) return <PageLoading message={t("loadingRatePlan")} />;
  if (hierarchy.isError || (!isCreate && plan.isError)) {
    return (
      <EmptyState
        title={t("loadPlanError")}
        actionLabel={tCommon("retry")}
        onAction={() => {
          void hierarchy.refetch();
          if (!isCreate) void plan.refetch();
        }}
      />
    );
  }
  if (!isCreate && !plan.data) return <EmptyState title={t("planNotFound")} />;
  return <PlanForm propertyId={activeProperty.id} unitTypes={hierarchy.data?.unitTypes ?? []} plan={plan.data} />;
}

interface PlanFormProps {
  propertyId: string;
  unitTypes: NonNullable<ReturnType<typeof usePropertyHierarchy>["data"]>["unitTypes"];
  plan?: RatePlanItemDto;
}

function PlanForm({ propertyId, unitTypes, plan }: PlanFormProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.rates");
  const tL = useTranslations("common.localized");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_RATES_MANAGE);
  const isEdit = plan !== undefined;

  const upsert = useUpsertRatePlanMutation(propertyId);
  const remove = useDeleteRatePlanMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy = upsert.isPending || remove.isPending;
  const [showSave, setShowSave] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const form = useForm<UpsertRatePlanFormValues>({
    resolver: zodResolver(upsertRatePlanSchema),
    values: plan
      ? {
          code: plan.code,
          nameTh: plan.name.th,
          nameEn: plan.name.en ?? "",
          unitTypeId: plan.unitType.id,
          supportedStayModes: plan.supportedStayModes,
          isActive: plan.isActive,
          ...plan.hourlyPackage,
          ...plan.dailyRate,
          ...plan.monthlyRate,
        }
      : RATE_PLAN_FORM_DEFAULTS,
  });
  useUnsavedChanges(form.formState.isDirty);
  const modes = form.watch("supportedStayModes");

  const execute = async () => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    const v = form.getValues();
    try {
      const saved = await upsert.mutateAsync({
        id: plan?.id,
        code: v.code,
        name: toLocalizedText(v.nameTh, v.nameEn),
        unitTypeId: v.unitTypeId,
        supportedStayModes: v.supportedStayModes,
        isActive: v.isActive,
        hourlyPackage: {
          basePackageHours: v.basePackageHours,
          basePackagePrice: v.basePackagePrice,
          additionalHourPrice: v.additionalHourPrice,
          gracePeriodMinutes: v.gracePeriodMinutes,
          autoCapToDailyRate: v.autoCapToDailyRate,
          turnaroundBufferMinutes: v.turnaroundBufferMinutes,
        },
        dailyRate: {
          weekdayRate: v.weekdayRate,
          weekendRate: v.weekendRate,
          holidaySurchargeAmount: v.holidaySurchargeAmount,
          extraGuestPrice: v.extraGuestPrice,
        },
        monthlyRate: {
          monthlyRentRate: v.monthlyRentRate,
          minimumLeaseMonths: v.minimumLeaseMonths,
          securityDepositMonths: v.securityDepositMonths,
        },
      });
      toastSuccess(t("saveSuccess"));
      form.reset(v);
      if (!isEdit) router.push(`/admin/rates/${saved.id}`);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowSave(false);
    }
  };

  const executeDelete = async () => {
    if (!plan || isBusy) return;
    try {
      await remove.mutateAsync(plan.id);
      toastSuccess(t("toastPlanDeleted"));
      router.push("/admin/rates");
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowDelete(false);
    }
  };

  const money = (name: MoneyField, label: string) => (
    <FormField key={name} id={`rp-${name}`} label={label} error={form.formState.errors[name] ? t("errorAmount") : undefined}>
      <Controller
        name={name as Path<UpsertRatePlanFormValues>}
        control={form.control}
        render={({ field }) => (
          <CurrencyInput id={`rp-${name}`} value={Number(field.value)} onValueChange={field.onChange} placeholder={label} disabled={!canManage || isBusy} wrapperClassName="!mb-0" />
        )}
      />
    </FormField>
  );
  const integer = (name: IntField, label: string) => (
    <FormField key={name} id={`rp-${name}`} label={label}>
      <Controller
        name={name as Path<UpsertRatePlanFormValues>}
        control={form.control}
        render={({ field }) => (
          <NumberInput id={`rp-${name}`} value={Number(field.value)} onValueChange={field.onChange} decimals={0} min={0} placeholder={label} disabled={!canManage || isBusy} wrapperClassName="!mb-0" />
        )}
      />
    </FormField>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="RTE"
        title={plan ? plan.code : t("modalTitleCreate")}
        description={plan ? t("detailDescription") : t("modalDesc")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/rates">
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {plan && canManage && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowDelete(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Trash2 className="h-4 w-4" />
                <span>{t("btnDelete")}</span>
              </Button>
            )}
          </div>
        }
      />
      {plan && (
        <Badge variant={plan.isActive ? "success" : "outline"}>{plan.isActive ? t("statusActive") : t("statusInactive")}</Badge>
      )}
      <form onSubmit={form.handleSubmit(() => setShowSave(true))} className="space-y-6 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="rp-code" label={t("fieldCode")} required error={form.formState.errors.code ? tCommon("required") : undefined}>
            <Input id="rp-code" placeholder={t("placeholderCode")} disabled={!canManage || isBusy} className="h-10 rounded-full font-mono text-xs" {...form.register("code")} />
          </FormField>
          <FormField id="rp-unit-type" label={t("fieldUnitType")} required error={form.formState.errors.unitTypeId ? tCommon("required") : undefined}>
            <SelectPill id="rp-unit-type" disabled={!canManage || isBusy} wrapperClassName="!mb-0" {...form.register("unitTypeId")}>
              <option value="">{t("placeholderUnitType")}</option>
              {unitTypes.map((u) => (
                <option key={u.id} value={u.id}>
                  {resolveLocalizedText(u.name, locale)} ({u.code})
                </option>
              ))}
            </SelectPill>
          </FormField>
        </div>
        <LocalizedTextFields
          idPrefix="rp-name"
          labelTh={tL("labelNameTh")}
          labelEn={tL("labelNameEn")}
          valueTh={form.watch("nameTh")}
          valueEn={form.watch("nameEn") ?? ""}
          onChangeTh={(v) => form.setValue("nameTh", v, { shouldDirty: true, shouldValidate: true })}
          onChangeEn={(v) => form.setValue("nameEn", v, { shouldDirty: true })}
          placeholderTh={tL("placeholderTh")}
          placeholderEn={tL("placeholderEn")}
          errorTh={form.formState.errors.nameTh ? tL("errorThaiRequired") : undefined}
        />
        <FormField label={t("fieldSupportedModes")} required error={form.formState.errors.supportedStayModes ? t("errorStayModes") : undefined}>
          <div className="flex flex-wrap items-center gap-2">
            {RATE_STAY_MODES.map((m) => (
              <div key={m} className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5">
                <Checkbox
                  id={`rp-mode-${m}`}
                  checked={modes.includes(m)}
                  disabled={!canManage || isBusy}
                  onCheckedChange={(c) => form.setValue("supportedStayModes", c === true ? [...modes, m] : modes.filter((x) => x !== m), { shouldDirty: true, shouldValidate: true })}
                />
                <Label htmlFor={`rp-mode-${m}`} className="text-xs">
                  {tModes(m)}
                </Label>
              </div>
            ))}
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <div className="ml-2 flex items-center gap-2">
                  <Switch id="rp-active" checked={field.value} disabled={!canManage || isBusy} onCheckedChange={field.onChange} />
                  <Label htmlFor="rp-active" className="text-xs">
                    {t("fieldIsActive")}
                  </Label>
                </div>
              )}
            />
          </div>
        </FormField>

        <section className="space-y-3 border-t border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink">{t("formTabHourly")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {integer("basePackageHours", t("fieldBasePackageHours"))}
            {money("basePackagePrice", t("fieldBasePackagePrice"))}
            {money("additionalHourPrice", t("fieldAdditionalHourPrice"))}
            {integer("gracePeriodMinutes", t("fieldGracePeriodMinutes"))}
            {money("autoCapToDailyRate", t("fieldAutoCapToDailyRate"))}
            {integer("turnaroundBufferMinutes", t("fieldTurnaroundBufferMinutes"))}
          </div>
        </section>
        <section className="space-y-3 border-t border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink">{t("sectionDaily")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {money("weekdayRate", t("fieldWeekdayRate"))}
            {money("weekendRate", t("fieldWeekendRate"))}
            {money("holidaySurchargeAmount", t("fieldHolidaySurchargeAmount"))}
            {money("extraGuestPrice", t("fieldExtraGuestPrice"))}
          </div>
        </section>
        <section className="space-y-3 border-t border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink">{t("sectionMonthly")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {money("monthlyRentRate", t("fieldMonthlyRentRate"))}
            {integer("minimumLeaseMonths", t("fieldMinimumLeaseMonths"))}
            {integer("securityDepositMonths", t("fieldSecurityDepositMonths"))}
          </div>
        </section>

        {canManage ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
              {isBusy ? tCommon("loading") : t("savePlan")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-mute">{t("readOnlyHint")}</p>
        )}
      </form>

      <ConfirmationModal isOpen={showSave} onClose={() => setShowSave(false)} onConfirm={execute} title={t("confirmSavePlanTitle")} message={t("confirmSavePlanMessage")} confirmText={t("savePlan")} variant="info" isLoading={upsert.isPending} />
      <ConfirmationModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={executeDelete} title={t("confirmDeletePlanTitle")} message={t("confirmDeleteMessage", { name: plan?.code ?? "" })} confirmText={t("btnDelete")} variant="danger" isLoading={remove.isPending} />
    </div>
  );
}
