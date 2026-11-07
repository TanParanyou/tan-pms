"use client";

import React from "react";
import { BulkMeterReadingSection } from "@/features/meters/components/BulkMeterReadingSection";
import { PageHeader } from "@/components/layout/page-header";
import { useTranslations } from "next-intl";

export default function AdminMetersPage() {
  const tNav = useTranslations("admin.nav");
  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="MTR"
        title={tNav("meters")}
        description="Bulk utility meter reading and rollover verification engine"
      />
      <BulkMeterReadingSection />
    </div>
  );
}
