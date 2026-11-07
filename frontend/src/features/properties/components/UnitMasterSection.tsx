"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useDataTableState } from "@/hooks/use-data-table-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { ListToolbar } from "@/components/layout/list-toolbar";
import { BulkActionToolbar } from "@/components/layout/bulk-action-toolbar";
import { formatDecimal } from "@/lib/formatters";
import {
  BedDouble,
  Building2,
  Layers,
  Plus,
  Settings2,
  Tag,
} from "lucide-react";
import {
  INITIAL_BUILDINGS,
  INITIAL_UNIT_TYPES,
  INITIAL_UNIT_MASTER_ITEMS,
  SAMPLE_ROOM_ASSETS,
  BUILDING_MAP,
  UNIT_TYPE_MAP,
  FLOOR_MAP,
} from "../constants";
import type {
  UnitMasterItemDto,
  UnitAssetDto,
  UpsertUnitAssetItemDto,
  BuildingDetailDto,
} from "../types";

export interface UnitMasterSectionProps {
  initialUnits?: UnitMasterItemDto[];
  isLoading?: boolean;
}

export function UnitMasterSection({
  initialUnits = INITIAL_UNIT_MASTER_ITEMS,
  isLoading = false,
}: UnitMasterSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tProp = useTranslations("admin.properties");
  const tOccupancy = useTranslations("occupancyStatus");
  const tCondition = useTranslations("conditionStatus");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");

  const [units, setUnits] = useState<UnitMasterItemDto[]>(initialUnits);
  // Filters & Table State
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    selectedIds: selectedRowIds,
    setSelectedIds: setSelectedRowIds,
  } = useDataTableState<{ building: string; stayMode: string }>({
    initialFilters: { building: "All", stayMode: "All" },
    debounceMs: 0,
  });
  const selectedBuildingFilter = filters.building;
  const setSelectedBuildingFilter = (v: string) => setFilter("building", v);
  const selectedStayModeFilter = filters.stayMode;
  const setSelectedStayModeFilter = (v: string) => setFilter("stayMode", v);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  // Form Fields
  const [formUnitNumber, setFormUnitNumber] = useState("");
  const [formBuildingId, setFormBuildingId] = useState(INITIAL_BUILDINGS[0].id);
  const [formFloorId, setFormFloorId] = useState(
    INITIAL_BUILDINGS[0].floors[0].id
  );
  const [formUnitTypeId, setFormUnitTypeId] = useState(INITIAL_UNIT_TYPES[0].id);
  const [formConditionStatus, setFormConditionStatus] = useState<
    "Clean" | "Dirty" | "Cleaning" | "Inspecting" | "OutOfOrder"
  >("Clean");
  const [formSupportedModes, setFormSupportedModes] = useState<
    ("Hourly" | "Daily" | "Monthly")[]
  >(["Hourly", "Daily"]);
  const [formAssets, setFormAssets] = useState<UpsertUnitAssetItemDto[]>([]);
  const [activeTab, setActiveTab] = useState("tab-unit");

  // New Asset Quick Add Form State
  const [newAssetCode, setNewAssetCode] = useState("");
  const [newAssetNameTh, setNewAssetNameTh] = useState("");
  const [newAssetNameEn, setNewAssetNameEn] = useState("");
  const [newAssetCost, setNewAssetCost] = useState("1000");

  // Confirmation Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available floors for selected building in form
  const availableFloors = useMemo(() => {
    const building = BUILDING_MAP[formBuildingId];
    return building ? building.floors : [];
  }, [formBuildingId]);

  // Handle building change in form
  const handleBuildingChange = (bldId: string) => {
    setFormBuildingId(bldId);
    const bld = BUILDING_MAP[bldId];
    if (bld && bld.floors.length > 0) {
      setFormFloorId(bld.floors[0].id);
    }
  };

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const matchesBuilding =
        selectedBuildingFilter === "All" ||
        u.building.id === selectedBuildingFilter ||
        u.building.code === selectedBuildingFilter;
      const matchesStayMode =
        selectedStayModeFilter === "All" ||
        u.supportedStayModes.includes(
          selectedStayModeFilter as "Hourly" | "Daily" | "Monthly"
        );
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        u.unitNumber.toLowerCase().includes(q) ||
        u.building.code.toLowerCase().includes(q) ||
        u.unitType.code.toLowerCase().includes(q);
      return matchesBuilding && matchesStayMode && matchesQuery;
    });
  }, [units, selectedBuildingFilter, selectedStayModeFilter, searchQuery]);

  const handleOpenCreate = () => {
    setEditingUnitId(null);
    setFormUnitNumber("");
    setFormBuildingId(INITIAL_BUILDINGS[0].id);
    setFormFloorId(INITIAL_BUILDINGS[0].floors[0].id);
    setFormUnitTypeId(INITIAL_UNIT_TYPES[0].id);
    setFormConditionStatus("Clean");
    setFormSupportedModes(["Hourly", "Daily"]);
    setFormAssets(
      SAMPLE_ROOM_ASSETS.map((a) => ({
        assetCode: a.assetCode,
        name: { ...a.name },
        replacementCostAmount: a.replacementCostAmount,
      }))
    );
    setNewAssetCode(`AST-${String(Date.now()).slice(-5)}`);
    setNewAssetNameTh("");
    setNewAssetNameEn("");
    setNewAssetCost("1000");
    setActiveTab("tab-unit");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: UnitMasterItemDto) => {
    setEditingUnitId(unit.id);
    setFormUnitNumber(unit.unitNumber);
    setFormBuildingId(unit.building.id);
    setFormFloorId(unit.floor.id);
    setFormUnitTypeId(unit.unitType.id);
    setFormConditionStatus(unit.conditionStatus);
    setFormSupportedModes([...unit.supportedStayModes]);
    setFormAssets(
      unit.assets.map((a) => ({
        assetCode: a.assetCode,
        name: { ...a.name },
        replacementCostAmount: a.replacementCostAmount,
      }))
    );
    setNewAssetCode(`AST-${String(Date.now()).slice(-5)}`);
    setNewAssetNameTh("");
    setNewAssetNameEn("");
    setNewAssetCost("1000");
    setActiveTab("tab-unit");
    setIsModalOpen(true);
  };

  const handleToggleStayMode = (mode: "Hourly" | "Daily" | "Monthly") => {
    setFormSupportedModes((prev) =>
      prev.includes(mode)
        ? prev.length > 1
          ? prev.filter((m) => m !== mode)
          : prev
        : [...prev, mode]
    );
  };

  const handleAddAsset = () => {
    if (!newAssetCode.trim() || (!newAssetNameTh.trim() && !newAssetNameEn.trim())) {
      return;
    }
    const cost = parseFloat(newAssetCost) || 0;
    const newAsset: UpsertUnitAssetItemDto = {
      assetCode: newAssetCode.trim(),
      name: {
        th: newAssetNameTh.trim() || newAssetNameEn.trim(),
        en: newAssetNameEn.trim() || newAssetNameTh.trim(),
      },
      replacementCostAmount: cost,
    };
    setFormAssets((prev) => [...prev, newAsset]);
    setNewAssetCode(`AST-${String(Date.now()).slice(-5)}`);
    setNewAssetNameTh("");
    setNewAssetNameEn("");
    setNewAssetCost("1000");
  };

  const handleRemoveAsset = (index: number) => {
    setFormAssets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleTriggerSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUnitNumber.trim()) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSubmitting(true);
    try {
      const selectedBuilding =
        BUILDING_MAP[formBuildingId] ??
        INITIAL_BUILDINGS[0];
      const selectedFloor =
        FLOOR_MAP[formFloorId] ??
        selectedBuilding.floors[0];
      const selectedUnitType =
        UNIT_TYPE_MAP[formUnitTypeId] ??
        INITIAL_UNIT_TYPES[0];

      const resolvedAssets: UnitAssetDto[] = formAssets.map((a, idx) => ({
        id: `ast-${idx + 1}-${Date.now()}`,
        assetCode: a.assetCode,
        name: { ...a.name },
        replacementCostAmount: a.replacementCostAmount,
      }));

      if (editingUnitId) {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === editingUnitId
              ? {
                  ...u,
                  unitNumber: formUnitNumber.trim(),
                  building: {
                    id: selectedBuilding.id,
                    code: selectedBuilding.code,
                    name: { ...selectedBuilding.name },
                  },
                  floor: {
                    id: selectedFloor.id,
                    floorNumber: selectedFloor.floorNumber,
                    name: { ...selectedFloor.name },
                  },
                  unitType: {
                    id: selectedUnitType.id,
                    code: selectedUnitType.code,
                    name: { ...selectedUnitType.name },
                    areaSqm: selectedUnitType.areaSqm,
                  },
                  conditionStatus: formConditionStatus,
                  supportedStayModes: formSupportedModes,
                  assets: resolvedAssets,
                }
              : u
          )
        );
      } else {
        const newUnit: UnitMasterItemDto = {
          id: `u-${Date.now()}`,
          unitNumber: formUnitNumber.trim(),
          building: {
            id: selectedBuilding.id,
            code: selectedBuilding.code,
            name: { ...selectedBuilding.name },
          },
          floor: {
            id: selectedFloor.id,
            floorNumber: selectedFloor.floorNumber,
            name: { ...selectedFloor.name },
          },
          unitType: {
            id: selectedUnitType.id,
            code: selectedUnitType.code,
            name: { ...selectedUnitType.name },
            areaSqm: selectedUnitType.areaSqm,
          },
          occupancyStatus: "Vacant",
          conditionStatus: formConditionStatus,
          supportedStayModes: formSupportedModes,
          assets: resolvedAssets,
        };
        setUnits((prev) => [newUnit, ...prev]);
      }

      setIsConfirmOpen(false);
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<UnitMasterItemDto>[] = [
    {
      id: "unit",
      header: tProp("colUnit"),
      headerClassName: "w-[160px]",
      sortable: true,
      sortValue: (row) => row.unitNumber,
      cell: (row) => (
        <div>
          <span className="font-mono font-bold text-ink block text-sm">
            {row.unitNumber}
          </span>
          <span className="text-[11px] text-body block">
            {resolveLocalizedText(row.building.name, locale)} • {resolveLocalizedText(row.floor.name, locale)}
          </span>
        </div>
      ),
    },
    {
      id: "unitType",
      header: tProp("colUnitType"),
      headerClassName: "w-[180px]",
      cell: (row) => (
        <div>
          <span className="text-xs font-medium text-ink block">
            {resolveLocalizedText(row.unitType.name, locale)}
          </span>
          <span className="text-[11px] font-mono text-body">
            {row.unitType.areaSqm} sqm
          </span>
        </div>
      ),
    },
    {
      id: "stayModes",
      header: tProp("colStayModes"),
      headerClassName: "w-[180px]",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.supportedStayModes.map((mode) => (
            <Badge key={mode} variant="mono" className="text-[10px]">
              {tModes(mode as "Hourly" | "Daily" | "Monthly")}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "status",
      header: tProp("colStatus"),
      headerClassName: "w-[160px]",
      cell: (row) => {
        const condVariant =
          row.conditionStatus === "Clean"
            ? "success"
            : row.conditionStatus === "Dirty"
            ? "destructive"
            : "warning";
        const occVariant =
          row.occupancyStatus === "Vacant"
            ? "outline"
            : row.occupancyStatus === "Occupied"
            ? "default"
            : "secondary";
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={condVariant} className="text-[10px]">
              {tCondition(row.conditionStatus as "Clean" | "Dirty" | "Cleaning" | "Inspecting" | "OutOfOrder")}
            </Badge>
            <Badge variant={occVariant} className="text-[10px]">
              {tOccupancy(row.occupancyStatus as "Vacant" | "Occupied" | "Reserved" | "Blocked")}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "assets",
      header: tProp("colAssets"),
      headerClassName: "w-[240px]",
      cell: (row) => {
        const totalValue = row.assets.reduce(
          (acc, a) => acc + a.replacementCostAmount,
          0
        );
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {row.assets.length} {tProp("assetsCount")}
              </Badge>
              <span className="text-[11px] font-mono text-body tabular-nums">
                {tCommon("currencySymbol")}{formatDecimal(totalValue, 0)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {row.assets.slice(0, 2).map((a) => (
                <CommandTag key={a.id} className="text-[9px] py-0 px-1.5">
                  {a.assetCode}
                </CommandTag>
              ))}
              {row.assets.length > 2 && (
                <span className="text-[10px] text-mute">
                  +{row.assets.length - 2}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: <span className="sr-only">{tProp("colActions")}</span>,
      headerClassName: "w-[80px] text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end">
          <Tooltip content={tProp("configureUnit")} position="top">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleOpenEdit(row)}
              aria-label={tProp("configureUnit")}
              className="rounded-full h-7 w-7 text-ink hover:bg-surface-soft"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="sr-only">{tProp("configureUnit")}</span>
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const modalTabs: FormTabItem[] = [
    {
      id: "tab-unit",
      label: tProp("tabUnit"),
      content: (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="unit-number" className="text-xs font-medium text-ink">
                {tProp("fieldUnitNumber")}
              </Label>
              <Input
                id="unit-number"
                value={formUnitNumber}
                onChange={(e) => setFormUnitNumber(e.target.value)}
                placeholder="A-101"
                required
                className="h-10 text-xs font-mono font-bold"
                wrapperClassName="!mb-0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit-condition" className="text-xs font-medium text-ink">
                {tProp("fieldCondition")}
              </Label>
              <SelectPill
                id="unit-condition"
                value={formConditionStatus}
                onChange={(e) =>
                  setFormConditionStatus(
                    e.target.value as "Clean" | "Dirty" | "Cleaning" | "Inspecting" | "OutOfOrder"
                  )
                }
                className="h-10 text-xs"
              >
                <option value="Clean">{tCondition("Clean")}</option>
                <option value="Dirty">{tCondition("Dirty")}</option>
                <option value="Cleaning">{tCondition("Cleaning")}</option>
                <option value="Inspecting">{tCondition("Inspecting")}</option>
                <option value="OutOfOrder">{tCondition("OutOfOrder")}</option>
              </SelectPill>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="unit-building" className="text-xs font-medium text-ink">
                {tProp("fieldBuilding")}
              </Label>
              <SelectPill
                id="unit-building"
                value={formBuildingId}
                onChange={(e) => handleBuildingChange(e.target.value)}
                className="h-10 text-xs"
              >
                {INITIAL_BUILDINGS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {resolveLocalizedText(b.name, locale)}
                  </option>
                ))}
              </SelectPill>
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit-floor" className="text-xs font-medium text-ink">
                {tProp("fieldFloor")}
              </Label>
              <SelectPill
                id="unit-floor"
                value={formFloorId}
                onChange={(e) => setFormFloorId(e.target.value)}
                className="h-10 text-xs"
              >
                {availableFloors.map((flr) => (
                  <option key={flr.id} value={flr.id}>
                    {resolveLocalizedText(flr.name, locale)} ({flr.unitCount} units)
                  </option>
                ))}
              </SelectPill>
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit-type" className="text-xs font-medium text-ink">
                {tProp("fieldUnitType")}
              </Label>
              <SelectPill
                id="unit-type"
                value={formUnitTypeId}
                onChange={(e) => setFormUnitTypeId(e.target.value)}
                className="h-10 text-xs"
              >
                {INITIAL_UNIT_TYPES.map((ut) => (
                  <option key={ut.id} value={ut.id}>
                    {resolveLocalizedText(ut.name, locale)} ({ut.areaSqm} sqm)
                  </option>
                ))}
              </SelectPill>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-medium text-ink">
              {tProp("fieldStayModes")}
            </Label>
            <div className="flex flex-wrap gap-2">
              {(["Hourly", "Daily", "Monthly"] as const).map((mode) => {
                const isSelected = formSupportedModes.includes(mode);
                return (
                  <Button
                    key={mode}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleStayMode(mode)}
                    className="rounded-full h-8 px-3 text-xs"
                  >
                    {tModes(mode)}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-assets",
      label: tProp("tabAssets"),
      content: (
        <div className="space-y-4 py-2">
          {/* Asset List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {formAssets.length === 0 ? (
              <div className="text-center p-4 text-body text-xs rounded-lg border border-hairline bg-surface-soft">
                {tProp("emptyDesc")}
              </div>
            ) : (
              formAssets.map((asset, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-hairline bg-surface-soft gap-2 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <CommandTag className="text-[10px] font-mono">
                        {asset.assetCode}
                      </CommandTag>
                      <span className="font-medium text-ink truncate">
                        {resolveLocalizedText(asset.name, locale)}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-body tabular-nums">
                      {tProp("replacementCost")}: {tCommon("currencySymbol")}
                      {formatDecimal(asset.replacementCostAmount, 0)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAsset(idx)}
                    className="rounded-full h-7 px-2.5 text-destructive text-[11px]"
                  >
                    {tProp("removeAsset")}
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Quick Add Asset Box */}
          <div className="p-3 rounded-lg border border-hairline bg-canvas space-y-3">
            <span className="text-xs font-semibold text-ink block">
              + {tProp("addAsset")}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Input
                value={newAssetCode}
                onChange={(e) => setNewAssetCode(e.target.value)}
                placeholder={tProp("assetCode")}
                className="h-8 text-xs font-mono"
                wrapperClassName="!mb-0"
              />
              <Input
                value={newAssetCost}
                type="number"
                onChange={(e) => setNewAssetCost(e.target.value)}
                placeholder={tProp("replacementCost")}
                className="h-8 text-xs font-mono"
                wrapperClassName="!mb-0"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Input
                value={newAssetNameTh}
                onChange={(e) => setNewAssetNameTh(e.target.value)}
                placeholder={tProp("assetNameTh")}
                className="h-8 text-xs"
                wrapperClassName="!mb-0"
              />
              <Input
                value={newAssetNameEn}
                onChange={(e) => setNewAssetNameEn(e.target.value)}
                placeholder={tProp("assetNameEn")}
                className="h-8 text-xs"
                wrapperClassName="!mb-0"
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAsset}
                className="rounded-full h-8 px-4 text-xs"
              >
                + {tProp("addAsset")}
              </Button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4" aria-label="Property and Unit Master Section">
      {/* Header and Add Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-rounded font-medium text-ink">
            {tProp("title")}
          </h2>
          <p className="text-xs text-body">{tProp("description")}</p>
        </div>
        <Button
          type="button"
          onClick={handleOpenCreate}
          size="sm"
          className="rounded-full shadow-none gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{tProp("addUnit")}</span>
        </Button>
      </div>

      {/* Hierarchy Summary Pills */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Badge variant="outline" className="px-3 py-1 text-xs gap-1.5 font-normal">
          <Building2 className="h-3.5 w-3.5 text-body" />
          <span>{INITIAL_BUILDINGS.length} {tProp("summaryBuildings")}</span>
        </Badge>
        <Badge variant="outline" className="px-3 py-1 text-xs gap-1.5 font-normal">
          <Layers className="h-3.5 w-3.5 text-body" />
          <span>{INITIAL_BUILDINGS.reduce((sum, b) => sum + b.floors.length, 0)} {tProp("summaryFloors")}</span>
        </Badge>
        <Badge variant="outline" className="px-3 py-1 text-xs gap-1.5 font-normal">
          <BedDouble className="h-3.5 w-3.5 text-body" />
          <span>{INITIAL_UNIT_TYPES.length} {tProp("summaryUnitTypes")}</span>
        </Badge>
        <Badge variant="mono" className="px-3 py-1 text-xs gap-1.5 font-normal">
          <Tag className="h-3.5 w-3.5 text-body" />
          <span>{units.length} {tProp("summaryTotalUnits")}</span>
        </Badge>
      </div>

      {/* Filter and Search Bar */}
      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={tProp("searchPlaceholder")}
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-full sm:w-52">
              <SelectPill
                value={selectedBuildingFilter}
                onChange={(e) => setSelectedBuildingFilter(e.target.value)}
                className="rounded-full h-10 text-xs bg-canvas"
              >
                <option value="All">{tProp("filterBuildingAll")}</option>
                {INITIAL_BUILDINGS.map((b) => (
                  <option key={b.id} value={b.code}>
                    {b.code} — {resolveLocalizedText(b.name, locale)}
                  </option>
                ))}
              </SelectPill>
            </div>
            <div className="w-full sm:w-48">
              <SelectPill
                value={selectedStayModeFilter}
                onChange={(e) => setSelectedStayModeFilter(e.target.value)}
                className="rounded-full h-10 text-xs bg-canvas"
              >
                <option value="All">{tProp("filterStayModeAll")}</option>
                <option value="Hourly">{tModes("Hourly")}</option>
                <option value="Daily">{tModes("Daily")}</option>
                <option value="Monthly">{tModes("Monthly")}</option>
              </SelectPill>
            </div>
          </div>
        }
      />

      {/* Unit Master DataTable (Table-Preserved Architecture) */}
      <DataTable
        columns={columns}
        data={filteredUnits}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        enableRowSelection
        selectedRowIds={selectedRowIds}
        onSelectionChange={setSelectedRowIds}
        enablePagination
        pageSize={20}
        emptyTitle={tProp("emptyTitle")}
        emptyDescription={tProp("emptyDesc")}
      />

      <BulkActionToolbar
        selectedCount={selectedRowIds.length}
        onClearSelection={() => setSelectedRowIds([])}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7 text-canvas border-canvas/40 hover:bg-canvas/20"
            onClick={() => setSelectedRowIds([])}
          >
            {tCommon("actions")}
          </Button>
        }
      />

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingUnitId ? tProp("modalTitleEdit") : tProp("modalTitleCreate")}
            </DialogTitle>
            <DialogDescription>{tProp("modalDesc")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerSave} className="space-y-4 pt-2">
            <FormTabs
              tabs={modalTabs}
              value={activeTab}
              onValueChange={setActiveTab}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full h-9 text-xs"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-full h-9 text-xs"
              >
                {tCommon("save")} →
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* High-Risk Master Data Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={tProp("confirmMasterTitle")}
        message={tProp("confirmMasterMessage")}
        confirmText={tCommon("confirm")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isSubmitting}
      />
    </section>
  );
}
