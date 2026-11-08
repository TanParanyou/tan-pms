"use client";

import React, { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationModal, type ConfirmationVariant } from "@/components/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

export const REASON_MIN_LENGTH = 3;

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Label of the primary action and of the confirmation button. */
  actionText: string;
  confirmTitle: string;
  confirmMessage: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
  /** When false the reason is optional (still sent trimmed, empty becomes undefined). */
  reasonRequired?: boolean;
  /** Return true when the action succeeded so the dialog closes; false keeps it open for retry. */
  onConfirm: (reason: string) => Promise<boolean>;
}

/**
 * Cancel/void flow shared by every module: collect a reason, then require an explicit
 * ConfirmationModal before the mutation fires. Dialog stays open on failure.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  actionText,
  confirmTitle,
  confirmMessage,
  variant = "danger",
  isLoading = false,
  reasonRequired = true,
  onConfirm,
}: ReasonDialogProps) {
  const t = useTranslations("common.reasonDialog");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState("");
  const [showError, setShowError] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inFlight = useRef(false);

  useUnsavedChanges(open && reason.length > 0);

  const trimmed = reason.trim();
  const isValid = !reasonRequired || trimmed.length >= REASON_MIN_LENGTH;

  const close = () => {
    setReason("");
    setShowError(false);
    setShowConfirm(false);
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (isLoading) return;
    if (!isValid) {
      setShowError(true);
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (isLoading || inFlight.current) return;
    inFlight.current = true;
    try {
      const ok = await onConfirm(trimmed);
      if (ok) close();
    } finally {
      inFlight.current = false;
      setShowConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <FormField
            id="reason-dialog-input"
            label={t("label")}
            required={reasonRequired}
            error={showError && !isValid ? t("errorRequired") : undefined}
          >
            <Textarea
              id="reason-dialog-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("placeholder")}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} className="rounded-full">
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant={variant === "danger" ? "destructive" : "default"}
              disabled={isLoading}
              onClick={handleSubmit}
              className="rounded-full"
            >
              {actionText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={actionText}
        variant={variant}
        isLoading={isLoading}
      />
    </>
  );
}
