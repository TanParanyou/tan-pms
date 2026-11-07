"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { AVAILABLE_WALK_IN_UNITS, DEFAULT_KEY_DEPOSIT } from "../constants";
import { Check, Dices } from "lucide-react";

export interface QuickWalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (documentNumber: string) => void;
}

export function QuickWalkInModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickWalkInModalProps) {
  const locale = useLocale() as "th" | "en";
  const tModal = useTranslations("admin.checkInModal");
  const tTerms = useTranslations("terms");
  const tModes = useTranslations("stayModes");
  const tCondition = useTranslations("conditionStatus");
  const tCommon = useTranslations("common");
  const tPlaceholders = useTranslations("common.placeholders");

  const [activeTab, setActiveTab] = useState("tab-guest");
  const [guestName, setGuestName] = useState("");
  const [guestId, setGuestId] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string>(AVAILABLE_WALK_IN_UNITS[0].id);
  const [stayMode, setStayMode] = useState<"Hourly" | "Daily" | "Monthly">("Hourly");
  const [keyDeposit, setKeyDeposit] = useState<string>(DEFAULT_KEY_DEPOSIT);
  const [overrideDirty, setOverrideDirty] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enterprise Hook: useDeferredFileUpload
  const {
    queuedFiles,
    stageFiles,
    removeFile,
    commitUploads,
    isUploading,
    clearFiles,
  } = useDeferredFileUpload({ maxFiles: 2 });

  // Field error mapping
  const formErrors = useMemo(() => {
    if (!formSubmitted) return {};
    const errs: Record<string, string> = {};
    if (!guestName.trim()) errs["guestName"] = tCommon("required");
    if (!guestId.trim()) errs["guestId"] = tCommon("required");
    if (selectedUnit === "A-302" && overrideDirty && !overrideReason.trim()) {
      errs["overrideReason"] = tCommon("required");
    }
    return errs;
  }, [formSubmitted, guestName, guestId, selectedUnit, overrideDirty, overrideReason, tCommon]);

  const fieldToTabMap = {
    guestName: "tab-guest",
    guestId: "tab-guest",
    overrideReason: "tab-room",
  };

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap,
    errors: formErrors,
  });

  if (!isOpen) return null;

  const handleAttemptSubmit = () => {
    setFormSubmitted(true);
    if (!guestName.trim() || !guestId.trim() || (overrideDirty && !overrideReason.trim())) {
      if (firstErrorTab) {
        setActiveTab(firstErrorTab);
      }
      return;
    }

    if (selectedUnit === "A-302" && overrideDirty) {
      setShowOverrideConfirm(true);
      return;
    }

    void executeCheckIn();
  };

  const executeCheckIn = async () => {
    setIsSubmitting(true);
    try {
      await commitUploads(async (file) => {
        return `https://storage.tan-pms.internal/checkins/${file.name}`;
      });
      setIsSubmitting(false);
      clearFiles();
      onSuccess("BKK01-STY-2611-0022");
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  };

  const tabs: FormTabItem[] = [
    {
      id: "tab-guest",
      label: tModal("tabGuest"),
      hasError: hasTabError("tab-guest"),
      content: (
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between min-h-[20px] mb-1.5">
              <Label htmlFor="guestName" className="text-xs font-medium">
                {tTerms("Customer")} ({tCommon("required")})
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGuestName("Somchai Prasert")}
                className="text-[11px] text-body hover:text-ink p-0 h-auto"
              >
                {tModal("fetchExistingCustomer")}
              </Button>
            </div>
            <Input
              id="guestName"
              placeholder={tPlaceholders("guestName")}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="h-10 text-sm"
              wrapperClassName="!mb-0"
            />
            {formSubmitted && !guestName && (
              <span className="text-[11px] text-destructive block">{tCommon("required")}</span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between min-h-[20px] mb-1.5">
              <Label htmlFor="guestId" className="text-xs font-medium">
                {tPlaceholders("nationalId")} ({tCommon("required")})
              </Label>
              <Tooltip content={tModal("randomIdTooltip")} position="top">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Generate ID"
                  onClick={() =>
                    setGuestId(
                      `1-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
                        10000 + Math.random() * 90000
                      )}-12-3`
                    )
                  }
                  className="h-6 w-6 rounded-full text-xs text-body"
                >
                  <Dices className="h-3.5 w-3.5" />
                </Button>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="guestId"
                placeholder={tPlaceholders("nationalId")}
                value={guestId}
                onChange={(e) => setGuestId(e.target.value)}
                className="h-10 text-sm font-mono"
                wrapperClassName="!mb-0"
              />
            </div>
            {formSubmitted && !guestId && (
              <span className="text-[11px] text-destructive block">{tCommon("required")}</span>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone" className="text-xs font-medium">
              {tModal("phoneLabel")}
            </Label>
            <Input
              id="phone"
              placeholder={tPlaceholders("quickWalkInPhone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 text-sm font-mono"
              wrapperClassName="!mb-0"
            />
          </div>
        </div>
      ),
    },
    {
      id: "tab-room",
      label: tModal("tabRoom"),
      hasError: hasTabError("tab-room"),
      content: (
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium">{tTerms("Unit")}</Label>
            <SelectPill
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              {AVAILABLE_WALK_IN_UNITS.map((u) => {
                const typeName = resolveLocalizedText(u.unitTypeName, locale);
                const condName = u.isClean ? tCondition("Clean") : tCondition("Dirty");
                return (
                  <option key={u.id} value={u.id}>
                    {u.unitNumber} ({typeName} - {condName})
                  </option>
                );
              })}
            </SelectPill>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">{tTerms("StayMode")}</Label>
            <SelectPill
              value={stayMode}
              onChange={(e) =>
                setStayMode(e.target.value as "Hourly" | "Daily" | "Monthly")
              }
            >
              <option value="Hourly">Hourly ({tModes("Hourly")})</option>
              <option value="Daily">Daily ({tModes("Daily")})</option>
              <option value="Monthly">Monthly ({tModes("Monthly")})</option>
            </SelectPill>
          </div>

          {selectedUnit === "A-302" && (
            <div className="rounded-[10px] border border-terminal-yellow bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOverrideDirty(!overrideDirty)}
                  className="rounded-full h-7 px-3 text-xs bg-canvas border-terminal-yellow text-amber-800"
                >
                  {overrideDirty ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      <span>{tModal("allowOverride")}</span>
                    </span>
                  ) : (
                    tModal("requestOverride")
                  )}
                </Button>
                <span className="text-xs font-medium text-amber-800">
                  {tModal("overrideDirty")}
                </span>
              </div>
              {overrideDirty && (
                <div className="space-y-1 pt-1">
                  <Label htmlFor="overrideReason" className="text-[11px] text-amber-800">
                    {tModal("overrideReason")}
                  </Label>
                  <Input
                    id="overrideReason"
                    placeholder={tPlaceholders("overrideReason")}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="h-9 text-xs border-terminal-yellow"
                    wrapperClassName="!mb-0"
                  />
                  {formSubmitted && !overrideReason && (
                    <span className="text-[11px] text-destructive block">
                      {tCommon("required")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "tab-payment",
      label: tModal("tabPayment"),
      hasError: false,
      content: (
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between min-h-[20px] mb-1.5">
              <Label htmlFor="keyDeposit" className="text-xs font-medium">
                {tModal("keyDeposit")}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setKeyDeposit(DEFAULT_KEY_DEPOSIT)}
                className="text-[11px] text-body p-0 h-auto"
              >
                {tModal("autoKeyDeposit")}
              </Button>
            </div>
            <Input
              id="keyDeposit"
              value={keyDeposit}
              onChange={(e) => setKeyDeposit(e.target.value)}
              className="h-10 text-sm font-mono tabular-nums"
              wrapperClassName="!mb-0"
            />
          </div>
          <p className="text-xs text-body">
            {tTerms("DepositLedger")}: {tModal("depositLedgerNote")}
          </p>
        </div>
      ),
    },
    {
      id: "tab-documents",
      label: tModal("tabDocuments"),
      hasError: false,
      content: (
        <div className="space-y-4 py-2">
          <DeferredFilePicker
            queuedFiles={queuedFiles}
            onFilesSelected={stageFiles}
            onRemoveFile={removeFile}
            isUploading={isUploading}
            label={tModal("attachIdCardLabel")}
            helperText={tModal("attachIdCardHelper")}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{tModal("title")}</DialogTitle>
          </DialogHeader>

          <div className="py-2">
            <FormTabs
              tabs={tabs}
              value={activeTab}
              onValueChange={setActiveTab}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full px-5 text-xs"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleAttemptSubmit}
              disabled={isSubmitting || isUploading}
              className="rounded-full px-5 text-xs font-medium"
            >
              {isSubmitting || isUploading ? tCommon("loading") : tModal("completeCheckIn")} →
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Safety Confirmation Modal for Dirty Unit Override */}
      <ConfirmationModal
        isOpen={showOverrideConfirm}
        onClose={() => setShowOverrideConfirm(false)}
        onConfirm={executeCheckIn}
        title={tCommon("dialog.confirmOverrideDirtyTitle")}
        message={tCommon("dialog.confirmOverrideDirtyMessage")}
        confirmText={tCommon("confirm")}
        cancelText={tCommon("cancel")}
        variant="danger"
        isLoading={isSubmitting}
      />
    </>
  );
}
