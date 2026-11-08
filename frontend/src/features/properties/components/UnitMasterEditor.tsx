"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { PageHeader } from "@/components/layout/page-header";
import type { PropertyHierarchyResponse, UnitMasterItemDto } from "@/generated/api";
import { PageLoading } from "@/components/ui/mono-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import {
  usePropertyHierarchy,
  useUnitMasterDetail,
  useUpsertUnitMasterMutation,
} from "../api/use-properties";
import { BUILDING_MAP } from "../constants";
import {
  upsertUnitMasterSchema,
  type UpsertUnitMasterFormValues,
} from "../schemas/unit-schemas";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export interface UnitMasterEditorProps {
  unitId: string;
}

export function UnitMasterEditor({ unitId }: UnitMasterEditorProps) {
  const { activeProperty } = useAdminWorkspace();
  const tProps = useTranslations("admin.properties");
  const tCommon = useTranslations("common");
  const isCreate = unitId === "create";

  const hierarchyQuery = usePropertyHierarchy(activeProperty.id);
  const unitQuery = useUnitMasterDetail(activeProperty.id, unitId);

  if (hierarchyQuery.isError) {
    return (
      <EmptyState
        title={tProps("loadHierarchyError")}
        actionLabel={tCommon("retry")}
        onAction={() => void hierarchyQuery.refetch()}
      />
    );
  }
  if (!isCreate && unitQuery.isError) {
    return (
      <EmptyState
        title={tProps("loadUnitError")}
        actionLabel={tCommon("retry")}
        onAction={() => void unitQuery.refetch()}
      />
    );
  }
  if (!hierarchyQuery.data || (!isCreate && unitQuery.isLoading)) {
    return <PageLoading message={tCommon("loading")} />;
  }
  if (!isCreate && unitQuery.data === null) {
    return <EmptyState title={tProps("unitNotFound")} />;
  }

  // Form defaults are captured on first render, so mount it only once data is ready.
  return (
    <UnitMasterEditorForm
      unitId={unitId}
      hierarchy={hierarchyQuery.data}
      unitDetail={unitQuery.data ?? undefined}
    />
  );
}

interface UnitMasterEditorFormProps {
  unitId: string;
  hierarchy: PropertyHierarchyResponse;
  unitDetail?: UnitMasterItemDto;
}

