"use client";

import * as React from "react";
import { Button } from "./button";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ConfirmationVariant = "danger" | "warning" | "info" | "success";

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = "danger",
  isLoading = false,
}: ConfirmationModalProps) {
  const t = useTranslations("common");

  if (!isOpen) return null;

  const resolvedTitle = title || t("dialog.confirmTitle");
  const resolvedConfirmText = confirmText || t("confirm");
  const resolvedCancelText = cancelText || t("cancel");

  const variantButtonStyles: Record<ConfirmationVariant, "destructive" | "default"> = {
    danger: "destructive",
    warning: "default",
    info: "default",
    success: "default",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-md rounded-[12px] border border-hairline bg-canvas p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <h3
            id="confirmation-modal-title"
            className="text-base font-semibold font-rounded text-ink"
          >
            {resolvedTitle}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isLoading}
            title={t("close")}
            aria-label={t("close")}
            className="h-8 w-8 rounded-full text-body hover:text-ink"
          >
            ✕
          </Button>
        </div>

        <div className="py-4 text-sm text-charcoal leading-relaxed">
          {message}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-full px-5 text-xs"
          >
            {resolvedCancelText}
          </Button>
          <Button
            type="button"
            variant={variantButtonStyles[variant]}
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              "rounded-full px-5 text-xs font-medium",
              isLoading && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoading ? t("loading") : resolvedConfirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
