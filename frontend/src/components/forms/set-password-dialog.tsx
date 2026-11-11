"use client";

import React, { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { PASSWORD_MIN_LENGTH, setPasswordSchema, type SetPasswordFormValues } from "@/lib/auth/password-policy";

export interface SetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actionText: string;
  confirmTitle: string;
  confirmMessage: string;
  /** When set, an identifier field is shown (portal account login) and is required. */
  identifierLabel?: string;
  identifierPlaceholder?: string;
  /** Return true when saved so the dialog closes; false keeps it open for retry. */
  onSubmit: (values: SetPasswordFormValues) => Promise<boolean>;
}

/**
 * Admin sets a password for someone else (reset password, portal account). The password is never prefilled,
 * never displayed back and is cleared as soon as the dialog closes.
 */
export function SetPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  actionText,
  confirmTitle,
  confirmMessage,
  identifierLabel,
  identifierPlaceholder,
  onSubmit,
}: SetPasswordDialogProps) {
  const t = useTranslations("auth.setPassword");
  const tCommon = useTranslations("common");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inFlight = useRef(false);
  const needsIdentifier = identifierLabel !== undefined;

  const form = useForm<SetPasswordFormValues>({ resolver: zodResolver(setPasswordSchema), defaultValues: { identifier: "", password: "" } });
  const errors = form.formState.errors;

  const close = () => {
    form.reset({ identifier: "", password: "" });
    setShowConfirm(false);
    onOpenChange(false);
  };

  const requestConfirm = form.handleSubmit((v) => {
    if (needsIdentifier && v.identifier === "") {
      form.setError("identifier", { type: "required" });
      return;
    }
    setShowConfirm(true);
  });

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      const ok = await onSubmit(form.getValues());
      if (ok) close();
    } finally {
      inFlight.current = false;
      setIsLoading(false);
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
          <form onSubmit={requestConfirm} className="space-y-4" noValidate>
            {needsIdentifier && (
              <FormField id="sp-identifier" label={identifierLabel} required error={errors.identifier ? t("errorIdentifier") : undefined}>
                <Input id="sp-identifier" autoComplete="off" placeholder={identifierPlaceholder} disabled={isLoading} className="h-10 rounded-full text-sm" {...form.register("identifier")} />
              </FormField>
            )}
            <FormField id="sp-password" label={t("password")} required helperText={t("hint", { min: PASSWORD_MIN_LENGTH })} error={errors.password ? t("errorPolicy", { min: PASSWORD_MIN_LENGTH }) : undefined}>
              <Input id="sp-password" type="password" autoComplete="new-password" placeholder={t("password")} disabled={isLoading} className="h-10 rounded-full text-sm" {...form.register("password")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} className="rounded-full">
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isLoading} className="rounded-full">
                {actionText}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmationModal isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={confirm} title={confirmTitle} message={confirmMessage} confirmText={actionText} variant="warning" isLoading={isLoading} />
    </>
  );
}
