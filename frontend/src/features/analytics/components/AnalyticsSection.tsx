"use client";

import React, { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { InvertedCard } from "@/components/ui/card";
import { DateTimeInput } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { FormField } from "@/components/forms/form-field";
import { KpiSummaryStrip } from "@/components/layout/kpi-summary-strip";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { usePermission } from "@/hooks/use-permission";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDecimal } from "@/lib/formatters";
import type { AgingBucketsDto } from "@/features/client/types";
import {
  useOccupancyReport,
  useRevParReport,
  useAgingReport,
  useCashierSummaryReport,
  useDepositSummaryReport,
} from "../api/use-analytics";
import { DEFAULT_ANALYTICS_RANGE_DAYS, PERMISSION_ANALYTICS_READ } from "../constants";
import { defaultAnalyticsRange, isValidRange } from "../utils/range";

const pct = (rate: number) => `${formatDecimal(rate * 100, 1)}%`;
const money = (v: number | null | undefined) => (v == null ? "-" : formatCurrencyThb(v));
const mono = "font-mono text-xs tabular-nums";

function RateBar({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <div className="h-2.5 w-32 rounded-full bg-surface-soft">
        <div className="h-2.5 rounded-full bg-ink" style={{ width: `${Math.min(100, Math.max(0, rate * 100))}%` }} />
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}
function Section({ title, children }: SectionProps) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

export function AnalyticsSection() {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.analytics");
  const tDeposit = useTranslations("admin.deposits");
  const tModes = useTranslations("stayModes");
  const { activeProperty } = useAdminWorkspace();
  const { hasPermission } = usePermission();
  const canRead = hasPermission(PERMISSION_ANALYTICS_READ);

  const initial = defaultAnalyticsRange(DEFAULT_ANALYTICS_RANGE_DAYS);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const valid = isValidRange(from, to);
  const enabled = canRead && valid;
  const pid = activeProperty.id;

  const occupancy = useOccupancyReport(pid, from, to, enabled);
  const revpar = useRevParReport(pid, from, to, enabled);
  const aging = useAgingReport(pid, from, to, enabled);
  const cashier = useCashierSummaryReport(pid, from, to, enabled);
  const deposits = useDepositSummaryReport(pid, from, to, enabled);

  if (!canRead) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState title={t("noPermission")} />
      </div>
    );
  }

  const tableProps = <T,>(q: { isLoading: boolean; isError: boolean; refetch: () => unknown }, data: T[]) => ({
    data,
    isLoading: q.isLoading,
    isError: q.isError,
    errorMessage: t("loadError"),
    onRetry: () => void q.refetch(),
    emptyTitle: t("emptyTitle"),
    emptyDescription: t("emptyDescription"),
  });

  const o = occupancy.data;
  const r = revpar.data;

  const stayModeColumns: ColumnDef<NonNullable<typeof o>["byStayMode"][number]>[] = [
    { id: "mode", header: t("colStayMode"), cell: (m) => <span className="text-xs">{tModes(m.stayMode)}</span> },
    { id: "nights", header: t("colOccupiedNights"), align: "right", cell: (m) => <span className={mono}>{m.occupiedUnitNights}</span> },
    { id: "rate", header: t("colOccupancyRate"), align: "right", cell: (m) => <span className={mono}>{pct(m.occupancyRate)}</span> },
    { id: "bar", header: <span className="sr-only">{t("colOccupancyRate")}</span>, cell: (m) => <RateBar rate={m.occupancyRate} /> },
  ];
  const buildingColumns: ColumnDef<NonNullable<typeof o>["byBuilding"][number]>[] = [
    { id: "building", header: t("colBuilding"), cell: (b) => <span className="text-xs">{resolveLocalizedText(b.buildingName, locale)}</span> },
    { id: "units", header: t("colUnits"), align: "right", cell: (b) => <span className={mono}>{b.units}</span> },
    { id: "available", header: t("colAvailableNights"), align: "right", cell: (b) => <span className={mono}>{b.availableUnitNights}</span> },
    { id: "occupied", header: t("colOccupiedNights"), align: "right", cell: (b) => <span className={mono}>{b.occupiedUnitNights}</span> },
    { id: "rate", header: t("colOccupancyRate"), align: "right", cell: (b) => <span className={mono}>{pct(b.occupancyRate)}</span> },
    { id: "bar", header: <span className="sr-only">{t("colOccupancyRate")}</span>, cell: (b) => <RateBar rate={b.occupancyRate} /> },
  ];

  const revparRows = r ? [r] : [];
  const revparColumns: ColumnDef<NonNullable<typeof r>>[] = [
    { id: "avail", header: t("colAvailableNights"), align: "right", cell: (x) => <span className={mono}>{x.availableUnitNights}</span> },
    { id: "folio", header: t("colFolioRevenue"), align: "right", cell: (x) => <span className={mono}>{money(x.folioRoomRevenue)}</span> },
    { id: "lease", header: t("colLeaseRevenue"), align: "right", cell: (x) => <span className={mono}>{money(x.leaseRentRevenue)}</span> },
    { id: "room", header: t("colRoomRevenue"), align: "right", cell: (x) => <span className={mono}>{money(x.roomRevenue)}</span> },
    { id: "revpar", header: t("colRevPar"), align: "right", cell: (x) => <span className={`${mono} font-semibold`}>{money(x.revPar)}</span> },
  ];

  type AgingRow = { id: string; name: string; invoices: number; buckets: AgingBucketsDto };
  const agingRows: AgingRow[] = (aging.data?.customers ?? []).map((c) => ({
    id: c.customer.id,
    name: c.customer.fullName,
    invoices: c.invoiceCount,
    buckets: c.buckets,
  }));
  const bucketCols: ColumnDef<AgingRow>[] = (
    [
      ["current", "bucketCurrent"],
      ["days1To30", "bucket1To30"],
      ["days31To60", "bucket31To60"],
      ["days61To90", "bucket61To90"],
      ["days90Plus", "bucket90Plus"],
      ["total", "bucketTotal"],
    ] as const
  ).map(([key, label]) => ({
    id: key,
    header: t(label),
    align: "right" as const,
    cell: (row: AgingRow) => <span className={mono}>{money(row.buckets[key])}</span>,
  }));
  const agingColumns: ColumnDef<AgingRow>[] = [
    { id: "customer", header: t("colCustomer"), cell: (row) => <span className="text-xs text-ink">{row.name}</span> },
    { id: "count", header: t("colInvoices"), align: "right", cell: (row) => <span className={mono}>{row.invoices}</span> },
    ...bucketCols,
  ];

  const c = cashier.data;
  const cashierRows = c ? c.cashiers : [];
  const cashierColumns: ColumnDef<NonNullable<typeof c>["cashiers"][number]>[] = [
    { id: "cashier", header: t("colCashier"), cell: (x) => <span className="text-xs text-ink">{x.cashier.fullName ?? "-"}</span> },
    { id: "shifts", header: t("colShifts"), align: "right", cell: (x) => <span className={mono}>{x.shiftCount}</span> },
    { id: "receipts", header: t("colCashReceipts"), align: "right", cell: (x) => <span className={mono}>{money(x.cashReceiptsTotal)}</span> },
    { id: "variance", header: t("colVariance"), align: "right", cell: (x) => <span className={mono}>{money(x.varianceTotal)}</span> },
  ];

  const d = deposits.data;
  const depositColumns: ColumnDef<NonNullable<typeof d>["byType"][number]>[] = [
    { id: "type", header: t("colDepositType"), cell: (x) => <span className="text-xs">{tDeposit(`types.${x.depositType}`)}</span> },
    { id: "ledgers", header: t("colLedgers"), align: "right", cell: (x) => <span className={mono}>{x.ledgerCount}</span> },
    { id: "held", header: t("colHeld"), align: "right", cell: (x) => <span className={mono}>{money(x.heldBalance)}</span> },
    { id: "received", header: t("colReceived"), align: "right", cell: (x) => <span className={mono}>{money(x.receivedInPeriod)}</span> },
    { id: "deducted", header: t("colDeducted"), align: "right", cell: (x) => <span className={mono}>{money(x.deductedInPeriod)}</span> },
    { id: "refunded", header: t("colRefunded"), align: "right", cell: (x) => <span className={mono}>{money(x.refundedInPeriod)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none sm:grid-cols-2">
        <FormField id="analytics-from" label={t("fieldFrom")}>
          <DateTimeInput id="analytics-from" value={from} onValueChange={setFrom} max={to || undefined} hasError={!valid} placeholder={t("fieldFrom")} wrapperClassName="!mb-0" />
        </FormField>
        <FormField id="analytics-to" label={t("fieldTo")} error={!valid ? t("errorRange") : undefined}>
          <DateTimeInput id="analytics-to" value={to} onValueChange={setTo} min={from || undefined} hasError={!valid} placeholder={t("fieldTo")} wrapperClassName="!mb-0" />
        </FormField>
      </div>

      <KpiSummaryStrip
        items={[
          { id: "occ", label: t("kpiOccupancy"), value: o ? pct(o.occupancyRate) : "-" },
          { id: "revpar", label: t("kpiRevPar"), value: r ? money(r.revPar) : "-" },
          { id: "revenue", label: t("kpiRoomRevenue"), value: r ? money(r.roomRevenue) : "-" },
          { id: "receivable", label: t("kpiReceivable"), value: aging.data ? money(aging.data.totals.total) : "-" },
        ]}
      />

      <Section title={t("sectionByStayMode")}>
        <DataTable columns={stayModeColumns} getRowId={(m) => m.stayMode} {...tableProps(occupancy, o?.byStayMode ?? [])} />
      </Section>
      <Section title={t("sectionByBuilding")}>
        <DataTable columns={buildingColumns} getRowId={(b) => b.buildingId} {...tableProps(occupancy, o?.byBuilding ?? [])} />
      </Section>
      <Section title={t("sectionRevPar")}>
        <DataTable columns={revparColumns} getRowId={() => "revpar"} {...tableProps(revpar, revparRows)} />
      </Section>
      <Section title={t("sectionAging")}>
        <DataTable columns={agingColumns} getRowId={(row) => row.id} {...tableProps(aging, agingRows)} />
        {aging.data && (
          <p className="font-mono text-xs text-body" data-testid="aging-total">
            {t("bucketTotal")}: {money(aging.data.totals.total)}
          </p>
        )}
      </Section>
      <Section title={t("sectionCashier")}>
        <DataTable columns={cashierColumns} getRowId={(x) => x.cashier.id} {...tableProps(cashier, cashierRows)} />
        {c && (
          <p className="text-xs text-body" data-testid="cashier-summary">
            {t("cashierSummary", {
              shifts: c.shiftCount,
              receipts: money(c.cashReceiptsTotal),
              variance: money(c.varianceTotal),
            })}
          </p>
        )}
      </Section>
      <Section title={t("sectionDeposits")}>
        <InvertedCard className="space-y-1 p-6" data-testid="deposit-liability-card">
          <span className="text-[11px] uppercase tracking-wider text-mute">{t("depositLiabilityLabel")}</span>
          <div className="font-mono text-3xl font-bold tabular-nums text-canvas" data-inverted-heading>
            {d ? money(d.totalHeldBalance) : "-"}
          </div>
          <p className="text-xs text-mute">{t("depositLiabilityNote")}</p>
        </InvertedCard>
        <DataTable columns={depositColumns} getRowId={(x) => x.depositType} {...tableProps(deposits, d?.byType ?? [])} />
      </Section>
    </div>
  );
}
