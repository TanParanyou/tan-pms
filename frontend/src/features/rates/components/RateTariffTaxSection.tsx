"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyThb } from "@/lib/formatters";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import {
  usePropertyRates,
  useDeleteRatePlanMutation,
  useDeleteUtilityTariffMutation,
  useDeleteTaxProfileMutation,
} from "../api/use-rates";
import { PERMISSION_RATES_MANAGE } from "../constants";
import type { RatePlanItemDto, UtilityTariffItemDto, TaxProfileItemDto } from "../types";
import { UtilityTariffDialog, TaxProfileDialog } from "./RateDialogs";

type DeleteTarget =
  | { kind: "plan"; id: string; name: string }
  | { kind: "tariff"; id: string; name: string }
  | { kind: "tax"; id: string; name: string };

export function RateTariffTaxSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.rates");
  const tModes = useTranslations("stayModes");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_RATES_MANAGE);
  const pid = activeProperty.id;

  const catalog = usePropertyRates(pid);
  const delPlan = useDeleteRatePlanMutation(pid);
  const delTariff = useDeleteUtilityTariffMutation(pid);
  const delTax = useDeleteTaxProfileMutation(pid);
  const isDeleting = delPlan.isPending || delTariff.isPending || delTax.isPending;

  const [tariffDialog, setTariffDialog] = useState<{ id: string | null } | null>(null);
  const [taxDialog, setTaxDialog] = useState<{ id: string | null } | null>(null);
  const [target, setTarget] = useState<DeleteTarget | null>(null);

  const plans = useMemo(() => catalog.data?.ratePlans ?? [], [catalog.data]);
  const tableState = {
    isLoading: catalog.isLoading,
    isError: catalog.isError,
    errorMessage: t("loadError"),
    onRetry: () => void catalog.refetch(),
  };

  const executeDelete = async () => {
    if (!target || isDeleting) return;
    try {
      if (target.kind === "plan") await delPlan.mutateAsync(target.id);
      else if (target.kind === "tariff") await delTariff.mutateAsync(target.id);
      else await delTax.mutateAsync(target.id);
      toastSuccess(t("toastDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setTarget(null);
    }
  };

  const actions = (editLabel: string, deleteLabel: string, onEdit: () => void, onDelete: () => void) => (
    <div className="flex items-center justify-end gap-1.5">
      <Button type="button" size="icon" variant="outline" title={editLabel} aria-label={editLabel} disabled={isDeleting} onClick={onEdit} className="h-8 w-8 rounded-full">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" variant="outline" title={deleteLabel} aria-label={deleteLabel} disabled={isDeleting} onClick={onDelete} className="h-8 w-8 rounded-full">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
  const actionsHeader = <span className="sr-only">{t("colActions")}</span>;

  const planColumns: ColumnDef<RatePlanItemDto>[] = [
    {
      id: "code",
      header: t("colCodeName"),
      cell: (p) => (
        <div className="space-y-0.5">
          <div className="font-mono text-xs font-medium">{p.code}</div>
          <div className="text-xs text-ink">{resolveLocalizedText(p.name, locale)}</div>
        </div>
      ),
    },
    { id: "type", header: t("colUnitType"), cell: (p) => <span className="text-xs">{resolveLocalizedText(p.unitType.name, locale)}</span> },
    { id: "hourly", header: t("colHourlyPackage"), cell: (p) => <span className="font-mono text-xs tabular-nums">{p.hourlyPackage.basePackageHours}h / {formatCurrencyThb(p.hourlyPackage.basePackagePrice)}</span> },
    { id: "dailyMonthly", header: t("colDailyMonthly"), cell: (p) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(p.dailyRate.weekdayRate)} / {formatCurrencyThb(p.monthlyRate.monthlyRentRate)}</span> },
    {
      id: "status",
      header: t("colStatusModes"),
      cell: (p) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={p.isActive ? "success" : "outline"}>{p.isActive ? t("statusActive") : t("statusInactive")}</Badge>
          {p.supportedStayModes.map((m) => (
            <Badge key={m} variant="outline">{tModes(m)}</Badge>
          ))}
        </div>
      ),
    },
    ...(canManage
      ? [{ id: "actions", header: actionsHeader, align: "right" as const, cell: (p: RatePlanItemDto) => actions(`${t("editPlan")} ${p.code}`, `${t("deletePlan")} ${p.code}`, () => router.push(`/admin/rates/${p.id}`), () => setTarget({ kind: "plan", id: p.id, name: p.code })) }]
      : []),
  ];

  const tariffColumns: ColumnDef<UtilityTariffItemDto>[] = [
    { id: "type", header: t("colUtilityType"), cell: (u) => <Badge variant="outline">{u.utilityType === "Water" ? t("waterType") : t("electricType")}</Badge> },
    { id: "name", header: t("colTariffName"), cell: (u) => <span className="text-xs text-ink">{resolveLocalizedText(u.name, locale)}</span> },
    { id: "mode", header: t("colBillingMode"), cell: (u) => <span className="text-xs">{t(`billingMode${u.billingMode}`)}</span> },
    { id: "rate", header: t("colRates"), align: "right", cell: (u) => <span className="font-mono text-xs tabular-nums">{formatCurrencyThb(u.ratePerUnit)}</span> },
    { id: "digits", header: t("colMeterDigits"), align: "right", cell: (u) => <span className="font-mono text-xs tabular-nums">{u.meterMaxDigits}</span> },
    ...(canManage
      ? [{ id: "actions", header: actionsHeader, align: "right" as const, cell: (u: UtilityTariffItemDto) => actions(`${t("editTariff")} ${resolveLocalizedText(u.name, locale)}`, `${t("actionDelete")} ${resolveLocalizedText(u.name, locale)}`, () => setTariffDialog({ id: u.id }), () => setTarget({ kind: "tariff", id: u.id, name: resolveLocalizedText(u.name, locale) })) }]
      : []),
  ];

  const taxColumns: ColumnDef<TaxProfileItemDto>[] = [
    { id: "cat", header: t("colChargeCategory"), cell: (x) => <span className="font-mono text-xs">{x.chargeCategoryCode}</span> },
    { id: "name", header: t("colTaxName"), cell: (x) => <span className="text-xs text-ink">{resolveLocalizedText(x.name, locale)}</span> },
    { id: "mode", header: t("colTaxMode"), cell: (x) => <span className="text-xs">{t(`taxMode${x.taxMode}`)}</span> },
    { id: "vat", header: t("colVatRate"), align: "right", cell: (x) => <span className="font-mono text-xs tabular-nums">{x.vatRatePercent}%</span> },
    { id: "wht", header: t("colWhtRate"), align: "right", cell: (x) => <span className="font-mono text-xs tabular-nums">{x.defaultWithholdingTaxPercent}%</span> },
    { id: "active", header: t("fieldIsActive"), cell: (x) => <Badge variant={x.isActive ? "success" : "outline"}>{x.isActive ? t("statusActive") : t("statusInactive")}</Badge> },
    ...(canManage
      ? [{ id: "actions", header: actionsHeader, align: "right" as const, cell: (x: TaxProfileItemDto) => actions(`${t("editTax")} ${x.chargeCategoryCode}`, `${t("actionDelete")} ${x.chargeCategoryCode}`, () => setTaxDialog({ id: x.id }), () => setTarget({ kind: "tax", id: x.id, name: x.chargeCategoryCode })) }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="RTE" title={t("title")} description={t("description")} />
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">{t("tabRatePlans")}</TabsTrigger>
          <TabsTrigger value="tariffs">{t("tabUtilityTariffs")}</TabsTrigger>
          <TabsTrigger value="taxes">{t("tabTaxProfiles")}</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => router.push("/admin/rates/create")} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Plus className="h-4 w-4" />
                <span>{t("createRatePlan")}</span>
              </Button>
            </div>
          )}
          <DataTable columns={planColumns} data={plans} getRowId={(p) => p.id} emptyTitle={t("emptyRatePlans")} {...tableState} />
        </TabsContent>
        <TabsContent value="tariffs" className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => setTariffDialog({ id: null })} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Plus className="h-4 w-4" />
                <span>{t("createTariff")}</span>
              </Button>
            </div>
          )}
          <DataTable columns={tariffColumns} data={catalog.data?.utilityTariffs ?? []} getRowId={(u) => u.id} emptyTitle={t("emptyUtilities")} {...tableState} />
        </TabsContent>
        <TabsContent value="taxes" className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => setTaxDialog({ id: null })} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <Plus className="h-4 w-4" />
                <span>{t("createTax")}</span>
              </Button>
            </div>
          )}
          <DataTable columns={taxColumns} data={catalog.data?.taxProfiles ?? []} getRowId={(x) => x.id} emptyTitle={t("emptyTaxProfiles")} {...tableState} />
        </TabsContent>
      </Tabs>
      <UtilityTariffDialog open={tariffDialog !== null} onOpenChange={(o) => !o && setTariffDialog(null)} propertyId={pid} id={tariffDialog?.id ?? null} />
      <TaxProfileDialog open={taxDialog !== null} onOpenChange={(o) => !o && setTaxDialog(null)} propertyId={pid} id={taxDialog?.id ?? null} />
      <ConfirmationModal
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={executeDelete}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteMessage", { name: target?.name ?? "" })}
        confirmText={t("btnDelete")}
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
