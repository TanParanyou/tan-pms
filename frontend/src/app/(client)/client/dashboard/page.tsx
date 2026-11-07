"use client";

import React from "react";
import { HoldTtlInvertedCard } from "@/features/client/components/HoldTtlInvertedCard";
import { ClientNotificationsSection } from "@/features/notifications/components/ClientNotificationsSection";

export default function ClientDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Exactly 1 Inverted Card on Client Dashboard per Ollama Minimal Design System */}
      <HoldTtlInvertedCard />

      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
        <ClientNotificationsSection />
      </div>
    </div>
  );
}
