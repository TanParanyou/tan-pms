"use client";

import React, { use } from "react";
import { StayCreateEditor } from "@/features/stays/components/StayCreateEditor";
import { StayDetailEditor } from "@/features/stays/components/StayDetailEditor";

export default function AdminStayDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  if (id === "create") {
    return <StayCreateEditor />;
  }

  return <StayDetailEditor stayId={id} />;
}
