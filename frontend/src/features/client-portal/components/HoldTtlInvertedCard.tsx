"use client";

import React, { useState, useEffect } from "react";
import { InvertedCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CommandTag } from "@/components/ui/command-tag";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { CLIENT_SAMPLE_PROFILE, SAMPLE_HOLD_RESERVATION } from "../constants";

export function HoldTtlInvertedCard() {
  const locale = useLocale() as "th" | "en";
  const tHold = useTranslations("client.holdBanner");
  const tCommon = useTranslations("common");

  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    CLIENT_SAMPLE_PROFILE.initialRemainingSeconds
  );
  const [slipSubmitted, setSlipSubmitted] = useState(false);

  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
    isUploading,
  } = useDeferredFileUpload({ maxFiles: 1 });

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleConfirmSlip = async () => {
    if (queuedFiles.length === 0) return;
    await commitUploads(async (file) => {
      return `https://storage.tan-pms.internal/slips/${file.name}`;
    });
    setSlipSubmitted(true);
  };

  return (
    <InvertedCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-terminal-yellow inline-block animate-pulse" />
            <span className="text-xs uppercase tracking-wider text-mute font-mono">
              {tHold("statusBadge")}
            </span>
            <CommandTag prefixCode="RES" className="bg-neutral-800 border-neutral-700 text-canvas">
              {SAMPLE_HOLD_RESERVATION.documentNumber}
            </CommandTag>
          </div>
          <h2 className="text-xl font-rounded font-semibold text-canvas" data-inverted-heading>
            {tHold("title")}
          </h2>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-mute block">
            {tHold("remainingTime")}
          </span>
          <span className="font-mono text-3xl font-bold text-canvas tracking-wider tabular-nums">
            {formatCountdown(remainingSeconds)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
        <div className="space-y-2 text-xs">
          <div className="flex justify-between border-b border-neutral-800 py-1">
            <span className="text-mute">{tHold("unitType")}:</span>
            <span className="font-medium text-canvas">
              {resolveLocalizedText(SAMPLE_HOLD_RESERVATION.unitTypeName, locale)}
            </span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 py-1">
            <span className="text-mute">{tHold("stayMode")}:</span>
            <span className="font-medium text-canvas">{tHold("stayModeSample")}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 py-1">
            <span className="text-mute">{tHold("depositAmount")}:</span>
            <span className="font-mono font-semibold text-canvas text-sm tabular-nums">
              {tCommon("currencySymbol")}{SAMPLE_HOLD_RESERVATION.depositAmount}
            </span>
          </div>
          <p className="text-[11px] text-mute pt-1">
            💡 {tHold("bankInstruction")}
          </p>
        </div>

        {/* Deferred Slip Upload */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-[10px] p-4 space-y-3">
          {slipSubmitted ? (
            <div className="text-center py-4 space-y-2">
              <span className="text-2xl" aria-hidden="true">✅</span>
              <h4 className="text-sm font-semibold text-canvas">{tHold("slipSuccessTitle")}</h4>
              <p className="text-xs text-mute">
                {tHold("slipSuccessDesc")}
              </p>
            </div>
          ) : (
            <>
              <DeferredFilePicker
                queuedFiles={queuedFiles}
                onFilesSelected={stageFiles}
                onRemoveFile={removeFile}
                isUploading={isUploading}
                label={tHold("uploadSlip")}
                helperText={tHold("uploadSlipHelper")}
              />
              <Button
                type="button"
                variant="onDark"
                size="sm"
                onClick={handleConfirmSlip}
                disabled={queuedFiles.length === 0 || isUploading}
                className="w-full rounded-full font-medium h-9 text-xs mt-2"
              >
                {isUploading ? tCommon("loading") : tHold("confirmPayment")} →
              </Button>
            </>
          )}
        </div>
      </div>
    </InvertedCard>
  );
}
