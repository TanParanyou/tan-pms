"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, UserCheck, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/mono-spinner";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { FormField } from "@/components/forms/form-field";
import { ReasonDialog } from "@/components/forms/reason-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { DetailItem } from "@/components/shared/detail-item";
import { usePermission } from "@/hooks/use-permission";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useToast } from "@/hooks/use-toast";
import { CENTRAL_PROPERTIES } from "@/constants/master-data";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import {
  useAdminRoles,
  useAdminUserDetail,
  useUpsertAdminUserMutation,
  useDeactivateAdminUserMutation,
  useReactivateAdminUserMutation,
} from "../api/use-users";
import { upsertAdminUserSchema, type UpsertAdminUserFormValues } from "../schemas/user-schemas";
import { PERMISSION_USERS_MANAGE, PERMISSION_USERS_DEACTIVATE, PERMISSION_USERS_REACTIVATE, USER_FORM_DEFAULTS } from "../constants";
import type { AdminUserDto } from "../types";

export interface AdminUserEditorProps {
  userId: string;
}

/** Single dynamic route body: id="create" creates, any other id views / edits / (de)activates. */
export function AdminUserEditor({ userId }: AdminUserEditorProps) {
  const t = useTranslations("admin.rbac");
  const tCommon = useTranslations("common");
  const roles = useAdminRoles();
  const detail = useAdminUserDetail(userId);
  const isCreate = userId === "create";

  if (roles.isLoading || (!isCreate && detail.isLoading)) return <PageLoading message={t("loadingUser")} />;
  if (roles.isError || (!isCreate && detail.isError)) {
    return (
      <EmptyState
        title={t("loadUserError")}
        actionLabel={tCommon("retry")}
        onAction={() => {
          void roles.refetch();
          if (!isCreate) void detail.refetch();
        }}
      />
    );
  }
  if (!isCreate && !detail.data) return <EmptyState title={t("userNotFound")} />;
  return <UserBody user={detail.data} roles={roles.data?.roles ?? []} />;
}

interface UserBodyProps {
  user?: AdminUserDto;
  roles: NonNullable<ReturnType<typeof useAdminRoles>["data"]>["roles"];
}

