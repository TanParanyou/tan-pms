"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { usePropertyHierarchy } from "../api/use-properties";
import { ALL_BUILDINGS_FILTER, PERMISSION_PROPERTIES_MANAGE } from "../constants";
import type { UnitMasterItemDto } from "../types";

export function UnitMasterSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.properties");
  const tModes = useTranslations("stayModes");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSION_PROPERTIES_MANAGE);
  const [search, setSearch] = useState("");
  const [buildingId, setBuildingId] = useState(ALL_BUILDINGS_FILTER);
  const debounced = useDebouncedValue(search.trim().toLowerCase(), 200);

  const { data, isLoading, isError, refetch } = usePropertyHierarchy(activeProperty.id);
  const units = useMemo(
    () =>
      (data?.units ?? []).filter((u) => {
        if (buildingId !== ALL_BUILDINGS_FILTER && u.building.id !== buildingId) return false;
        if (!debounced) return true;
        return (
          u.unitNumber.toLowerCase().includes(debounced) ||
          resolveLocalizedText(u.unitType.name, locale).toLowerCase().includes(debounced)
        );
      }),
    [data, buildingId, debounced, locale]
  );

  const columns: ColumnDef<UnitMasterItemDto>[] = [
    { id: "unit", header: t("colUnit"), cell: (u) => <span className="font-mono text-xs font-medium">{u.unitNumber}</span> },
    {
      id: "building",
      header: t("fieldBuilding"),
      cell: (u) => (
        <span className="text-xs">
          {resolveLocalizedText(u.building.name, locale)} / {resolveLocalizedText(u.floor.name, locale)}
        </span>
      ),
    },
    { id: "type", header: t("colUnitType"), cell: (u) => <span className="text-xs">{resolveLocalizedText(u.unitType.name, locale)}</span> },
    { id: "modes", header: t("colStayModes"), cell: (u) => <span className="text-xs">{u.supportedStayModes.map((m) => tModes(m)).join(", ")}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">{t(`condition${u.conditionStatus}`)}</Badge>
          <Badge variant={u.occupancyStatus === "Vacant" ? "success" : "default"}>{t(`status${u.occupancyStatus}`)}</Badge>
        </div>
      ),
    },
    { id: "assets", header: t("colAssets"), align: "right", cell: (u) => <span className="font-mono text-xs tabular-nums">{u.assets.length}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="w-64">
            <Input aria-label={t("searchPlaceholder")} placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} wrapperClassName="!mb-0" className="h-10 rounded-full text-sm" />
          </div>
          <div className="w-52">
            <SelectPill aria-label={t("fieldBuilding")} value={buildingId} onChange={(e) => setBuildingId(e.target.value)} wrapperClassName="!mb-0">
              <option value={ALL_BUILDINGS_FILTER}>{t("filterBuildingAll")}</option>
              {(data?.buildings ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {resolveLocalizedText(b.name, locale)}
                </option>
              ))}
            </SelectPill>
          </div>
        </div>
        {canManage && (
          <Button type="button" size="sm" onClick={() => router.push("/admin/properties/units/create")} className="h-9 gap-1.5 rounded-full px-4 text-xs">
            <Plus className="h-4 w-4" />
            <span>{t("addUnit")}</span>
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={units}
        getRowId={(u) => u.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadHierarchyError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDesc")}
        onRowClick={(u) => router.push(`/admin/properties/units/${u.id}`)}
      />
    </div>
  );
}
