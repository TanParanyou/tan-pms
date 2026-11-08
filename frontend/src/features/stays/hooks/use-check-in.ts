"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { isShiftNotOpenError } from "@/components/shared/shift-not-open-alert";
import type { CheckInStayRequest, StaySummaryDto } from "@/generated/api";
import { useCheckInStayMutation } from "../api/use-stays";

/** Shared real check-in call for the check-in page and the rack quick walk-in: double-submit guard, toasts, shift.not_open flag. */
export function useCheckInSubmit() {
  const t = useTranslations("admin.stays");
  const { toastSuccess, toastApiError } = useToast();
  const mutation = useCheckInStayMutation();
  const inFlight = useRef(false);
  const [shiftNotOpen, setShiftNotOpen] = useState(false);

  const submit = async (req: CheckInStayRequest): Promise<StaySummaryDto | null> => {
    if (inFlight.current || mutation.isPending) return null;
    inFlight.current = true;
    try {
      const stay = await mutation.mutateAsync(req);
      setShiftNotOpen(false);
      toastSuccess(t("toastCheckedIn", { document: stay.documentNumber }));
      return stay;
    } catch (err) {
      setShiftNotOpen(isShiftNotOpenError(err));
      toastApiError(err);
      return null;
    } finally {
      inFlight.current = false;
    }
  };

  return { submit, isPending: mutation.isPending, shiftNotOpen };
}
