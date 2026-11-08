"use client";

import React, { use } from "react";
import { ClientWorkOrderEditor } from "@/features/client/components/ClientWorkOrderEditor";

export default function ClientWorkOrderDynamicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClientWorkOrderEditor workOrderId={id} />;
}
