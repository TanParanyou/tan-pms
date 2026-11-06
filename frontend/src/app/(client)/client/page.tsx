"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HoldTtlInvertedCard } from "@/features/client-portal/components/HoldTtlInvertedCard";
import { ActiveLeaseAndBillingSection } from "@/features/client-portal/components/ActiveLeaseAndBillingSection";
import { ClientOperationsSection } from "@/features/client-portal/components/ClientOperationsSection";
import { useAppLocale } from "@/components/shared/locale-provider";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";

export default function ClientPage() {
  const { locale, toggleLocale } = useAppLocale();
  const tCommon = useTranslations("common");
  const tClient = useTranslations("client");

  return (
    <div className="min-h-screen bg-canvas text-ink pb-20">
      {/* Client Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur-md px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-rounded font-semibold text-xl tracking-tight text-ink">
              {siteConfig.name}
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-soft text-ink border border-hairline font-mono">
              CLIENT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-body hidden sm:inline">
              {tClient("guestGreeting")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              className="rounded-full text-xs font-mono h-8"
            >
              🌐 {locale.toUpperCase()}
            </Button>
            <Link href="/login">
              <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs h-8">
                {tCommon("logout")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-8 space-y-8">
        {/* Exactly 1 InvertedCard on Client Page */}
        <HoldTtlInvertedCard />

        {/* Active Lease & Line-Level Thai Tax Breakdown */}
        <ActiveLeaseAndBillingSection />

        {/* Maintenance WorkOrder & Parcel Alerts */}
        <ClientOperationsSection />
      </main>
    </div>
  );
}
