"use client";

import React from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { StoredFileViewer } from "@/components/shared/stored-file-viewer";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatDateTime } from "@/lib/formatters";
import { PARCEL_STATUS_BADGE_VARIANT } from "@/features/parcels/constants";
import type { ParcelStatusType } from "@/features/parcels/types";
import { useClientParcel } from "../api/use-client-operations";

export function ClientParcelDetail({ parcelId }: { parcelId: string }) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.parcels");
  const tParcel = useTranslations("admin.parcels");
  const tCommon = useTranslations("common");
  const { data, isLoading, isError, refetch } = useClientParcel(parcelId);

  if (isLoading) return <PageLoading message={tCommon("loading")} />;
  if (isError) return <EmptyState title={t("detailLoadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />;
  if (!data) return <EmptyState title={t("notFound")} />;

  const status = data.status as ParcelStatusType;
  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="PCL"
        title={data.documentNumber}
        description={t("detailDescription")}
        actions={
          <Link href="/client/parcels">
            <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" />
              <span>{tCommon("back")}</span>
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label={t("colStatus")}>
          <Badge variant={PARCEL_STATUS_BADGE_VARIANT[status]}>{tParcel(`status.${status}`)}</Badge>
        </DetailItem>
        <DetailItem label={t("colUnit")}>
          {data.unit.unitNumber} ({resolveLocalizedText(data.unit.buildingName, locale)})
        </DetailItem>
        <DetailItem label={t("colCarrier")}>{data.carrierName}</DetailItem>
        <DetailItem label={t("colTracking")}>{data.trackingNumber ?? "-"}</DetailItem>
        <DetailItem label={t("colArrivedAt")}>{formatDateTime(data.arrivedAt, locale)}</DetailItem>
        <DetailItem label={t("colPickedUpAt")}>{data.pickedUpAt ? formatDateTime(data.pickedUpAt, locale) : "-"}</DetailItem>
        <DetailItem label={t("recipientName")}>{data.recipientName ?? "-"}</DetailItem>
        {data.voidReason != null && <DetailItem label={t("voidReason")}>{data.voidReason}</DetailItem>}
        <DetailItem label={t("photo")}>
          <StoredFileViewer fileKey={data.photoFileKey} scope="client" />
        </DetailItem>
      </div>
      {status === "Arrived" && <p className="text-xs text-mute">{t("pickupInstructions")}</p>}
    </div>
  );
}
