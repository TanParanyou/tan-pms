"use client";

import React, { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Lock, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { FormField } from "@/components/forms/form-field";
import { PeriodInput, PERIOD_PATTERN, getCurrentPeriod } from "@/components/forms/period-input";
import { PageHeader } from "@/components/layout/page-header";
import { KpiSummaryStrip } from "@/components/layout/kpi-summary-strip";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { usePropertyHierarchy } from "@/features/properties/api/use-properties";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDecimal } from "@/lib/formatters";
import type {
  MeterReadingSheetRowDto,
  SaveMeterReadingsResponse,
  MeterReadingRowResultDto,
  MeterReadingInputDto,
} from "@/features/billing/types";
import { useMeterReadingSheet, useSaveMeterReadingsMutation } from "../api/use-meters";
import { meterRowEditSchema, meterSaveSchema, type MeterRowEdit } from "../schemas/meter-schemas";
import {
  METER_UTILITIES,
  METER_ISSUE_MESSAGE_KEYS,
  METER_ISSUE_UNKNOWN_KEY,
  PERMISSION_METERS_RECORD,
  PERMISSION_METERS_OVERRIDE_LOCKED,
  type MeterUtility,
} from "../constants";
import { previewUsage, isBelowPrevious } from "../utils/meter-math";

const SPACER = (
  <span className="invisible select-none" aria-hidden="true">
    -
  </span>
);

