"use client";

import React, { useRef } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { CurrencyInput } from "@/components/forms/currency-input";
import { NumberInput } from "@/components/forms/number-input";
import { LocalizedTextFields } from "@/components/forms/localized-text-fields";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { toLocalizedText } from "@/lib/i18n/localized-text";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { useLocale } from "next-intl";
import {
  useUpsertBuildingMutation,
  useUpsertFloorMutation,
  useUpsertUnitTypeMutation,
} from "../api/use-properties";
import {
  buildingSchema,
  floorSchema,
  unitTypeSchema,
  type BuildingFormValues,
  type FloorFormValues,
  type UnitTypeFormValues,
} from "../schemas/unit-schemas";
import { BUILDING_FORM_DEFAULTS, FLOOR_FORM_DEFAULTS, UNIT_STAY_MODES, UNIT_TYPE_FORM_DEFAULTS } from "../constants";
import type { BuildingDetailDto, UnitTypeDetailDto } from "../types";

interface BaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

function useSubmitGuard() {
  const inFlight = useRef(false);
  return {
    run: async (fn: () => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await fn();
      } finally {
        inFlight.current = false;
      }
    },
  };
}

function DialogActions({ onCancel, isBusy, label }: { onCancel: () => void; isBusy: boolean; label: string }) {
  const tCommon = useTranslations("common");
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel} className="rounded-full">
        {tCommon("cancel")}
      </Button>
      <Button type="submit" disabled={isBusy} className="rounded-full">
        {isBusy ? tCommon("loading") : label}
      </Button>
    </DialogFooter>
  );
}

