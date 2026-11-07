import { useCallback } from "react";
import { useLocale } from "next-intl";
import { ApiError } from "@/lib/api/api-error";
import { getLocalizedErrorMessage } from "@/lib/problem-details";
import {
  dispatchToast,
  dismissToast,
  clearAllToasts,
  type ToastVariant,
} from "@/components/ui/toast";

export function useToast() {
  let locale: "th" | "en" = "th";
  try {
    const l = useLocale();
    if (l === "en" || l === "th") {
      locale = l;
    }
  } catch {
    locale = "th";
  }

  const toast = useCallback(
    (options: {
      message: string;
      title?: string;
      variant?: ToastVariant;
      duration?: number;
    }) => {
      return dispatchToast(options);
    },
    []
  );

  const toastSuccess = useCallback(
    (message: string, title?: string) => {
      return dispatchToast({
        message,
        title,
        variant: "success",
      });
    },
    []
  );

  const toastError = useCallback(
    (message: string, title?: string) => {
      return dispatchToast({
        message,
        title,
        variant: "error",
      });
    },
    []
  );

  const toastApiError = useCallback(
    (err: unknown, fallbackMessage?: string) => {
      let resolvedMessage = fallbackMessage;

      if (err instanceof ApiError) {
        resolvedMessage = getLocalizedErrorMessage(err.errorCode, locale);
        if (resolvedMessage === "errors.generic" && err.message) {
          resolvedMessage = err.message;
        }
      } else if (err instanceof Error) {
        resolvedMessage = err.message;
      }

      return dispatchToast({
        message: resolvedMessage || "An error occurred",
        variant: "error",
      });
    },
    [locale]
  );

  return {
    toast,
    toastSuccess,
    toastError,
    toastApiError,
    dismissToast,
    clearAllToasts,
  };
}
