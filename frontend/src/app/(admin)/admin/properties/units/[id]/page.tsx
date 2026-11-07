"use client";

import React, { use } from "react";
import { UnitMasterEditor } from "@/features/properties/components/UnitMasterEditor";

export default function AdminUnitDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <UnitMasterEditor unitId={id} />;
}
