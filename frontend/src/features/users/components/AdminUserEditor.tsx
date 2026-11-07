"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { Switch } from "@/components/ui/switch";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { FormField } from "@/components/forms/form-field";
import { FormSection } from "@/components/forms/form-section";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { useFormTabErrors } from "@/hooks/use-form-tab-errors";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { CENTRAL_PROPERTIES } from "@/constants/master-data";
import {
  useAdminRoles,
  useAdminUserDetail,
  useUpsertAdminUserMutation,
} from "../api/use-users";
import {
  upsertAdminUserSchema,
  type UpsertAdminUserFormValues,
} from "../schemas/user-schemas";
import type { RoleDefinitionDto } from "../types";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export interface AdminUserEditorProps {
  userId: string;
}

export function AdminUserEditor({ userId }: AdminUserEditorProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const tUsers = useTranslations("admin.rbac");
  const tCommon = useTranslations("common");

  const isCreate = userId === "create";

  const { data: roleCatalog, isLoading: isRolesLoading } = useAdminRoles();
  const { data: userDetail, isLoading: isUserLoading } = useAdminUserDetail(userId);
  const upsertMutation = useUpsertAdminUserMutation();

  const [activeTab, setActiveTab] = useState("tab-account");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const roles: RoleDefinitionDto[] = (roleCatalog?.roles ?? []) as RoleDefinitionDto[];

  const form = useForm<UpsertAdminUserFormValues>({
    resolver: zodResolver(upsertAdminUserSchema),
    defaultValues: {
      username: userDetail?.username ?? "",
      fullName: userDetail?.fullName ?? "",
      email: userDetail?.email ?? "",
      roleCode: userDetail?.roleCode ?? roles[0]?.code ?? "FrontDeskCashier",
      isActive: userDetail?.isActive ?? true,
    },
  });

  useUnsavedChanges(form.formState.isDirty);
  const { toastSuccess, toastApiError } = useToast();

  const fieldToTabMap = {
    username: "tab-account",
    fullName: "tab-account",
    email: "tab-account",
    roleCode: "tab-role",
  };

  const { hasTabError, firstErrorTab } = useFormTabErrors({
    fieldToTabMap,
    errors: form.formState.errors,
  });

  if (!isCreate && (isRolesLoading || isUserLoading)) {
    return <PageLoading message={tUsers("loadingUser")} />;
  }

  const handleValidSubmit = () => {
    setShowConfirmModal(true);
  };

  const executeUpsert = async () => {
    try {
      const values = form.getValues();
      await upsertMutation.mutateAsync({
        id: isCreate ? undefined : userId,
        username: values.username,
        fullName: values.fullName,
        email: values.email,
        roleCode: values.roleCode,
        isActive: values.isActive,
        allowedPropertyIds: CENTRAL_PROPERTIES.map((p) => p.id),
      });
      toastSuccess(tUsers("saveSuccess"));
      setShowConfirmModal(false);
      router.push("/admin/users");
    } catch (err) {
      toastApiError(err);
    }
  };

  const tabs: FormTabItem[] = [
    {
      id: "tab-account",
      label: tUsers("tabAccount"),
      hasError: hasTabError("tab-account"),
      content: (
        <div className="space-y-4 pt-2">
          <FormSection
            title={tUsers("modalTitleAddUser")}
            description={tUsers("modalDesc")}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                id="user-username-input"
                label={tUsers("fieldUsername")}
                required
                error={form.formState.errors.username?.message}
              >
                <Controller
                  name="username"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="user-username-input"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={tUsers("placeholderUsername")}
                      className="h-10 rounded-full font-mono text-xs"
                      disabled={!isCreate}
                    />
                  )}
                />
              </FormField>

              <FormField
                id="user-fullname-input"
                label={tUsers("fieldFullName")}
                required
                error={form.formState.errors.fullName?.message}
              >
                <Controller
                  name="fullName"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="user-fullname-input"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={tCommon("placeholders.guestName")}
                      className="h-10 rounded-full text-xs"
                    />
                  )}
                />
              </FormField>

              <FormField
                id="user-email-input"
                label={tUsers("fieldEmail")}
                required
                error={form.formState.errors.email?.message}
              >
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="user-email-input"
                      type="email"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={tUsers("placeholderEmail")}
                      className="h-10 rounded-full font-mono text-xs"
                    />
                  )}
                />
              </FormField>
            </div>
          </FormSection>
        </div>
      ),
    },
    {
      id: "tab-role",
      label: tUsers("tabRole"),
      hasError: hasTabError("tab-role"),
      content: (
        <div className="space-y-4 pt-2">
          <FormField
            id="role-select"
            label={tUsers("fieldRole")}
            required
            error={form.formState.errors.roleCode?.message}
          >
            <Controller
              name="roleCode"
              control={form.control}
              render={({ field }) => (
                <SelectPill
                  id="role-select"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="h-10 text-xs font-mono"
                >
                  {roles.map((r: RoleDefinitionDto) => (
                    <option key={r.code} value={r.code}>
                      {resolveLocalizedText(r.name, locale)} ({r.code})
                    </option>
                  ))}
                </SelectPill>
              )}
            />
          </FormField>

          <div className="flex items-center justify-between p-3 rounded-[12px] border border-hairline bg-surface-soft">
            <div className="space-y-0.5">
              <Label htmlFor="user-active-switch" className="text-xs font-medium text-ink">
                {tUsers("fieldStatus")}
              </Label>
              <p className="text-[11px] text-body">
                {form.watch("isActive") ? tUsers("statusActive") : tUsers("statusInactive")}
              </p>
            </div>
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <Switch
                  id="user-active-switch"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label={tUsers("fieldStatus")}
                />
              )}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        prefixCode="USR"
        title={isCreate ? tUsers("modalTitleAddUser") : tUsers("modalTitleEditUser")}
        description={tUsers("description")}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/users">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-xs font-mono h-9 px-4 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>

            <Button
              type="button"
              size="sm"
              onClick={form.handleSubmit(handleValidSubmit, () => {
                if (firstErrorTab) setActiveTab(firstErrorTab);
              })}
              disabled={upsertMutation.isPending}
              className="rounded-full text-xs h-9 px-5 gap-1.5"
            >
              <Save className="h-4 w-4" />
              <span>{tCommon("save")}</span>
            </Button>
          </div>
        }
      />

      <div className="rounded-[12px] border border-hairline bg-canvas p-6 shadow-sm">
        <FormTabs
          tabs={tabs}
          value={activeTab}
          onValueChange={setActiveTab}
        />
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={executeUpsert}
        title={tUsers("confirmSaveTitle")}
        message={tUsers("confirmSaveMessage")}
        confirmText={tCommon("confirm")}
        cancelText={tCommon("cancel")}
        isLoading={upsertMutation.isPending}
      />
    </div>
  );
}
