"use client";

import React from "react";
import { ActiveLeaseAndBillingSection } from "@/features/client/components/ActiveLeaseAndBillingSection";
import { PageHeader } from "@/components/layout/page-header";

export default function ClientInvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="INV"
        title="Invoices & Active Lease"
        description="View your active monthly lease, breakdown of common fees, utility meters, and payment history"
      />
      <ActiveLeaseAndBillingSection />
    </div>
  );
}
