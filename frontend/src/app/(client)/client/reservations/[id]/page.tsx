"use client";

import React, { use } from "react";
import { ClientReservationDetail } from "@/features/client/components/ClientReservationDetail";

export default function ClientReservationDynamicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClientReservationDetail reservationId={id} />;
}
