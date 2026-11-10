"use client";

import React, { use } from "react";
import { ClientParcelDetail } from "@/features/client/components/ClientParcelDetail";

export default function ClientParcelDynamicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClientParcelDetail parcelId={id} />;
}
