"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { InvertedCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { formatCurrencyThb } from "@/lib/formatters";
import { useCurrentCashierShift } from "../api/use-cashier";

export interface CashierShiftInvertedCardProps {
  onOpenQuickWalkIn?: () => void;
  /** Shift actions (open / close) injected by the cashier page. */
  actions?: React.ReactNode;
}

interface MetricProps {
  label: string;
  value: React.ReactNode;
  testId?: string;
}

function Metric({ label, value, testId }: MetricProps) {
  return (
    <div className="space-y-1">
      <span className="block text-[11px] text-mute">{label}</span>
      <span data-testid={testId} className="block font-mono text-sm font-semibold tabular-nums text-canvas">
        {value}
      </span>
    </div>
  );
}

export function CashierShiftInvertedCard({ onOpenQuickWalkIn, actions }: CashierShiftInvertedCardProps) {
  const t = useTranslations("admin.cashier");
  const tCommon = useTranslations("common");
  const { activeProperty } = useAdminWorkspace();
  const { data, isLoading, isError, refetch } = useCurrentCashierShift(activeProperty.id);
  const shift = data?.shift ?? null;

  return (
    <InvertedCard className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${shift ? "bg-terminal-green animate-pulse" : "bg-neutral-600"}`}
            />
            <span className="font-mono text-xs uppercase tracking-wider text-mute">
              {shift ? t("activeShift") : t("noActiveShift")}
            </span>
            {shift && (
              <CommandTag prefixCode="SHF" className="border-neutral-700 bg-neutral-800 text-canvas">
                {shift.documentNumber}
              </CommandTag>
            )}
            {shift && <Badge variant="success">{t(`shiftStatus.${shift.status}`)}</Badge>}
          </div>
          <h2 className="font-rounded text-xl font-semibold text-canvas" data-inverted-heading>
            {t("title")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {actions}
          {onOpenQuickWalkIn && (
            <Button type="button" variant="onDark" size="sm" onClick={onOpenQuickWalkIn} className="h-9 rounded-full text-xs font-medium">
              + {t("quickWalkIn")}
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-mute" role="status">
          <MonoSpinner />
          <span>{tCommon("loading")}</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-between gap-3 text-xs text-canvas">
          <span>{t("loadError")}</span>
          <Button type="button" variant="onDark" size="sm" onClick={() => void refetch()} className="h-8 rounded-full text-xs">
            {tCommon("retry")}
          </Button>
        </div>
      )}

      {!isLoading && !isError && !shift && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute">{t("openPrompt")}</p>
          {!actions && (
            <Link href="/admin/cashier">
              <Button type="button" variant="onDark" size="sm" className="h-8 rounded-full text-xs">
                {t("goToCashier")}
              </Button>
            </Link>
          )}
        </div>
      )}

      {shift && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Metric
            label={t("expectedDrawerCash")}
            testId="shift-expected-cash"
            value={shift.expectedDrawerCash == null ? "-" : formatCurrencyThb(shift.expectedDrawerCash)}
          />
          <Metric label={t("openingFloat")} value={formatCurrencyThb(shift.openingFloatCash)} />
          <Metric label={t("cashReceipts")} value={formatCurrencyThb(shift.cashReceiptsInShift)} />
          <Metric label={t("depositsIn")} value={formatCurrencyThb(shift.cashDepositsReceivedInShift)} />
          <Metric label={t("depositsOut")} value={formatCurrencyThb(shift.cashDepositsRefundedInShift)} />
        </div>
      )}
    </InvertedCard>
  );
}
