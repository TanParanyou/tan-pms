"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetPasswordDialog } from "@/components/forms/set-password-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { apiClient } from "@/lib/api/api-client";
import { PERMISSION_STAY_CHECKIN } from "@/features/stays/constants";
import { PERMISSION_LEASES_MANAGE } from "../constants";

export interface CustomerPortalAccountButtonProps {
  customerId: string;
}

/** Creates or updates the customer's client-portal login (POST /admin/customers/{id}/account). */
export function CustomerPortalAccountButton({ customerId }: CustomerPortalAccountButtonProps) {
  const t = useTranslations("auth.portalAccount");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const [open, setOpen] = useState(false);

  if (!hasPermission(PERMISSION_LEASES_MANAGE) && !hasPermission(PERMISSION_STAY_CHECKIN)) return null;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="mt-1 h-8 gap-1.5 rounded-full px-3 text-xs">
        <UserPlus className="h-3.5 w-3.5" />
        <span>{t("button")}</span>
      </Button>
      <SetPasswordDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description")}
        actionText={t("action")}
        confirmTitle={t("confirmTitle")}
        confirmMessage={t("confirmMessage")}
        identifierLabel={t("identifier")}
        identifierPlaceholder={t("identifierPlaceholder")}
        onSubmit={async (v) => {
          try {
            await apiClient.upsertCustomerAccount(customerId, { loginIdentifier: v.identifier, initialPassword: v.password });
            toastSuccess(t("success"));
            return true;
          } catch (err) {
            toastApiError(err);
            return false;
          }
        }}
      />
    </>
  );
}
