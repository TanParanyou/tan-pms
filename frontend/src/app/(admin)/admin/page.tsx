"use client";

import React, { useState } from "react";
import { CashierShiftInvertedCard } from "@/features/cashier/components/CashierShiftInvertedCard";
import { UnifiedRoomRackSection } from "@/features/rack/components/UnifiedRoomRackSection";
import { QuickWalkInModal } from "@/features/rack/components/QuickWalkInModal";
import { BulkMeterReadingSection } from "@/features/meters/components/BulkMeterReadingSection";
import { AdminRbacUsersSection } from "@/features/users/components/AdminRbacUsersSection";
import { UnitMasterSection } from "@/features/properties/components/UnitMasterSection";
import { RateTariffTaxSection } from "@/features/rates/components/RateTariffTaxSection";
import { AdminReservationsSection } from "@/features/reservations/components/AdminReservationsSection";
import { FrontDeskStaysSection } from "@/features/stays/components/FrontDeskStaysSection";
import { AdminNavbar } from "@/components/layout/admin-navbar";
import {
  AdminSidebar,
  type AdminModuleKey,
} from "@/components/layout/admin-sidebar";
import { AdminBottomBar } from "@/components/layout/admin-bottom-bar";
import { AdminMobileDrawer } from "@/components/layout/admin-mobile-drawer";
import { useTranslations } from "next-intl";
import { ADMIN_PROPERTIES, INITIAL_RACK_PROJECTIONS } from "@/features/rack/constants";

export default function AdminPage() {
  const tNav = useTranslations("admin.nav");

  const [activeModule, setActiveModule] = useState<AdminModuleKey>("rack");
  const [selectedProperty, setSelectedProperty] = useState<string>(ADMIN_PROPERTIES[0].code);
  const [stayModeFilter, setStayModeFilter] = useState<string>("All");
  const [isQuickWalkInOpen, setIsQuickWalkInOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const filteredItems =
    stayModeFilter === "All"
      ? INITIAL_RACK_PROJECTIONS
      : INITIAL_RACK_PROJECTIONS.filter(
          (item) =>
            item.activeStayMode === stayModeFilter ||
            item.supportedStayModes.includes(stayModeFilter as "Hourly" | "Daily" | "Monthly")
        );

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas text-ink flex flex-col">
      {/* 1. Top Command Navbar (Fixed height, zero vertical jitter) */}
      <AdminNavbar
        selectedProperty={selectedProperty}
        onSelectProperty={setSelectedProperty}
        properties={ADMIN_PROPERTIES}
        activeModuleName={tNav(activeModule)}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      {/* 2. Workspace Body: Left Pinned Sidebar + Independent Scroll Viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Desktop Sidebar (shrink-0, smooth width transition, zero layout shift) */}
        <AdminSidebar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Active Module Viewport (Left-anchored, stable margin, independent scroll) */}
        <main className="flex-1 h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <div className="max-w-6xl space-y-6">
            {activeModule === "rack" && (
              <UnifiedRoomRackSection
                items={filteredItems}
                onOpenQuickWalkIn={() => setIsQuickWalkInOpen(true)}
                stayModeFilter={stayModeFilter}
                onSelectStayModeFilter={setStayModeFilter}
              />
            )}

            {activeModule === "stays" && <FrontDeskStaysSection />}

            {activeModule === "reservations" && <AdminReservationsSection />}

            {activeModule === "meters" && <BulkMeterReadingSection />}

            {activeModule === "properties" && <UnitMasterSection />}

            {activeModule === "rates" && <RateTariffTaxSection />}

            {activeModule === "rbac" && <AdminRbacUsersSection />}

            {activeModule === "cashier" && (
              <div className="space-y-6">
                <CashierShiftInvertedCard
                  onOpenQuickWalkIn={() => setIsQuickWalkInOpen(true)}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 3. Operational Bottom Bar: Desktop Status Bar + Mobile Bottom Nav */}
      <AdminBottomBar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        selectedProperty={selectedProperty}
      />

      {/* 4. Mobile Slide-Over Sheet Drawer */}
      <AdminMobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        selectedProperty={selectedProperty}
      />

      {/* 5. Quick Walk-In & Check-in Modal */}
      <QuickWalkInModal
        isOpen={isQuickWalkInOpen}
        onClose={() => setIsQuickWalkInOpen(false)}
        onSuccess={() => setIsQuickWalkInOpen(false)}
      />
    </div>
  );
}
