"use client";

import React, { use } from "react";
import { LeaseCreateEditor } from "@/features/leases/components/LeaseCreateEditor";
import { LeaseDetailEditor } from "@/features/leases/components/LeaseDetailEditor";

export default function AdminLeaseDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  if (id === "create") {
    return <LeaseCreateEditor />;
  }

  return <LeaseDetailEditor leaseId={id} />;
}
