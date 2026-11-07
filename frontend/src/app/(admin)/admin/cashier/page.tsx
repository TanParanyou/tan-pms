"use client";

import React from "react";
import { CashierShiftInvertedCard } from "@/features/cashier/components/CashierShiftInvertedCard";
import { PageHeader } from "@/components/layout/page-header";
import { useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { useTranslations } from "next-intl";

export default function AdminCashierPage() {
  const tNav = useTranslations("admin.nav");
  const { openQuickWalkIn } = useAdminWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="SHF"
        title={tNav("cashier")}
        description="Daily cashier shift drawer tally and cash audit"
      />
      {/* Exactly 1 Inverted Card on Cashier page per Ollama Minimal Design System */}
      <CashierShiftInvertedCard onOpenQuickWalkIn={openQuickWalkIn} />
    </div>
  );
}