function UnitMasterEditorForm({ unitId, hierarchy, unitDetail }: UnitMasterEditorFormProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const { activeProperty } = useAdminWorkspace();
  const tProps = useTranslations("admin.properties");
  const tCommon = useTranslations("common");

  const isCreate = unitId === "create";
  const upsertMutation = useUpsertUnitMasterMutation(activeProperty.id);

  const [activeTab, setActiveTab] = useState("tab-location");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const buildings = hierarchy.buildings;
  const unitTypes = hierarchy.unitTypes;

  const form = useForm<UpsertUnitMasterFormValues>({
    resolver: zodResolver(upsertUnitMasterSchema),
    defaultValues: {
      unitNumber: unitDetail?.unitNumber ?? "",
      buildingId: unitDetail?.building.id ?? buildings[0]?.id ?? "",
      floorId: unitDetail?.floor.id ?? buildings[0]?.floors[0]?.id ?? "",
      unitTypeId: unitDetail?.unitType.id ?? unitTypes[0]?.id ?? "",
      conditionStatus: unitDetail?.conditionStatus ?? "Clean",
      occupancyStatus: unitDetail?.occupancyStatus ?? "Vacant",
      waterMeterNumber: "",
      electricMeterNumber: "",
    },
  });

  const selectedBuildingId = form.watch("buildingId");
  const currentBuilding = BUILDING_MAP[selectedBuildingId] ?? buildings[0];
  const currentFloors = currentBuilding?.floors ?? [];

  const fieldToTabMap = {
    unitNumber: "tab-location",
    buildingId: "tab-location",
    floorId: "tab-location",
    unitTypeId: "tab-config",
    conditionStatus: "tab-config",
    occupancyStatus: "tab-config",
    waterMeterNumber: "tab-meters",
    electricMeterNumber: "tab-meters",
  };

  useUnsavedChanges(form.formState.isDirty);
  const { toastSuccess, toastApiError } = useToast();

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap,
    errors: form.formState.errors,
  });

  const handleValidSubmit = () => {
    setShowConfirmModal(true);
  };

  const executeUpsert = async () => {
    try {
      const values = form.getValues();
      await upsertMutation.mutateAsync({
        id: isCreate ? undefined : unitId,
        unitNumber: values.unitNumber,
        buildingId: values.buildingId,
        floorId: values.floorId,
        unitTypeId: values.unitTypeId,
        supportedStayModes: unitDetail?.supportedStayModes ?? ["Hourly", "Daily"],
        conditionStatus: values.conditionStatus,
        assets: [],
      });
      toastSuccess(tCommon("save"));
      setShowConfirmModal(false);
      router.push("/admin/properties");
    } catch (err) {
      toastApiError(err);
    }
  };

  const tabs: FormTabItem[] = [
    {
      id: "tab-location",
      label: tProps("tabGeneral"),
      hasError: hasTabError("tab-location"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="unit-number-input" className="text-xs font-medium text-ink">
              {tProps("fieldUnitNumber")}
            </Label>
            <Controller
              name="unitNumber"
              control={form.control}
              render={({ field }) => (
                <Input
                  id="unit-number-input"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={tProps("fieldUnitNumber")}
                  className="h-10 rounded-full font-mono text-xs"
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="building-select" className="text-xs font-medium text-ink">
                {tProps("fieldBuilding")}
              </Label>
              <Controller
                name="buildingId"
                control={form.control}
                render={({ field }) => (
                  <SelectPill
                    id="building-select"
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      const b = BUILDING_MAP[e.target.value];
                      if (b && b.floors.length > 0) {
                        form.setValue("floorId", b.floors[0].id);
                      }
                    }}
                    className="h-10 text-xs font-mono"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {resolveLocalizedText(b.name, locale)} ({b.code})
                      </option>
                    ))}
                  </SelectPill>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="floor-select" className="text-xs font-medium text-ink">
                {tProps("fieldFloor")}
              </Label>
              <Controller
                name="floorId"
                control={form.control}
                render={({ field }) => (
                  <SelectPill
                    id="floor-select"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-10 text-xs font-mono"
                  >
                    {currentFloors.map((flr) => (
                      <option key={flr.id} value={flr.id}>
                        {resolveLocalizedText(flr.name, locale)} (Floor {flr.floorNumber})
                      </option>
                    ))}
                  </SelectPill>
                )}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-config",
      label: tProps("tabPhysicalSpec"),
      hasError: hasTabError("tab-config"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="unit-type-select" className="text-xs font-medium text-ink">
              {tProps("fieldUnitType")}
            </Label>
            <Controller
              name="unitTypeId"
              control={form.control}
              render={({ field }) => (
                <SelectPill
                  id="unit-type-select"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="h-10 text-xs font-mono"
                >
                  {unitTypes.map((ut) => (
                    <option key={ut.id} value={ut.id}>
                      {resolveLocalizedText(ut.name, locale)} ({ut.code})
                    </option>
                  ))}
                </SelectPill>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="condition-select" className="text-xs font-medium text-ink">
                {tProps("fieldConditionStatus")}
              </Label>
              <Controller
                name="conditionStatus"
                control={form.control}
                render={({ field }) => (
                  <SelectPill
                    id="condition-select"
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value as
                          | "Clean"
                          | "Dirty"
                          | "Cleaning"
                          | "Inspecting"
                          | "OutOfOrder"
                      )
                    }
                    className="h-10 text-xs font-mono"
                  >
                    <option value="Clean">{tProps("conditionClean")}</option>
                    <option value="Dirty">{tProps("conditionDirty")}</option>
                    <option value="Cleaning">{tProps("conditionCleaning")}</option>
                    <option value="Inspecting">{tProps("conditionInspecting")}</option>
                    <option value="OutOfOrder">{tProps("conditionOutOfOrder")}</option>
                  </SelectPill>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="occupancy-select" className="text-xs font-medium text-ink">
                {tProps("fieldOccupancyStatus")}
              </Label>
              <Controller
                name="occupancyStatus"
                control={form.control}
                render={({ field }) => (
                  <SelectPill
                    id="occupancy-select"
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value as
                          | "Vacant"
                          | "Occupied"
                          | "Reserved"
                          | "Blocked"
                      )
                    }
                    className="h-10 text-xs font-mono"
                  >
                    <option value="Vacant">{tProps("statusVacant")}</option>
                    <option value="Occupied">{tProps("statusOccupied")}</option>
                    <option value="Reserved">{tProps("statusReserved")}</option>
                    <option value="Blocked">{tProps("statusBlocked")}</option>
                  </SelectPill>
                )}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-meters",
      label: tProps("tabMeters"),
      hasError: hasTabError("tab-meters"),
      content: (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="water-meter-input" className="text-xs font-medium text-ink">
                {tProps("fieldWaterMeter")}
              </Label>
              <Controller
                name="waterMeterNumber"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="water-meter-input"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder={tCommon("placeholders.waterReading")}
                    className="h-10 rounded-full font-mono text-xs"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="electric-meter-input" className="text-xs font-medium text-ink">
                {tProps("fieldElectricMeter")}
              </Label>
              <Controller
                name="electricMeterNumber"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="electric-meter-input"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder={tCommon("placeholders.electricReading")}
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
        prefixCode="UNT"
        title={isCreate ? tProps("modalTitleAdd") : tProps("modalTitleEdit")}
        description={tProps("description")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/properties">
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
              <span>{tProps("save")}</span>
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
        title={tProps("confirmSaveTitle")}
        message={tProps("confirmSaveMessage")}
        confirmText={tProps("save")}
        cancelText={tCommon("cancel")}
        variant="info"
        isLoading={upsertMutation.isPending}
      />
    </div>
  );
}
