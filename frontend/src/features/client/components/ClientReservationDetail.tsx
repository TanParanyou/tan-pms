"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { PhotoAttachmentField } from "@/components/forms/photo-attachment-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { StoredFileViewer } from "@/components/shared/stored-file-viewer";
import { useCountdownTimer } from "@/hooks/use-countdown-timer";
import { useStagedPhoto } from "@/hooks/use-staged-photo";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { formatCurrencyThb, formatDateTime } from "@/lib/formatters";
import type { ReservationItemDto } from "@/generated/api";
import {
  useClientReservation,
  useSubmitReservationSlipMutation,
  useCancelClientReservationMutation,
} from "../api/use-client-reservations";
import { RESERVATION_STATUS_BADGE_VARIANT } from "../constants";
import { secondsUntil } from "./HoldTtlInvertedCard";

export function ClientReservationDetail({ reservationId }: { reservationId: string }) {
  const t = useTranslations("client.portal.reservations");
  const tCommon = useTranslations("common");
  const { data, isLoading, isError, refetch } = useClientReservation(reservationId);
  if (isLoading) return <PageLoading message={tCommon("loading")} />;
  if (isError) return <EmptyState title={t("detailLoadError")} actionLabel={tCommon("retry")} onAction={() => void refetch()} />;
  if (!data) return <EmptyState title={t("notFound")} />;
  return <ReservationBody reservation={data} onExpired={() => void refetch()} />;
}

function ReservationBody({ reservation, onExpired }: { reservation: ReservationItemDto; onExpired: () => void }) {
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("client.portal.reservations");
  const tModes = useTranslations("stayModes");
  const tCommon = useTranslations("common");
  const { toastSuccess, toastApiError } = useToast();
  const slipMutation = useSubmitReservationSlipMutation();
  const cancelMutation = useCancelClientReservationMutation();
  const photo = useStagedPhoto("", "PaymentSlip", "client");
  const inFlight = useRef(false);
  const [showCancel, setShowCancel] = useState(false);
  const [slipMissing, setSlipMissing] = useState(false);

  const isHold = reservation.status === "Hold";
  const { formattedTime, remainingSeconds } = useCountdownTimer({
    initialSeconds: isHold ? secondsUntil(reservation.holdExpiresAt) : 0,
    onExpire: onExpired,
    autoStart: isHold,
  });
  const isBusy = photo.isUploading || slipMutation.isPending || cancelMutation.isPending;
  useUnsavedChanges(photo.queuedFiles.length > 0);

  const submitSlip = async () => {
    if (isBusy || inFlight.current) return;
    if (photo.queuedFiles.length === 0) {
      setSlipMissing(true);
      return;
    }
    inFlight.current = true;
    try {
      // Deferred upload: runs only on submit; failure keeps the staged file.
      const key = await photo.commit(null);
      if (!key) return;
      await slipMutation.mutateAsync({ id: reservation.id, paymentSlipFileKey: key });
      photo.clear();
      toastSuccess(t("toastSlipSubmitted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
    }
  };

  const handleCancel = async (reason: string): Promise<boolean> => {
    try {
      await cancelMutation.mutateAsync({ id: reservation.id, reason });
      toastSuccess(t("toastCancelled"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="RES"
        title={reservation.documentNumber}
        description={t("detailDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/client/reservations">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {isHold && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowCancel(true)} className="h-9 rounded-full px-4 gap-1.5 text-xs">
                <Ban className="h-4 w-4" />
                <span>{t("btnCancel")}</span>
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label={t("colStatus")}>
          <Badge variant={RESERVATION_STATUS_BADGE_VARIANT[reservation.status]}>{t(`status.${reservation.status}`)}</Badge>
        </DetailItem>
        <DetailItem label={t("colUnitType")}>{resolveLocalizedText(reservation.unitType.name, locale)}</DetailItem>
        <DetailItem label={t("stayMode")}>{tModes(reservation.stayMode)}</DetailItem>
        <DetailItem label={t("colDeposit")}>{formatCurrencyThb(reservation.depositAmount)}</DetailItem>
        <DetailItem label={t("slotStart")}>{formatDateTime(reservation.slotStartAt, locale)}</DetailItem>
        <DetailItem label={t("slotEnd")}>{formatDateTime(reservation.slotEndAt, locale)}</DetailItem>
        {reservation.assignedUnit && <DetailItem label={t("assignedUnit")}>{reservation.assignedUnit.unitNumber}</DetailItem>}
        {isHold && (
          <DetailItem label={t("holdRemaining")}>
            <span className="font-mono text-lg font-semibold tabular-nums" data-testid="hold-countdown">
              {formattedTime}
            </span>
          </DetailItem>
        )}
        {reservation.status === "Cancelled" && <DetailItem label={t("cancelReason")}>{reservation.cancellationReason ?? "-"}</DetailItem>}
        {reservation.paymentSlipFileKey && (
          <DetailItem label={t("slipImage")}>
            <StoredFileViewer fileKey={reservation.paymentSlipFileKey} scope="client" />
          </DetailItem>
        )}
      </div>

      {isHold && remainingSeconds > 0 && (
        <div className="space-y-3 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none">
          <h3 className="text-sm font-semibold text-ink">{t("sectionSlip")}</h3>
          <p className="text-xs text-body">{t("slipInstruction")}</p>
          <PhotoAttachmentField
            label={t("fieldSlip")}
            queuedFiles={photo.queuedFiles}
            stageFiles={(files) => {
              setSlipMissing(false);
              photo.stageFiles(files);
            }}
            removeFile={photo.removeFile}
            isUploading={photo.isUploading}
            scope="client"
            accept="image/*,.pdf"
          />
          {slipMissing && <p className="text-[11px] font-mono text-destructive">{t("errorSlipRequired")}</p>}
          <div className="flex justify-end">
            <Button type="button" disabled={isBusy} onClick={() => void submitSlip()} className="h-10 rounded-full px-5 text-xs">
              {isBusy ? tCommon("loading") : t("btnSubmitSlip")}
            </Button>
          </div>
        </div>
      )}
      {isHold && remainingSeconds === 0 && <p className="text-xs text-destructive">{t("holdExpiredHint")}</p>}

      <ReasonDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title={t("cancelTitle")}
        description={t("cancelDescription")}
        actionText={t("btnCancel")}
        confirmTitle={t("confirmCancelTitle")}
        confirmMessage={t("confirmCancelMessage", { document: reservation.documentNumber })}
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancel}
      />
    </div>
  );
}
