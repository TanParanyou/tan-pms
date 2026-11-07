"use client";

import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { useTranslations } from "next-intl";
import { SAMPLE_PARCEL_DETAILS } from "@/features/client/constants";
import { Package } from "lucide-react";

export default function ClientParcelsPage() {
  const tParcel = useTranslations("client.parcels");

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="PCL"
        title="Parcels & Mailroom"
        description="Track incoming packages, delivery notifications, and lobby front desk pick-up status"
      />

      <Card className="rounded-[12px] border border-hairline p-6 space-y-4 shadow-none bg-canvas">
        <CardHeader className="p-0 pb-2">
          <div className="flex items-center gap-2">
            <CommandTag prefixCode="PCL">PARCEL ARRIVED</CommandTag>
            <span className="text-xs text-mute font-mono">Unit A-301</span>
          </div>
        </CardHeader>

        <div className="rounded-[12px] border border-hairline bg-surface-soft/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-mute" />
              <span className="font-semibold text-ink text-sm">
                {SAMPLE_PARCEL_DETAILS.parcelNumber}
              </span>
              <Badge variant="outline" className="rounded-full text-[10px] bg-canvas">
                {tParcel("statusArrived")}
              </Badge>
            </div>
            <p className="text-mute text-xs">
              {tParcel("carrierKerry")} • 2026-11-06 14:32
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[11px] text-mute block">
              {tParcel("pickupLocationLabel")}
            </span>
            <span className="font-medium text-ink">
              {tParcel("pickupLocationLobby")}
            </span>
          </div>
        </div>

        <p className="text-xs text-mute">
          {tParcel("pickupInstructions")}
        </p>
      </Card>
    </div>
  );
}
