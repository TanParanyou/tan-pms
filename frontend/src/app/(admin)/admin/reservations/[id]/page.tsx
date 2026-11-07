"use client";

import React, { use } from "react";
import { ReservationEditor } from "@/features/reservations/components/ReservationEditor";

export default function AdminReservationDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ReservationEditor reservationId={id} />;
}
