"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { CurrencyInput } from "@/components/forms/currency-input";
import { FormField } from "@/components/forms/form-field";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText, toLocalizedText } from "@/lib/i18n/localized-text";
import { usePropertyHierarchy, useUnitMasterDetail, useUpsertUnitMasterMutation, useDeleteUnitMutation } from "../api/use-properties";
import { upsertUnitMasterSchema, type UpsertUnitMasterFormValues } from "../schemas/unit-schemas";
import {
  EMPTY_ASSET,
  PERMISSION_PROPERTIES_MANAGE,
  UNIT_CONDITION_OPTIONS,
  UNIT_FORM_DEFAULTS,
  UNIT_STAY_MODES,
} from "../constants";
import type { PropertyHierarchyResponse } from "@/generated/api";
import type { UnitMasterItemDto } from "../types";

export interface UnitMasterEditorProps {
  unitId: string;
}

/** Single dynamic route body: id="create" creates, any other id views / edits / deletes the unit. */
export function UnitMasterEditor({ unitId }: UnitMasterEditorProps) {
  const { activeProperty } = useAdminWorkspace();
  const t = useTranslations("admin.properties");
  const tCommon = useTranslations("common");
  const isCreate = unitId === "create";
  const hierarchy = usePropertyHierarchy(activeProperty.id);
  const unit = useUnitMasterDetail(activeProperty.id, unitId);

  if (hierarchy.isLoading || (!isCreate && unit.isLoading)) return <PageLoading message={t("loadingUnit")} />;
  if (hierarchy.isError || (!isCreate && unit.isError)) {
    return (
      <EmptyState
        title={hierarchy.isError ? t("loadHierarchyError") : t("loadUnitError")}
        actionLabel={tCommon("retry")}
        onAction={() => {
          void hierarchy.refetch();
          if (!isCreate) void unit.refetch();
        }}
      />
    );
  }
  if (!hierarchy.data || (!isCreate && !unit.data)) return <EmptyState title={t("unitNotFound")} />;
  return <UnitForm propertyId={activeProperty.id} hierarchy={hierarchy.data} unit={unit.data} />;
}

interface UnitFormProps {
  propertyId: string;
  hierarchy: PropertyHierarchyResponse;
  unit?: UnitMasterItemDto;
}

