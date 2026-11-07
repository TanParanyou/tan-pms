"use client";

import React, { use } from "react";
import { AdminUserEditor } from "@/features/users/components/AdminUserEditor";

export default function AdminUserDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminUserEditor userId={id} />;
}
