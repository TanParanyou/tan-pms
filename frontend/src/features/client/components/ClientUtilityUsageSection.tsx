"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrencyThb, formatDecimal } from "@/lib/formatters";
import { useClientLeases } from "../api/use-client-leases";
import { useClientUtilityUsage } from "../api/use-client-invoices";
import { DEFAULT_UTILITY_MONTHS, UTILITY_MONTH_OPTIONS } from "../constants";
import type { UtilityUsageMonthDto } from "../types";

interface UsageBarsProps {
  title: string;
  unit: string;
  months: UtilityUsageMonthDto[];
  pick: (m: UtilityUsageMonthDto) => number | null | undefined;
  barClass: string;
}

/** Pure-CSS horizontal bars; decorative only (aria-hidden) because the data table below carries the values. */
function UsageBars({ title, unit, months, pick, barClass }: UsageBarsProps) {
  const max = Math.max(1, ...months.map((m) => pick(m) ?? 0));
  return (
    <div className="space-y-2" data-testid={`usage-bars-${unit}`}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="space-y-1.5" aria-hidden="true">
        {months.map((m) => {
          const v = pick(m) ?? 0;
          return (
            <li key={m.period} className="flex items-center gap-3 text-xs">
              <span className="w-16 shrink-0 font-mono text-mute">{m.period}</span>
              <div className="h-3 flex-1 rounded-full bg-surface-soft">
                <div className={`h-3 rounded-full ${barClass}`} style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right font-mono tabular-nums text-body">
                {pick(m) == null ? "-" : `${formatDecimal(v)} ${unit}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ClientUtilityUsageSection() {
  const t = useTranslations("client.portal.usage");
  const tCommon = useTranslations("common");
  const [leaseId, setLeaseId] = useState("");
  const [months, setMonths] = useState(DEFAULT_UTILITY_MONTHS);
  const leases = useClientLeases();
  const { data, isLoading, isError, refetch } = useClientUtilityUsage(leaseId || undefined, months);

  const rows = data?.months ?? [];
  const dash = (v: number | null | undefined, fmt: (n: number) => string) => (v == null ? "-" : fmt(v));

  return (
    <div className="space-y-6">
      <PageHeader prefixCode="MTR" title={t("title")} description={t("description")} />
      <div className="flex flex-wrap items-end gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none">
        <div className="w-60">
          <SelectPill aria-label={t("fieldLease")} value={leaseId} onChange={(e) => setLeaseId(e.target.value)} wrapperClassName="!mb-0">
            <option value="">{t("currentLease")}</option>
            {(leases.data?.items ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.documentNumber}
              </option>
            ))}
          </SelectPill>
        </div>
        <div className="w-40">
          <SelectPill aria-label={t("fieldMonths")} value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} wrapperClassName="!mb-0">
            {UTILITY_MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {t("monthsOption", { count: m })}
              </option>
            ))}
          </SelectPill>
        </div>
        {data && <span className="font-mono text-xs text-mute">{data.leaseDocumentNumber}</span>}
      </div>

      {isLoading && <PageLoading message={tCommon("loading")} />}
      {isError && <EmptyState title={t("loadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />}
      {!isLoading && !isError && rows.length === 0 && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}
      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none lg:grid-cols-2">
            <UsageBars title={t("water")} unit="m3" months={rows} pick={(m) => m.waterUsageUnits} barClass="bg-ink" />
            <UsageBars title={t("electric")} unit="kWh" months={rows} pick={(m) => m.electricUsageUnits} barClass="bg-charcoal" />
          </div>
          <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
            <h3 className="text-sm font-semibold text-ink">{t("tableTitle")}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colPeriod")}</TableHead>
                  <TableHead className="text-right">{t("colWaterUnits")}</TableHead>
                  <TableHead className="text-right">{t("colWaterCharge")}</TableHead>
                  <TableHead className="text-right">{t("colElectricUnits")}</TableHead>
                  <TableHead className="text-right">{t("colElectricCharge")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.period}>
                    <TableCell className="font-mono text-xs">{m.period}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{dash(m.waterUsageUnits, formatDecimal)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{dash(m.waterChargeAmount, formatCurrencyThb)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{dash(m.electricUsageUnits, formatDecimal)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{dash(m.electricChargeAmount, formatCurrencyThb)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
