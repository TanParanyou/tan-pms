"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SelectPill } from "@/components/ui/select-pill";
import { CashierShiftInvertedCard } from "@/features/cashier/components/CashierShiftInvertedCard";
import { UnifiedRoomRackSection } from "@/features/rack/components/UnifiedRoomRackSection";
import { QuickWalkInModal } from "@/features/rack/components/QuickWalkInModal";
import { BulkMeterReadingSection } from "@/features/meters/components/BulkMeterReadingSection";
import { AdminRbacUsersSection } from "@/features/users/components/AdminRbacUsersSection";
import { useAppLocale } from "@/components/shared/locale-provider";
import { useTranslations } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { ADMIN_PROPERTIES, INITIAL_RACK_PROJECTIONS } from "@/features/rack/constants";
import { siteConfig } from "@/config/site";

export default function AdminPage() {
  const { locale, toggleLocale } = useAppLocale();
  const tModes = useTranslations("stayModes");
  const tRack = useTranslations("admin.roomRack");
  const tCommon = useTranslations("common");

  const [selectedProperty, setSelectedProperty] = useState<string>(ADMIN_PROPERTIES[0].code);
  const [stayModeFilter, setStayModeFilter] = useState<string>("All");
  const [isQuickWalkInOpen, setIsQuickWalkInOpen] = useState(false);

  const filteredItems =
    stayModeFilter === "All"
      ? INITIAL_RACK_PROJECTIONS
      : INITIAL_RACK_PROJECTIONS.filter(
          (item) =>
            item.activeStayMode === stayModeFilter ||
            item.supportedStayModes.includes(stayModeFilter as "Hourly" | "Daily" | "Monthly")
        );

  return (
    <div className="min-h-screen bg-canvas text-ink pb-16">
      {/* 1. Top Command Nav with Property Switcher Pill & StayMode Filter */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-rounded font-semibold text-xl tracking-tight text-ink">
              {siteConfig.name}
            </Link>
            <span className="text-xs px-2 py-0.5 rounded-full bg-ink text-canvas font-mono">
              ADMIN
            </span>

            {/* Property Switcher Pill */}
            <div className="relative">
              <SelectPill
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="h-8 text-xs font-mono font-medium pl-3 pr-8 w-auto min-w-[240px] bg-surface-soft"
              >
                {ADMIN_PROPERTIES.map((prop) => (
                  <option key={prop.code} value={prop.code}>
                    {prop.code} — {resolveLocalizedText(prop.name, locale)}
                  </option>
                ))}
              </SelectPill>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* StayMode Filter Pills */}
            <div className="flex items-center rounded-full bg-surface-soft border border-hairline p-1 gap-1">
              {["All", "Hourly", "Daily", "Monthly"].map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={stayModeFilter === mode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStayModeFilter(mode)}
                  className="rounded-full px-3 py-1 text-xs font-medium h-7"
                >
                  {mode === "All"
                    ? tRack("allModes")
                    : tModes(mode as "Hourly" | "Daily" | "Monthly")}
                </Button>
              ))}
            </div>

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

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        {/* Exactly 1 InvertedCard on the Admin Page */}
        <CashierShiftInvertedCard
          onOpenQuickWalkIn={() => setIsQuickWalkInOpen(true)}
        />

        {/* Structured Projection Room Rack */}
        <UnifiedRoomRackSection
          items={filteredItems}
          onOpenQuickWalkIn={() => setIsQuickWalkInOpen(true)}
        />

        {/* Zero-Layout-Shift Bulk Meter Table */}
        <BulkMeterReadingSection />

        {/* Multi-Property Admin RBAC User Management (PM-01) */}
        <AdminRbacUsersSection />

        {/* Quick Walk-In & Check-in Modal */}
        <QuickWalkInModal
          isOpen={isQuickWalkInOpen}
          onClose={() => setIsQuickWalkInOpen(false)}
          onSuccess={() => setIsQuickWalkInOpen(false)}
        />
      </main>
    </div>
  );
}
