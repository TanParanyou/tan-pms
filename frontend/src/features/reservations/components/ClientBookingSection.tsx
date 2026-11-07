"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useCountdownTimer } from "@/hooks/use-countdown-timer";
import { formatCurrencyThb, formatDecimal } from "@/lib/formatters";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { CheckCircle2 } from "lucide-react";
import {
  INITIAL_AVAILABILITY_ITEMS,
  INITIAL_RESERVATIONS,
  SAMPLE_PROPERTY,
  SAMPLE_CUSTOMERS,
} from "../constants";
import type {
  UnitTypeAvailabilityDto,
  ReservationItemDto,
  ReservationStayModeType,
} from "../types";

export interface ClientBookingSectionProps {
  initialAvailability?: UnitTypeAvailabilityDto[];
  initialClientReservations?: ReservationItemDto[];
}

export function ClientBookingSection({
  initialAvailability = INITIAL_AVAILABILITY_ITEMS,
  initialClientReservations = INITIAL_RESERVATIONS.filter(
    (r) => r.customer.id === "cus-02"
  ),
}: ClientBookingSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tBooking = useTranslations("client.booking");
  const tModes = useTranslations("stayModes");

  // Search State
  const [selectedStayMode, setSelectedStayMode] =
    useState<ReservationStayModeType>("Daily");
  const [searchCheckIn, setSearchCheckIn] = useState("2026-11-20T14:00");
  const [searchCheckOut, setSearchCheckOut] = useState("2026-11-22T12:00");

  // Availability List
  const [availabilityList, setAvailabilityList] =
    useState<UnitTypeAvailabilityDto[]>(initialAvailability);

  // Active Hold Reservation State
  const [activeHoldRes, setActiveHoldRes] = useState<ReservationItemDto | null>(
    null
  );
  const [slipSubmitted, setSlipSubmitted] = useState(false);

  // Client's Reservations list
  const [myReservations, setMyReservations] = useState<ReservationItemDto[]>(
    initialClientReservations
  );

  // Deferred File Upload for Bank Slip
  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
    isUploading,
  } = useDeferredFileUpload({ maxFiles: 1 });

  // 15-Minute Countdown Timer via central useCountdownTimer
  const {
    remainingSeconds,
    formattedTime,
    reset: resetTimer,
  } = useCountdownTimer({
    initialSeconds: 15 * 60,
    onExpire: () => {
      setActiveHoldRes((curr) =>
        curr ? { ...curr, status: "Expired" } : null
      );
    },
    autoStart: Boolean(activeHoldRes && activeHoldRes.status === "Hold"),
  });

  // Handle Book & Lock Quota
  const handleBookRoom = (item: UnitTypeAvailabilityDto) => {
    if (item.netAvailableQuota <= 0) return;

    // Deduct 1 from available quota
    setAvailabilityList((prev) =>
      prev.map((a) =>
        a.unitType.id === item.unitType.id
          ? {
              ...a,
              netAvailableQuota: Math.max(0, a.netAvailableQuota - 1),
              unassignedQuotaHeld: a.unassignedQuotaHeld + 1,
            }
          : a
      )
    );

    const newDocSeq = String(myReservations.length + 10).padStart(4, "0");
    const newDoc = `BKK01-RES-2611-${newDocSeq}`;

    const newRes: ReservationItemDto = {
      id: `client-res-${Date.now()}`,
      documentNumber: newDoc,
      property: SAMPLE_PROPERTY,
      customer: SAMPLE_CUSTOMERS[1], // Vipaporn
      unitType: item.unitType,
      stayMode: selectedStayMode,
      slotStartAt: `${searchCheckIn}:00Z`,
      slotEndAt: `${searchCheckOut}:00Z`,
      effectiveBlockedEndAt: `${searchCheckOut}:00Z`,
      holdExpiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      depositAmount: item.estimatedDepositAmount,
      status: "Hold",
    };

    setActiveHoldRes(newRes);
    resetTimer(900);
    setSlipSubmitted(false);
    setMyReservations((prev) => [newRes, ...prev]);
  };

  // Handle Slip Upload Submit
  const handleSubmitSlip = async () => {
    if (queuedFiles.length === 0 || !activeHoldRes) return;
    await commitUploads(async (file) => {
      return `https://storage.tan-pms.internal/slips/${file.name}`;
    });

    const updatedRes: ReservationItemDto = {
      ...activeHoldRes,
      status: "PendingVerification",
      paymentSlipFileKey: `slips/${queuedFiles[0]?.name || "slip.jpg"}`,
    };

    setActiveHoldRes(updatedRes);
    setSlipSubmitted(true);
    setMyReservations((prev) =>
      prev.map((r) => (r.id === activeHoldRes.id ? updatedRes : r))
    );
  };

  return (
    <div className="space-y-8">
      {/* Search & Availability Selection Card (Ollama Minimal 12px, border-hairline, bg-canvas, no InvertedCard) */}
      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CommandTag prefixCode="BOOK">ONLINE RESERVATION</CommandTag>
          </div>
          <h2 className="font-rounded text-xl font-semibold tracking-tight text-ink">
            {tBooking("title")}
          </h2>
          <p className="text-xs text-body">{tBooking("description")}</p>
        </div>

        {/* Search Controls */}
        <div className="p-4 rounded-[12px] bg-surface-soft/60 border border-hairline space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-ink">
              {tBooking("searchStayMode")}
            </Label>
            <div className="flex items-center gap-2">
              {(["Hourly", "Daily", "Monthly"] as ReservationStayModeType[]).map(
                (mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={selectedStayMode === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStayMode(mode)}
                    className="rounded-full text-xs font-mono h-8 px-4"
                  >
                    {tModes(mode)}
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tBooking("searchCheckIn")}
              </Label>
              <Input
                type="text"
                value={searchCheckIn}
                onChange={(e) => setSearchCheckIn(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-ink">
                {tBooking("searchCheckOut")}
              </Label>
              <Input
                type="text"
                value={searchCheckOut}
                onChange={(e) => setSearchCheckOut(e.target.value)}
                className="h-10 rounded-full font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Room Types Availability Grid */}
        <div className="space-y-3">
          <h3 className="font-rounded font-semibold text-sm text-ink">
            {tBooking("availableRooms")}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availabilityList.map((item) => {
              const isAvailable = item.netAvailableQuota > 0;

              return (
                <div
                  key={item.unitType.id}
                  className="rounded-[12px] border border-hairline p-5 space-y-4 bg-canvas flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-rounded font-semibold text-sm text-ink">
                          {resolveLocalizedText(item.unitType.name, locale)}
                        </h4>
                        <span className="font-mono text-xs text-mute">
                          {item.unitType.code} • {item.unitType.areaSqm} m²
                        </span>
                      </div>
                      <Badge
                        variant={isAvailable ? "default" : "outline"}
                        className="rounded-full text-[10px] font-mono px-2 py-0.5 shrink-0"
                      >
                        {isAvailable
                          ? tBooking("quotaRoomsLeft", {
                              count: item.netAvailableQuota,
                            })
                          : tBooking("quotaExhausted")}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-hairline space-y-1 font-mono text-xs">
                      <div className="text-primary font-bold text-sm">
                        {tBooking("rateStartingFrom", {
                          rate: formatDecimal(item.estimatedRoomRate, 0),
                        })}
                      </div>
                      <div className="text-mute text-[11px]">
                        {tBooking("depositRequired", {
                          amount: formatDecimal(item.estimatedDepositAmount, 0),
                        })}
                      </div>
                      {selectedStayMode === "Hourly" &&
                        item.turnaroundBufferMinutes > 0 && (
                          <div className="text-[10px] text-mute pt-0.5">
                            {tBooking("turnaroundNotice", {
                              minutes: item.turnaroundBufferMinutes,
                            })}
                          </div>
                        )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => handleBookRoom(item)}
                    className="w-full rounded-full text-xs h-9 font-medium"
                  >
                    {isAvailable
                      ? tBooking("bookNow")
                      : tBooking("quotaExhausted")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Booking Hold & Slip Upload Section */}
      {activeHoldRes && (
        <div
          data-testid="active-hold-container"
          className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary inline-block animate-pulse" />
                <span className="font-rounded font-semibold text-base text-ink">
                  {tBooking("activeHoldTitle")}
                </span>
                <CommandTag prefixCode="RES">
                  {activeHoldRes.documentNumber}
                </CommandTag>
              </div>
              <p className="text-xs text-body">{tBooking("activeHoldDesc")}</p>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-2 bg-surface-soft px-4 py-2 rounded-full border border-hairline">
              <span className="text-xs text-mute font-medium">
                {tBooking("holdCountdownLabel")}:
              </span>
              <span
                data-testid="hold-countdown-timer"
                className="font-mono text-sm font-bold text-ink tabular-nums"
              >
                {formattedTime}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-surface-soft/60 border border-hairline rounded-[12px] space-y-1">
              <span className="text-mute block">
                {tBooking("depositAmountLabel")}
              </span>
              <span className="text-base font-bold text-primary tabular-nums">
                {formatCurrencyThb(activeHoldRes.depositAmount)}
              </span>
            </div>
            <div className="p-3 bg-surface-soft/60 border border-hairline rounded-[12px] space-y-1">
              <span className="text-mute block">
                {tBooking("bankAccountLabel")}
              </span>
              <span className="text-xs font-semibold text-ink">
                {tBooking("bankAccountDetails")}
              </span>
            </div>
          </div>

          {/* Deferred Slip Upload or Success Banner */}
          {slipSubmitted ? (
            <div
              data-testid="slip-success-banner"
              className="p-4 rounded-[12px] bg-surface-soft border border-hairline space-y-1 text-xs"
            >
              <div className="font-semibold text-primary flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-terminal-green shrink-0" aria-hidden="true" />
                <span>{tBooking("slipSuccessTitle")}</span>
              </div>
              <div className="text-body">{tBooking("slipSuccessDesc")}</div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <DeferredFilePicker
                queuedFiles={queuedFiles}
                onFilesSelected={stageFiles}
                onRemoveFile={removeFile}
                isUploading={isUploading}
                accept="image/*,.pdf"
                multiple={false}
              />

              <Button
                type="button"
                disabled={queuedFiles.length === 0 || isUploading}
                onClick={handleSubmitSlip}
                className="rounded-full text-xs h-9 px-6 font-medium"
              >
                {tBooking("uploadSlipButton")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* My Reservations List */}
      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-none space-y-4">
        <h3 className="font-rounded font-semibold text-base text-ink">
          {tBooking("myReservationsTitle")}
        </h3>

        {myReservations.length === 0 ? (
          <div className="p-6 text-center text-xs text-mute bg-surface-soft/40 border border-hairline rounded-[12px]">
            {tBooking("emptyClientReservations")}
          </div>
        ) : (
          <div className="space-y-3">
            {myReservations.map((res) => (
              <div
                key={res.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-[12px] border border-hairline bg-surface-soft/30 font-mono text-xs"
              >
                <div className="flex items-center gap-3">
                  <CommandTag prefixCode="RES">{res.documentNumber}</CommandTag>
                  <div>
                    <div className="font-semibold text-ink">
                      {resolveLocalizedText(res.unitType.name, locale)}
                    </div>
                    <div className="text-[11px] text-mute">
                      {res.slotStartAt.slice(0, 10)} → {res.slotEndAt.slice(0, 10)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-bold text-ink">
                    {formatCurrencyThb(res.depositAmount)}
                  </span>
                  <Badge
                    variant={res.status === "Confirmed" ? "default" : "outline"}
                    className="rounded-full text-[10px] px-2.5 py-0.5"
                  >
                    {res.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
