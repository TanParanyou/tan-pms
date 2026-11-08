"use client";

import React from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { InvertedCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CommandTag } from "@/components/ui/command-tag";
import { useCountdownTimer } from "@/hooks/use-countdown-timer";
import { formatCurrencyThb } from "@/lib/formatters";
import { resolveLocalizedText, type LocalizedTextDto } from "@/lib/i18n/localized-text";

export interface HoldTtlInvertedCardProps {
  hold: {
    documentNumber?: string;
    unitTypeName?: LocalizedTextDto;
    stayMode?: string;
    holdExpiresAt?: string;
    depositAmount?: number;
  };
  href: string;
  onExpire?: () => void;
}

export function secondsUntil(iso: string | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - now;
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
}

/** The single inverted card of the client dashboard: live countdown for the active Hold. */
export function HoldTtlInvertedCard({ hold, href, onExpire }: HoldTtlInvertedCardProps) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.hold");
  const tModes = useTranslations("stayModes");
  const { formattedTime } = useCountdownTimer({ initialSeconds: secondsUntil(hold.holdExpiresAt), onExpire });

  return (
    <InvertedCard className="p-6" data-testid="hold-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-mute font-mono">{t("badge")}</span>
            {hold.documentNumber && (
              <CommandTag prefixCode="RES" className="bg-neutral-800 border-neutral-700 text-canvas">
                {hold.documentNumber}
              </CommandTag>
            )}
          </div>
          <h2 className="text-xl font-rounded font-semibold text-canvas" data-inverted-heading>
            {t("title")}
          </h2>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-mute block">{t("remaining")}</span>
          <span className="font-mono text-3xl font-bold text-canvas tracking-wider tabular-nums">{formattedTime}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="flex gap-2">
            <span className="text-mute">{t("unitType")}:</span>
            <span className="font-medium text-canvas">
              {hold.unitTypeName ? resolveLocalizedText(hold.unitTypeName, locale) : "-"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-mute">{t("stayMode")}:</span>
            <span className="font-medium text-canvas">{hold.stayMode ? tModes(hold.stayMode) : "-"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-mute">{t("deposit")}:</span>
            <span className="font-mono font-semibold text-canvas tabular-nums">
              {hold.depositAmount == null ? "-" : formatCurrencyThb(hold.depositAmount)}
            </span>
          </div>
        </div>
        <Link href={href}>
          <Button type="button" variant="onDark" size="sm" className="rounded-full h-9 px-5 text-xs">
            {t("manage")}
          </Button>
        </Link>
      </div>
    </InvertedCard>
  );
}