function UnitForm({ propertyId, hierarchy, unit }: UnitFormProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.properties");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_PROPERTIES_MANAGE);
  const isEdit = unit !== undefined;

  const upsert = useUpsertUnitMasterMutation(propertyId);
  const remove = useDeleteUnitMutation(propertyId);
  const inFlight = useRef(false);
  const isBusy = upsert.isPending || remove.isPending;
  const [showSave, setShowSave] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const form = useForm<UpsertUnitMasterFormValues>({
    resolver: zodResolver(upsertUnitMasterSchema),
    values: unit
      ? {
          unitNumber: unit.unitNumber,
          buildingId: unit.building.id,
          floorId: unit.floor.id,
          unitTypeId: unit.unitType.id,
          supportedStayModes: unit.supportedStayModes,
          conditionStatus: unit.conditionStatus,
          assets: unit.assets.map((a) => ({
            assetCode: a.assetCode,
            nameTh: a.name.th,
            nameEn: a.name.en ?? "",
            replacementCostAmount: a.replacementCostAmount,
          })),
        }
      : UNIT_FORM_DEFAULTS,
  });
  const assets = useFieldArray({ control: form.control, name: "assets" });
  useUnsavedChanges(form.formState.isDirty);

  const buildingId = form.watch("buildingId");
  const modes = form.watch("supportedStayModes");
  const floors = hierarchy.buildings.filter((b) => b.id === buildingId).flatMap((b) => b.floors);

  const execute = async () => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    const v = form.getValues();
    try {
      const saved = await upsert.mutateAsync({
        id: unit?.id,
        buildingId: v.buildingId,
        floorId: v.floorId,
        unitTypeId: v.unitTypeId,
        unitNumber: v.unitNumber,
        supportedStayModes: v.supportedStayModes,
        conditionStatus: v.conditionStatus,
        assets: v.assets.map((a) => ({
          assetCode: a.assetCode,
          name: toLocalizedText(a.nameTh, a.nameEn),
          replacementCostAmount: a.replacementCostAmount,
        })),
      });
      toastSuccess(t("saveSuccess"));
      form.reset(v);
      if (!isEdit) router.push(`/admin/properties/units/${saved.id}`);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowSave(false);
    }
  };

  const executeDelete = async () => {
    if (!unit || isBusy) return;
    try {
      await remove.mutateAsync(unit.id);
      toastSuccess(t("toastUnitDeleted"));
      router.push("/admin/properties");
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="UNT"
        title={unit ? unit.unitNumber : t("modalTitleAdd")}
        description={unit ? t("detailDescription") : t("modalDesc")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/properties">
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {unit && canManage && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowDelete(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Trash2 className="h-4 w-4" />
                <span>{t("btnDelete")}</span>
              </Button>
            )}
          </div>
        }
      />
      {unit && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t(`status${unit.occupancyStatus}`)}</Badge>
          <Badge variant="outline">{t(`condition${unit.conditionStatus}`)}</Badge>
        </div>
      )}
      <form onSubmit={form.handleSubmit(() => setShowSave(true))} className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="unit-number" label={t("fieldUnitNumber")} required error={form.formState.errors.unitNumber ? tCommon("required") : undefined}>
            <Input id="unit-number" placeholder={t("placeholderUnitNumber")} disabled={!canManage || isBusy} className="h-10 rounded-full font-mono text-xs" {...form.register("unitNumber")} />
          </FormField>
          <FormField id="unit-condition" label={t("fieldConditionStatus")}>
            <SelectPill id="unit-condition" disabled={!canManage || isBusy} wrapperClassName="!mb-0" {...form.register("conditionStatus")}>
              {UNIT_CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`condition${c}`)}
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField id="unit-building" label={t("fieldBuilding")} required error={form.formState.errors.buildingId ? tCommon("required") : undefined}>
            <Controller
              name="buildingId"
              control={form.control}
              render={({ field }) => (
                <SelectPill
                  id="unit-building"
                  value={field.value}
                  disabled={!canManage || isBusy}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    form.setValue("floorId", "", { shouldDirty: true });
                  }}
                  wrapperClassName="!mb-0"
                >
                  <option value="">{t("placeholderBuilding")}</option>
                  {hierarchy.buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {resolveLocalizedText(b.name, locale)} ({b.code})
                    </option>
                  ))}
                </SelectPill>
              )}
            />
          </FormField>
          <FormField id="unit-floor" label={t("fieldFloor")} required error={form.formState.errors.floorId ? tCommon("required") : undefined}>
            <SelectPill id="unit-floor" disabled={!canManage || isBusy || !buildingId} wrapperClassName="!mb-0" {...form.register("floorId")}>
              <option value="">{t("placeholderFloor")}</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {resolveLocalizedText(f.name, locale)} ({f.floorNumber})
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField id="unit-type" label={t("fieldUnitType")} required error={form.formState.errors.unitTypeId ? tCommon("required") : undefined}>
            <SelectPill id="unit-type" disabled={!canManage || isBusy} wrapperClassName="!mb-0" {...form.register("unitTypeId")}>
              <option value="">{t("placeholderUnitType")}</option>
              {hierarchy.unitTypes.map((ut) => (
                <option key={ut.id} value={ut.id}>
                  {resolveLocalizedText(ut.name, locale)} ({ut.code})
                </option>
              ))}
            </SelectPill>
          </FormField>
          <FormField label={t("fieldStayModes")} required error={form.formState.errors.supportedStayModes ? t("errorStayModes") : undefined}>
            <div className="flex flex-wrap gap-2">
              {UNIT_STAY_MODES.map((m) => (
                <div key={m} className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5">
                  <Checkbox
                    id={`unit-mode-${m}`}
                    checked={modes.includes(m)}
                    disabled={!canManage || isBusy}
                    onCheckedChange={(c) =>
                      form.setValue("supportedStayModes", c === true ? [...modes, m] : modes.filter((x) => x !== m), { shouldDirty: true, shouldValidate: true })
                    }
                  />
                  <Label htmlFor={`unit-mode-${m}`} className="text-xs">
                    {tModes(m)}
                  </Label>
                </div>
              ))}
            </div>
          </FormField>
        </div>

        <div className="space-y-3 border-t border-hairline pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{t("tabAssets")}</h3>
            {canManage && (
              <Button type="button" size="sm" disabled={isBusy} onClick={() => assets.append(EMPTY_ASSET)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Plus className="h-4 w-4" />
                <span>{t("addAsset")}</span>
              </Button>
            )}
          </div>
          {assets.fields.length === 0 && <p className="text-xs text-mute">{t("noAssets")}</p>}
          {assets.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1.4fr_1.4fr_1fr_auto]">
              <FormField id={`asset-code-${index}`} label={t("assetCode")} error={form.formState.errors.assets?.[index]?.assetCode ? tCommon("required") : undefined}>
                <Input id={`asset-code-${index}`} placeholder={t("assetCode")} disabled={!canManage || isBusy} className="h-10 rounded-full font-mono text-xs" {...form.register(`assets.${index}.assetCode`)} />
              </FormField>
              <FormField id={`asset-th-${index}`} label={t("assetNameTh")} error={form.formState.errors.assets?.[index]?.nameTh ? tCommon("required") : undefined}>
                <Input id={`asset-th-${index}`} placeholder={t("assetNameTh")} disabled={!canManage || isBusy} className="h-10 rounded-full text-xs" {...form.register(`assets.${index}.nameTh`)} />
              </FormField>
              <FormField id={`asset-en-${index}`} label={t("assetNameEn")}>
                <Input id={`asset-en-${index}`} placeholder={t("assetNameEn")} disabled={!canManage || isBusy} className="h-10 rounded-full text-xs" {...form.register(`assets.${index}.nameEn`)} />
              </FormField>
              <FormField id={`asset-cost-${index}`} label={t("replacementCost")}>
                <Controller
                  name={`assets.${index}.replacementCostAmount`}
                  control={form.control}
                  render={({ field: f }) => (
                    <CurrencyInput id={`asset-cost-${index}`} value={f.value} onValueChange={f.onChange} placeholder={t("replacementCost")} disabled={!canManage || isBusy} wrapperClassName="!mb-0" />
                  )}
                />
              </FormField>
              {canManage && (
                <Button type="button" size="icon" variant="outline" title={t("removeAsset")} aria-label={`${t("removeAsset")} ${index + 1}`} disabled={isBusy} onClick={() => assets.remove(index)} className="h-10 w-10 rounded-full">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {canManage ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
              {isBusy ? tCommon("loading") : t("save")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-mute">{t("readOnlyHint")}</p>
        )}
      </form>

      <ConfirmationModal
        isOpen={showSave}
        onClose={() => setShowSave(false)}
        onConfirm={execute}
        title={t("confirmMasterTitle")}
        message={t("confirmMasterMessage")}
        confirmText={t("save")}
        variant="info"
        isLoading={upsert.isPending}
      />
      <ConfirmationModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={executeDelete}
        title={t("confirmDeleteUnitTitle")}
        message={t("confirmDeleteMessage", { name: unit?.unitNumber ?? "" })}
        confirmText={t("btnDelete")}
        variant="danger"
        isLoading={remove.isPending}
      />
    </div>
  );
}
