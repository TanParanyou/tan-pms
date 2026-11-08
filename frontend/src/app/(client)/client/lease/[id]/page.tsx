"use client";

import React, { use } from "react";
import { ClientLeaseDetail } from "@/features/client/components/ClientLeaseDetail";

export default function ClientLeaseDynamicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClientLeaseDetail leaseId={id} />;
}
