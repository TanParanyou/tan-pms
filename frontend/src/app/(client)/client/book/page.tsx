"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientBookingSection } from "@/features/reservations/components/ClientBookingSection";
import { useAppLocale } from "@/components/shared/locale-provider";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";

export default function ClientBookPage() {
  const { locale, toggleLocale } = useAppLocale();
  const tCommon = useTranslations("common");
  const tBooking = useTranslations("client.booking");

  return (
    <div className="min-h-screen bg-canvas text-ink pb-20">
      {/* Client Book Header */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur-md px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-rounded font-semibold text-xl tracking-tight text-ink"
            >
              {siteConfig.name}
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-soft text-ink border border-hairline font-mono">
              BOOKING
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/client">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-mono h-8 px-3"
              >
                {tBooking("backToPortal")}
              </Button>
            </Link>
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-xs h-8"
              >
                {tCommon("logout")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-8">
        <ClientBookingSection />
      </main>
    </div>
  );
}
