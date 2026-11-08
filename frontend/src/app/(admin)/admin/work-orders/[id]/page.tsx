"use client";

import React, { use } from "react";
import { WorkOrderEditor } from "@/features/work-orders/components/WorkOrderEditor";

export default function AdminWorkOrderDynamicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <WorkOrderEditor workOrderId={id} />;
}
