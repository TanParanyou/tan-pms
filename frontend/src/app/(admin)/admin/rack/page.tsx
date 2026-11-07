"use client";

import React, { useState } from "react";
import { UnifiedRoomRackSection } from "@/features/rack/components/UnifiedRoomRackSection";
import { CashierShiftInvertedCard } from "@/features/cashier/components/CashierShiftInvertedCard";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { useAdminRoomRack } from "@/features/rack/api/use-rack";

export default function RoomRackPage() {
  const { activeProperty, openQuickWalkIn } = useAdminWorkspace();
  const { data: rackData } = useAdminRoomRack(activeProperty.id);
  const [stayModeFilter, setStayModeFilter] = useState<string>("All");

  const rackItems = rackData?.items ?? [];

  const filteredItems =
    stayModeFilter === "All"
      ? rackItems
      : rackItems.filter(
          (item) =>
            item.activeStayMode === stayModeFilter ||
            item.supportedStayModes.includes(stayModeFilter as "Hourly" | "Daily" | "Monthly")
        );

  return (
    <div className="space-y-6">
      {/* Exactly 1 Inverted Card on Rack page per Ollama Minimal Design System */}
      <CashierShiftInvertedCard onOpenQuickWalkIn={openQuickWalkIn} />

      <UnifiedRoomRackSection
        items={filteredItems}
        onOpenQuickWalkIn={openQuickWalkIn}
        stayModeFilter={stayModeFilter}
        onSelectStayModeFilter={setStayModeFilter}
      />
    </div>
  );
}
