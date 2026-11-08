"use client";

import React, { use } from "react";
import { ParcelEditor } from "@/features/parcels/components/ParcelEditor";

export default function AdminParcelDynamicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ParcelEditor parcelId={id} />;
}
