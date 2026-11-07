"use client";

import React, { use } from "react";
import { RatePlanEditor } from "@/features/rates/components/RatePlanEditor";

export default function AdminRateDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <RatePlanEditor ratePlanId={id} />;
}