export function BuildingDialog({ open, onOpenChange, propertyId, building }: BaseDialogProps & { building: BuildingDetailDto | null }) {
  const t = useTranslations("admin.properties");
  const tL = useTranslations("common.localized");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useUpsertBuildingMutation(propertyId);
  const guard = useSubmitGuard();
  const form = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    values: building ? { code: building.code, nameTh: building.name.th, nameEn: building.name.en ?? "" } : BUILDING_FORM_DEFAULTS,
  });
  useUnsavedChanges(open && form.formState.isDirty);
  const submit = form.handleSubmit((v) =>
    guard.run(async () => {
      try {
        await mutation.mutateAsync({ id: building?.id, code: v.code, name: toLocalizedText(v.nameTh, v.nameEn) });
        toastSuccess(t("toastBuildingSaved"));
        form.reset(BUILDING_FORM_DEFAULTS);
        onOpenChange(false);
      } catch (err) {
        toastApiError(err);
      }
    })
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{building ? t("editBuildingTitle") : t("createBuildingTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField id="bld-code" label={t("fieldCode")} required error={form.formState.errors.code ? tCommon("required") : undefined}>
            <Input id="bld-code" placeholder={t("placeholderCode")} disabled={mutation.isPending} className="h-10 rounded-full font-mono text-xs" {...form.register("code")} />
          </FormField>
          <LocalizedTextFields
            idPrefix="bld-name"
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
          <DialogActions onCancel={() => onOpenChange(false)} isBusy={mutation.isPending} label={tCommon("save")} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FloorDialog({
  open,
  onOpenChange,
  propertyId,
  floor,
  buildings,
}: BaseDialogProps & { floor: { id: string; buildingId: string; floorNumber: number; nameTh: string; nameEn: string } | null; buildings: BuildingDetailDto[] }) {
  const t = useTranslations("admin.properties");
  const tL = useTranslations("common.localized");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "th" | "en";
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useUpsertFloorMutation(propertyId);
  const guard = useSubmitGuard();
  const form = useForm<FloorFormValues>({
    resolver: zodResolver(floorSchema),
    values: floor
      ? { buildingId: floor.buildingId, floorNumber: floor.floorNumber, nameTh: floor.nameTh, nameEn: floor.nameEn }
      : { ...FLOOR_FORM_DEFAULTS, buildingId: buildings[0]?.id ?? "" },
  });
  useUnsavedChanges(open && form.formState.isDirty);
  const submit = form.handleSubmit((v) =>
    guard.run(async () => {
      try {
        await mutation.mutateAsync({ id: floor?.id, buildingId: v.buildingId, floorNumber: v.floorNumber, name: toLocalizedText(v.nameTh, v.nameEn) });
        toastSuccess(t("toastFloorSaved"));
        onOpenChange(false);
      } catch (err) {
        toastApiError(err);
      }
    })
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{floor ? t("editFloorTitle") : t("createFloorTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField id="flr-building" label={t("fieldBuilding")} required error={form.formState.errors.buildingId ? tCommon("required") : undefined}>
            <SelectPill id="flr-building" disabled={Boolean(floor) || mutation.isPending} wrapperClassName="!mb-0" {...form.register("buildingId")}>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {resolveLocalizedText(b.name, locale)} ({b.code})
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField id="flr-number" label={t("fieldFloorNumber")} required>
            <Controller
              name="floorNumber"
              control={form.control}
              render={({ field }) => (
                <NumberInput id="flr-number" value={field.value} onValueChange={field.onChange} decimals={0} min={-5} placeholder={t("fieldFloorNumber")} wrapperClassName="!mb-0" />
              )}
            />
          </FormField>
          <LocalizedTextFields
            idPrefix="flr-name"
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
          <DialogActions onCancel={() => onOpenChange(false)} isBusy={mutation.isPending} label={tCommon("save")} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UnitTypeDialog({ open, onOpenChange, propertyId, unitType }: BaseDialogProps & { unitType: UnitTypeDetailDto | null }) {
  const t = useTranslations("admin.properties");
  const tL = useTranslations("common.localized");
  const tCommon = useTranslations("common");
  const tModes = useTranslations("stayModes");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useUpsertUnitTypeMutation(propertyId);
  const guard = useSubmitGuard();
  const form = useForm<UnitTypeFormValues>({
    resolver: zodResolver(unitTypeSchema),
    values: unitType
      ? {
          code: unitType.code,
          nameTh: unitType.name.th,
          nameEn: unitType.name.en ?? "",
          descriptionTh: unitType.description?.th ?? "",
          descriptionEn: unitType.description?.en ?? "",
          areaSqm: unitType.areaSqm,
          totalQuotaUnits: unitType.totalQuotaUnits,
          supportedStayModes: unitType.supportedStayModes,
          hourlyBasePackagePrice: unitType.hourlyBasePackagePrice,
          hourlyBasePackageHours: unitType.hourlyBasePackageHours,
          hourlyAdditionalHourPrice: unitType.hourlyAdditionalHourPrice,
          dailyRate: unitType.dailyRate,
          monthlyRentRate: unitType.monthlyRentRate,
        }
      : UNIT_TYPE_FORM_DEFAULTS,
  });
  useUnsavedChanges(open && form.formState.isDirty);
  const modes = form.watch("supportedStayModes");
  const submit = form.handleSubmit((v) =>
    guard.run(async () => {
      try {
        await mutation.mutateAsync({
          id: unitType?.id,
          code: v.code,
          name: toLocalizedText(v.nameTh, v.nameEn),
          description: v.descriptionTh ? toLocalizedText(v.descriptionTh, v.descriptionEn) : undefined,
          areaSqm: v.areaSqm,
          totalQuotaUnits: v.totalQuotaUnits,
          supportedStayModes: v.supportedStayModes,
          hourlyBasePackagePrice: v.hourlyBasePackagePrice,
          hourlyBasePackageHours: v.hourlyBasePackageHours,
          hourlyAdditionalHourPrice: v.hourlyAdditionalHourPrice,
          dailyRate: v.dailyRate,
          monthlyRentRate: v.monthlyRentRate,
        });
        toastSuccess(t("toastUnitTypeSaved"));
        onOpenChange(false);
      } catch (err) {
        toastApiError(err);
      }
    })
  );
  const money = (name: "hourlyBasePackagePrice" | "hourlyAdditionalHourPrice" | "dailyRate" | "monthlyRentRate", label: string) => (
    <FormField id={`ut-${name}`} label={label}>
      <Controller
        name={name}
        control={form.control}
        render={({ field }) => (
          <CurrencyInput id={`ut-${name}`} value={field.value} onValueChange={field.onChange} placeholder={label} wrapperClassName="!mb-0" />
        )}
      />
    </FormField>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{unitType ? t("editUnitTypeTitle") : t("createUnitTypeTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField id="ut-code" label={t("fieldCode")} required error={form.formState.errors.code ? tCommon("required") : undefined}>
              <Input id="ut-code" placeholder={t("placeholderCode")} disabled={mutation.isPending} className="h-10 rounded-full font-mono text-xs" {...form.register("code")} />
            </FormField>
            <FormField id="ut-area" label={t("fieldAreaSqm")} error={form.formState.errors.areaSqm ? t("errorArea") : undefined}>
              <Controller name="areaSqm" control={form.control} render={({ field }) => (
                <NumberInput id="ut-area" value={field.value} onValueChange={field.onChange} decimals={1} min={0} placeholder={t("fieldAreaSqm")} wrapperClassName="!mb-0" />
              )} />
            </FormField>
            <FormField id="ut-quota" label={t("fieldQuota")}>
              <Controller name="totalQuotaUnits" control={form.control} render={({ field }) => (
                <NumberInput id="ut-quota" value={field.value} onValueChange={field.onChange} decimals={0} min={0} placeholder={t("fieldQuota")} wrapperClassName="!mb-0" />
              )} />
            </FormField>
          </div>
          <LocalizedTextFields
            idPrefix="ut-name"
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
          <LocalizedTextFields
            idPrefix="ut-desc"
            required={false}
            labelTh={tL("labelDescTh")}
            labelEn={tL("labelDescEn")}
            valueTh={form.watch("descriptionTh") ?? ""}
            valueEn={form.watch("descriptionEn") ?? ""}
            onChangeTh={(v) => form.setValue("descriptionTh", v, { shouldDirty: true })}
            onChangeEn={(v) => form.setValue("descriptionEn", v, { shouldDirty: true })}
            placeholderTh={tL("placeholderTh")}
            placeholderEn={tL("placeholderEn")}
          />
          <FormField label={t("fieldStayModes")} required error={form.formState.errors.supportedStayModes ? t("errorStayModes") : undefined}>
            <div className="flex flex-wrap gap-2">
              {UNIT_STAY_MODES.map((m) => (
                <div key={m} className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5">
                  <Checkbox
                    id={`ut-mode-${m}`}
                    checked={modes.includes(m)}
                    onCheckedChange={(c) =>
                      form.setValue("supportedStayModes", c === true ? [...modes, m] : modes.filter((x) => x !== m), { shouldDirty: true, shouldValidate: true })
                    }
                  />
                  <Label htmlFor={`ut-mode-${m}`} className="text-xs">
                    {tModes(m)}
                  </Label>
                </div>
              ))}
            </div>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {money("hourlyBasePackagePrice", t("fieldHourlyPrice"))}
            <FormField id="ut-hours" label={t("fieldHourlyHours")}>
              <Controller name="hourlyBasePackageHours" control={form.control} render={({ field }) => (
                <NumberInput id="ut-hours" value={field.value} onValueChange={field.onChange} decimals={0} min={1} placeholder={t("fieldHourlyHours")} wrapperClassName="!mb-0" />
              )} />
            </FormField>
            {money("hourlyAdditionalHourPrice", t("fieldHourlyExtra"))}
            {money("dailyRate", t("fieldDailyRate"))}
            {money("monthlyRentRate", t("fieldMonthlyRate"))}
          </div>
          <DialogActions onCancel={() => onOpenChange(false)} isBusy={mutation.isPending} label={tCommon("save")} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
