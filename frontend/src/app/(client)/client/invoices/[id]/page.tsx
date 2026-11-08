"use client";

import React, { use } from "react";
import { ClientInvoiceDetail } from "@/features/client/components/ClientInvoiceDetail";

export default function ClientInvoiceDynamicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClientInvoiceDetail invoiceId={id} />;
}
