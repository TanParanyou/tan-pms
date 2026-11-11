"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api/api-client";
import { buildLoginUrl } from "@/lib/auth/return-to";
import { changePasswordSchema, PASSWORD_MIN_LENGTH, type ChangePasswordFormValues } from "@/lib/auth/password-policy";
import { clearSession, getAuthState } from "@/lib/auth/session-store";

export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY: ChangePasswordFormValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

/**
 * Self-service password change shared by admin and client. The backend revokes every session on success,
 * so the dialog explains that and the only way forward is back to the matching login.
 */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const t = useTranslations("auth.changePassword");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toastApiError } = useToast();
  const [isDone, setIsDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);
  const scopeRef = useRef(getAuthState().profile?.scope ?? "admin");

  const form = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });
  const errors = form.formState.errors;

  const finish = () => {
    clearSession();
    queryClient.clear();
    onOpenChange(false);
    router.push(buildLoginUrl(scopeRef.current));
  };

  const submit = form.handleSubmit(async (v) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    try {
      await apiClient.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      form.reset(EMPTY);
      setIsDone(true);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  });

  const handleOpenChange = (next: boolean) => {
    if (isDone) {
      finish();
      return;
    }
    if (!next) form.reset(EMPTY);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{isDone ? t("doneDescription") : t("description", { min: PASSWORD_MIN_LENGTH })}</DialogDescription>
        </DialogHeader>
        {isDone ? (
          <>
            <Alert variant="success">{t("doneMessage")}</Alert>
            <DialogFooter>
              <Button type="button" onClick={finish} className="rounded-full">
                {t("goToLogin")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField id="cp-current" label={t("current")} required error={errors.currentPassword ? t("errorCurrent") : undefined}>
              <Input id="cp-current" type="password" autoComplete="current-password" placeholder={t("current")} disabled={isSubmitting} className="h-10 rounded-full text-sm" {...form.register("currentPassword")} />
            </FormField>
            <FormField id="cp-new" label={t("new")} required helperText={t("hint", { min: PASSWORD_MIN_LENGTH })} error={errors.newPassword ? t("errorPolicy", { min: PASSWORD_MIN_LENGTH }) : undefined}>
              <Input id="cp-new" type="password" autoComplete="new-password" placeholder={t("new")} disabled={isSubmitting} className="h-10 rounded-full text-sm" {...form.register("newPassword")} />
            </FormField>
            <FormField id="cp-confirm" label={t("confirm")} required error={errors.confirmPassword ? t("errorMismatch") : undefined}>
              <Input id="cp-confirm" type="password" autoComplete="new-password" placeholder={t("confirm")} disabled={isSubmitting} className="h-10 rounded-full text-sm" {...form.register("confirmPassword")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleOpenChange(false)} className="rounded-full">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-full">
                {isSubmitting ? tCommon("loading") : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
