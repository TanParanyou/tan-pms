"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/api-error";

export const SHIFT_NOT_OPEN_CODE = "shift.not_open";

export function isShiftNotOpenError(err: unknown): boolean {
  return err instanceof ApiError && err.errorCode === SHIFT_NOT_OPEN_CODE;
}

/** Shown when the backend rejects a cash movement because the cashier has no open shift. */
export function ShiftNotOpenAlert() {
  const t = useTranslations("common.shiftNotOpen");
  return (
    <Alert variant="warning" title={t("title")} data-testid="shift-not-open-alert">
      <span>{t("message")} </span>
      <Link href="/admin/cashier" className="font-medium underline">
        {t("link")}
      </Link>
    </Alert>
  );
}