export function BulkMeterReadingSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.meters");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();

  const canRecord = hasPermission(PERMISSION_METERS_RECORD);
  const canOverride = hasPermission(PERMISSION_METERS_OVERRIDE_LOCKED);

  const [period, setPeriod] = useState(getCurrentPeriod);
  const [buildingId, setBuildingId] = useState("");
  const [edits, setEdits] = useState<Record<string, MeterRowEdit>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [lastResult, setLastResult] = useState<SaveMeterReadingsResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isPeriodValid = PERIOD_PATTERN.test(period);
  const { data: hierarchy } = usePropertyHierarchy(activeProperty.id);
  const {
    data: sheet,
    isLoading,
    isError,
    refetch,
  } = useMeterReadingSheet(activeProperty.id, period, buildingId || undefined, canRecord && isPeriodValid);
  const saveMutation = useSaveMeterReadingsMutation(activeProperty.id);
  const isBusy = saveMutation.isPending;

  const rows = useMemo(() => sheet?.rows ?? [], [sheet]);
  const isDirty = Object.keys(edits).length > 0;
  useUnsavedChanges(isDirty);

  const resultByUnit = useMemo(() => {
    const map = new Map<string, MeterReadingRowResultDto>();
    for (const r of lastResult?.rows ?? []) map.set(r.unitId, r);
    return map;
  }, [lastResult]);

  const buildingOptions = useMemo(
    () => (hierarchy?.buildings ?? []).map((b) => ({ id: b.id, label: resolveLocalizedText(b.name, locale) })),
    [hierarchy, locale]
  );

  const resetView = () => {
    setEdits({});
    setLastResult(null);
    setFormError(null);
    setOverrideReason("");
  };

  const baseEdit = (row: MeterReadingSheetRowDto): MeterRowEdit => ({
    water: row.water.currentReading == null ? "" : String(row.water.currentReading),
    electric: row.electric.currentReading == null ? "" : String(row.electric.currentReading),
    waterRollover: row.water.isRolloverConfirmed,
    electricRollover: row.electric.isRolloverConfirmed,
  });

  const updateEdit = (row: MeterReadingSheetRowDto, patch: Partial<MeterRowEdit>) => {
    setEdits((prev) => ({ ...prev, [row.unit.id]: { ...(prev[row.unit.id] ?? baseEdit(row)), ...patch } }));
  };

  const isRowReadOnly = (row: MeterReadingSheetRowDto) => row.isLocked && !canOverride;

  const issueLabel = (code: string) => t(`issues.${METER_ISSUE_MESSAGE_KEYS[code] ?? METER_ISSUE_UNKNOWN_KEY}`);

  const errorCount = lastResult ? lastResult.rows.reduce((n, r) => n + r.errors.length, 0) : 0;
  const warningCount = lastResult ? lastResult.rows.reduce((n, r) => n + r.warnings.length, 0) : 0;
  const filledCount = rows.filter((r) => {
    const e = edits[r.unit.id];
    return e ? e.water !== "" && e.electric !== "" : r.water.currentReading != null && r.electric.currentReading != null;
  }).length;

  const handleSave = async () => {
    if (isBusy) return;
    setFormError(null);
    const changed = rows.filter((r) => edits[r.unit.id]);
    const editList = changed.map((r) => edits[r.unit.id]);
    const parsed = meterSaveSchema.safeParse({
      rows: editList,
      hasLockedEdit: changed.some((r) => r.isLocked),
      overrideReason,
    });
    const rowsValid = editList.every((e) => meterRowEditSchema.safeParse(e).success);
    if (!parsed.success || !rowsValid) {
      const reasonMissing = parsed.success ? false : parsed.error.issues.some((i) => i.path.includes("overrideReason"));
      setFormError(reasonMissing ? t("errorOverrideReasonRequired") : t("errorIncompleteRows"));
      return;
    }
    const items: MeterReadingInputDto[] = changed.map((r) => {
      const e = edits[r.unit.id];
      return {
        unitId: r.unit.id,
        currentWaterReading: Number(e.water),
        currentElectricReading: Number(e.electric),
        waterRolloverConfirmed: isBelowPrevious(r.water.previousReading, e.water) && e.waterRollover,
        electricRolloverConfirmed: isBelowPrevious(r.electric.previousReading, e.electric) && e.electricRollover,
      };
    });
    try {
      const res = await saveMutation.mutateAsync({
        period,
        items,
        overrideReason: parsed.data.hasLockedEdit ? parsed.data.overrideReason : undefined,
      });
      setLastResult(res);
      if (res.isSaved) {
        toastSuccess(t("savedSuccess"));
        setEdits({});
        setOverrideReason("");
      }
    } catch (err) {
      toastApiError(err);
    }
  };

  const utilityColumns = (kind: MeterUtility): ColumnDef<MeterReadingSheetRowDto>[] => {
    const label = t(kind === "water" ? "waterLabel" : "electricLabel");
    const field = kind === "water" ? "water" : "electric";
    const rolloverField = kind === "water" ? "waterRollover" : "electricRollover";
    return [
      {
        id: `${kind}-prev`,
        header: `${label} ${t("previous")}`,
        align: "right",
        cell: (row) => (
          <span className="font-mono text-xs tabular-nums">{formatDecimal(row[field].previousReading)}</span>
        ),
      },
      {
        id: `${kind}-cur`,
        header: `${label} ${t("current")}`,
        cell: (row) => {
          const edit = edits[row.unit.id];
          const value = edit ? edit[field] : row[field].currentReading == null ? "" : String(row[field].currentReading);
          return (
            <Input
              type="number"
              inputMode="decimal"
              value={value}
              disabled={isRowReadOnly(row) || isBusy}
              onChange={(e) => updateEdit(row, { [field]: e.target.value })}
              placeholder={t("placeholderReading")}
              aria-label={`${label} ${t("current")} ${row.unit.unitNumber}`}
              wrapperClassName="!mb-0"
              className="h-10 w-32 rounded-full font-mono text-xs tabular-nums"
            />
          );
        },
      },
      {
        id: `${kind}-usage`,
        header: `${label} ${t("usage")}`,
        align: "right",
        cell: (row) => {
          const edit = edits[row.unit.id];
          const rolloverOn = edit ? edit[rolloverField] : row[field].isRolloverConfirmed;
          const usage = edit
            ? previewUsage(row[field].previousReading, edit[field], rolloverOn, row[field].meterMaxDigits)
            : row[field].usageUnits ?? null;
          return (
            <div className="mt-1 min-h-[16px] font-mono text-xs tabular-nums">
              {usage == null ? SPACER : formatDecimal(usage)}
            </div>
          );
        },
      },
      {
        id: `${kind}-charge`,
        header: `${label} ${t("charge")}`,
        align: "right",
        cell: (row) => {
          const result = resultByUnit.get(row.unit.id);
          const charge = result ? result[field]?.chargeAmount : row[field].chargeAmount;
          return (
            <div className="mt-1 min-h-[16px] font-mono text-xs tabular-nums">
              {charge == null ? SPACER : formatCurrencyThb(charge)}
            </div>
          );
        },
      },
    ];
  };

  const columns: ColumnDef<MeterReadingSheetRowDto>[] = [
    {
      id: "unit",
      header: t("unit"),
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-medium text-ink">
          <span>{row.unit.unitNumber}</span>
          {row.isLocked && (
            <span title={t("lockedHint")} aria-label={t("lockedHint")}>
              <Lock className="h-3.5 w-3.5 text-mute" />
            </span>
          )}
        </div>
      ),
    },
    {
      id: "tenant",
      header: t("tenant"),
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="text-xs text-ink">{row.customer.fullName}</div>
          <div className="font-mono text-[11px] text-mute">{row.leaseDocumentNumber}</div>
        </div>
      ),
    },
    ...utilityColumns("water"),
    ...utilityColumns("electric"),
    {
      id: "rollover",
      header: t("rolloverConfirmed"),
      cell: (row) => {
        const edit = edits[row.unit.id];
        return (
          <div className="min-h-[40px] space-y-1">
            {METER_UTILITIES.map((kind) => {
              const field = kind === "water" ? "water" : "electric";
              const rolloverField = kind === "water" ? "waterRollover" : "electricRollover";
              const input = edit ? edit[field] : row[field].currentReading == null ? "" : String(row[field].currentReading);
              const needed = isBelowPrevious(row[field].previousReading, input);
              const checked = edit ? edit[rolloverField] : row[field].isRolloverConfirmed;
              return (
                <div key={kind} className="flex h-5 items-center gap-1.5 text-[11px]">
                  {needed ? (
                    <>
                      <Checkbox
                        id={`rollover-${kind}-${row.unit.id}`}
                        checked={checked}
                        disabled={isRowReadOnly(row) || isBusy}
                        onCheckedChange={(c) => updateEdit(row, { [rolloverField]: c })}
                      />
                      <Label htmlFor={`rollover-${kind}-${row.unit.id}`} className="text-[11px]">
                        {t(kind === "water" ? "waterLabel" : "electricLabel")} {t("rolloverConfirmed")}
                      </Label>
                    </>
                  ) : (
                    SPACER
                  )}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("statusLabel"),
      cell: (row) => {
        const result = resultByUnit.get(row.unit.id);
        return (
          <div className="min-h-[40px] space-y-1">
            {result?.errors.map((i, idx) => (
              <Badge key={`e-${idx}`} variant="destructive" className="block w-fit">
                {issueLabel(i.code)}
              </Badge>
            ))}
            {result?.warnings.map((i, idx) => (
              <Badge key={`w-${idx}`} variant="warning" className="block w-fit">
                {issueLabel(i.code)}
              </Badge>
            ))}
            {result && lastResult?.isSaved && result.errors.length === 0 && (
              <Badge variant="success" className="block w-fit">
                {t("rowSaved")}
              </Badge>
            )}
            {!result && SPACER}
          </div>
        );
      },
    },
  ];

  if (!canRecord) {
    return (
      <div className="space-y-4">
        <PageHeader prefixCode="MTR" title={t("title")} description={t("description")} />
        <EmptyState title={t("noPermission")} />
      </div>
    );
  }

  const hasLockedEdit = rows.some((r) => r.isLocked && edits[r.unit.id]);

  return (
    <div className="space-y-4">
      <PageHeader prefixCode="MTR" title={t("title")} description={t("description")} />
      <div className="grid grid-cols-1 gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none sm:grid-cols-[200px_240px_1fr] sm:items-end">
        <FormField id="meter-period" label={t("fieldPeriod")}>
          <PeriodInput
            id="meter-period"
            value={period}
            onValueChange={(v) => {
              setPeriod(v);
              resetView();
            }}
            disabled={isDirty || isBusy}
            placeholder={t("fieldPeriod")}
            wrapperClassName="!mb-0"
          />
        </FormField>
        <FormField id="meter-building" label={t("fieldBuilding")}>
          <SelectPill
            id="meter-building"
            value={buildingId}
            disabled={isDirty || isBusy}
            onChange={(e) => {
              setBuildingId(e.target.value);
              resetView();
            }}
            wrapperClassName="!mb-0"
          >
            <option value="">{t("allBuildings")}</option>
            {buildingOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </SelectPill>
        </FormField>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={resetView}
              className="h-10 rounded-full px-4 gap-1.5 text-xs"
            >
              <Undo2 className="h-4 w-4" />
              <span>{t("discardChanges")}</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!isDirty || isBusy}
            onClick={() => void handleSave()}
            className="h-10 rounded-full px-5 gap-1.5 text-xs"
          >
            <Save className="h-4 w-4" />
            <span>{isBusy ? tCommon("loading") : t("saveBatch")}</span>
          </Button>
        </div>
      </div>

      <KpiSummaryStrip
        items={[
          { id: "rows", label: t("kpiRows"), value: rows.length },
          { id: "filled", label: t("kpiFilled"), value: filledCount },
          { id: "errors", label: t("kpiErrors"), value: errorCount, isAlert: errorCount > 0 },
          { id: "warnings", label: t("kpiWarnings"), value: warningCount },
        ]}
      />

      {hasLockedEdit && (
        <FormField id="meter-override-reason" label={t("fieldOverrideReason")} required>
          <Input
            id="meter-override-reason"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder={t("placeholderOverrideReason")}
            wrapperClassName="!mb-0"
            className="h-10 rounded-full text-xs"
          />
        </FormField>
      )}

      {formError && <Alert variant="danger">{formError}</Alert>}
      {lastResult && !lastResult.isSaved && (
        <Alert variant="danger" title={t("saveFailedTitle")}>
          {t("saveFailedSummary", { errors: errorCount, warnings: warningCount })}
        </Alert>
      )}
      {lastResult?.isSaved && warningCount > 0 && (
        <Alert variant="warning">{t("savedWithWarnings", { warnings: warningCount })}</Alert>
      )}

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.unit.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={t("loadError")}
        onRetry={() => void refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
    </div>
  );
}