function UserBody({ user, roles }: UserBodyProps) {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.rbac");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermission();
  const { toastSuccess, toastApiError } = useToast();
  const canManage = hasPermission(PERMISSION_USERS_MANAGE);
  const canDeactivate = hasPermission(PERMISSION_USERS_DEACTIVATE);
  const canReactivate = hasPermission(PERMISSION_USERS_REACTIVATE);
  const isEdit = user !== undefined;

  const upsert = useUpsertAdminUserMutation();
  const deactivate = useDeactivateAdminUserMutation();
  const reactivate = useReactivateAdminUserMutation();
  const inFlight = useRef(false);
  const isBusy = upsert.isPending || deactivate.isPending || reactivate.isPending;
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);

  const form = useForm<UpsertAdminUserFormValues>({
    resolver: zodResolver(upsertAdminUserSchema),
    values: user
      ? {
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          roleCode: user.roleCode,
          allowedPropertyIds: user.allowedProperties.map((p) => p.id),
          isActive: user.isActive,
        }
      : { ...USER_FORM_DEFAULTS, roleCode: roles[0]?.code ?? "" },
  });
  useUnsavedChanges(form.formState.isDirty);

  const execute = async () => {
    if (isBusy || inFlight.current) return;
    inFlight.current = true;
    const v = form.getValues();
    try {
      const saved = await upsert.mutateAsync({ id: user?.id, ...v });
      toastSuccess(t("saveSuccess"));
      form.reset(v);
      if (!isEdit) router.push(`/admin/users/${saved.id}`);
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setShowSaveConfirm(false);
    }
  };

  const handleDeactivate = async (reason: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await deactivate.mutateAsync({ id: user.id, reason });
      toastSuccess(t("toastDeactivated"));
      return true;
    } catch (err) {
      toastApiError(err);
      return false;
    }
  };

  const executeReactivate = async () => {
    if (!user || isBusy) return;
    try {
      await reactivate.mutateAsync(user.id);
      toastSuccess(t("toastReactivated"));
    } catch (err) {
      toastApiError(err);
    } finally {
      setShowReactivate(false);
    }
  };

  const selected = form.watch("allowedPropertyIds");
  const toggleProperty = (id: string, checked: boolean) =>
    form.setValue("allowedPropertyIds", checked ? [...selected, id] : selected.filter((p) => p !== id), { shouldDirty: true, shouldValidate: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title={user ? user.fullName : t("modalTitleAddUser")}
        description={user ? t("detailDescription") : t("modalDesc")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/users">
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span>{tCommon("back")}</span>
              </Button>
            </Link>
            {user && canDeactivate && user.isActive && (
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => setShowDeactivate(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <UserX className="h-4 w-4" />
                <span>{t("btnDeactivate")}</span>
              </Button>
            )}
            {user && canReactivate && !user.isActive && (
              <Button type="button" size="sm" disabled={isBusy} onClick={() => setShowReactivate(true)} className="h-9 gap-1.5 rounded-full px-4 text-xs">
                <UserCheck className="h-4 w-4" />
                <span>{t("btnReactivate")}</span>
              </Button>
            )}
          </div>
        }
      />

      {user && (
        <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label={t("fieldStatus")}>
            <Badge variant={user.isActive ? "success" : "outline"}>{user.isActive ? t("statusActive") : t("statusInactive")}</Badge>
          </DetailItem>
          <DetailItem label={t("fieldRole")}>{resolveLocalizedText(user.roleName, locale)}</DetailItem>
          <DetailItem label={t("allowedProperties")}>{user.allowedProperties.map((p) => p.code).join(", ") || "-"}</DetailItem>
          <DetailItem label={t("colPermissions")}>
            <span data-testid="user-permission-count">{user.permissions.length}</span>
          </DetailItem>
        </div>
      )}

      {canManage ? (
        <form
          onSubmit={form.handleSubmit(() => setShowSaveConfirm(true))}
          className="space-y-4 rounded-[12px] border border-hairline bg-canvas p-6 shadow-none"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="user-username" label={t("fieldUsername")} required error={form.formState.errors.username ? t("errorUsername") : undefined}>
              <Input id="user-username" placeholder={t("placeholderUsername")} disabled={isBusy} className="h-10 rounded-full text-sm" {...form.register("username")} />
            </FormField>
            <FormField id="user-fullname" label={t("fieldFullName")} required error={form.formState.errors.fullName ? t("errorFullName") : undefined}>
              <Input id="user-fullname" placeholder={t("placeholderFullName")} disabled={isBusy} className="h-10 rounded-full text-sm" {...form.register("fullName")} />
            </FormField>
            <FormField id="user-email" label={t("fieldEmail")} required error={form.formState.errors.email ? t("errorEmail") : undefined}>
              <Input id="user-email" placeholder={t("placeholderEmail")} disabled={isBusy} className="h-10 rounded-full text-sm" {...form.register("email")} />
            </FormField>
            <FormField id="user-role" label={t("fieldRole")} required error={form.formState.errors.roleCode ? t("errorRole") : undefined}>
              <SelectPill id="user-role" disabled={isBusy} wrapperClassName="!mb-0" {...form.register("roleCode")}>
                <option value="">{t("placeholderRole")}</option>
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {resolveLocalizedText(r.name, locale)}
                  </option>
                ))}
              </SelectPill>
            </FormField>
          </div>
          <FormField label={t("allowedProperties")} required error={form.formState.errors.allowedPropertyIds ? t("errorProperties") : undefined}>
            <Controller
              name="allowedPropertyIds"
              control={form.control}
              render={() => (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {CENTRAL_PROPERTIES.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5">
                      <Checkbox id={`prop-${p.id}`} checked={selected.includes(p.id)} disabled={isBusy} onCheckedChange={(c) => toggleProperty(p.id, c === true)} />
                      <Label htmlFor={`prop-${p.id}`} className="text-xs">
                        {resolveLocalizedText(p.name, locale)} ({p.code})
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            />
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={isBusy} className="h-10 rounded-full px-5 text-xs">
              {isBusy ? tCommon("loading") : t("saveUser")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-mute">{t("readOnlyHint")}</p>
      )}

      <ConfirmationModal
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={execute}
        title={t("confirmHighRiskTitle")}
        message={t("confirmHighRiskMessage")}
        confirmText={tCommon("save")}
        variant="warning"
        isLoading={upsert.isPending}
      />
      <ConfirmationModal
        isOpen={showReactivate}
        onClose={() => setShowReactivate(false)}
        onConfirm={executeReactivate}
        title={t("confirmReactivateTitle")}
        message={t("confirmReactivateMessage")}
        confirmText={t("btnReactivate")}
        variant="info"
        isLoading={reactivate.isPending}
      />
      {user && (
        <ReasonDialog
          open={showDeactivate}
          onOpenChange={setShowDeactivate}
          title={t("deactivateTitle")}
          description={t("deactivateDescription")}
          actionText={t("btnDeactivate")}
          confirmTitle={t("confirmDeactivateTitle")}
          confirmMessage={t("confirmDeactivateMessage", { name: user.fullName })}
          isLoading={deactivate.isPending}
          onConfirm={handleDeactivate}
        />
      )}
    </div>
  );
}
