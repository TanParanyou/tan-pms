"use client";

import React, { useState } from "react";
import { InvertedCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useTranslations } from "next-intl";
import { ACTIVE_CASHIER_SHIFT_DEMO } from "../constants";

export interface CashierShiftInvertedCardProps {
  shiftNumber?: string;
  onOpenQuickWalkIn: () => void;
}

export function CashierShiftInvertedCard({
  shiftNumber = ACTIVE_CASHIER_SHIFT_DEMO.shiftNumber,
  onOpenQuickWalkIn,
}: CashierShiftInvertedCardProps) {
  const t = useTranslations("admin.cashier");
  const tCommon = useTranslations("common");
  const [slipVerified, setSlipVerified] = useState<"pending" | "approved" | "rejected">("pending");
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);

  const handleConfirmCloseShift = async () => {
    setIsClosingShift(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsClosingShift(false);
    setShowCloseShiftModal(false);
  };

  return (
    <>
      <InvertedCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-terminal-green inline-block animate-pulse" />
              <span className="text-xs uppercase tracking-wider text-mute font-mono">
                {t("activeShift")}
              </span>
              <CommandTag prefixCode="SHF" className="bg-neutral-800 border-neutral-700 text-canvas">
                {shiftNumber}
              </CommandTag>
            </div>
            <h2 className="text-xl font-rounded font-semibold text-canvas" data-inverted-heading>
              {t("title")}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-mute block">{t("currentBalance")}</span>
              <span className="font-mono text-xl font-semibold text-canvas tabular-nums">
                {t("drawerBalance")}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCloseShiftModal(true)}
              className="rounded-full bg-transparent text-canvas border-neutral-700 hover:bg-neutral-800 text-xs h-9"
            >
              {t("closeDrawer")}
            </Button>
            <Button
              type="button"
              variant="onDark"
              size="sm"
              onClick={onOpenQuickWalkIn}
              className="rounded-full font-medium h-9 text-xs"
            >
              + {t("quickWalkIn")}
            </Button>
          </div>
        </div>

        {/* Slip Verification Queue */}
        <div className="rounded-[8px] bg-neutral-900 border border-neutral-800 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg" aria-hidden="true">🧾</span>
            <div>
              <span className="text-xs font-mono text-canvas block">
                {t("queueSampleTitle")}
              </span>
              <span className="text-[11px] text-mute">
                {t("queueSampleDetail")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {slipVerified === "pending" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSlipVerified("approved")}
                  className="rounded-full bg-terminal-green text-canvas hover:bg-terminal-green/90 h-8 text-xs font-medium"
                >
                  ✓ {t("verifyApprove")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSlipVerified("rejected")}
                  className="rounded-full bg-transparent text-canvas border-neutral-700 hover:bg-neutral-800 h-8 text-xs font-medium"
                >
                  ✕ {t("verifyReject")}
                </Button>
              </>
            ) : (
              <Badge variant={slipVerified === "approved" ? "success" : "destructive"}>
                {slipVerified === "approved" ? t("statusApproved") : t("statusRejected")}
              </Badge>
            )}
          </div>
        </div>
      </InvertedCard>

      {/* Safety Confirmation Modal for Closing Shift */}
      <ConfirmationModal
        isOpen={showCloseShiftModal}
        onClose={() => setShowCloseShiftModal(false)}
        onConfirm={handleConfirmCloseShift}
        title={tCommon("dialog.confirmCloseShiftTitle")}
        message={tCommon("dialog.confirmCloseShiftMessage")}
        confirmText={tCommon("confirm")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isClosingShift}
      />
    </>
  );
}
