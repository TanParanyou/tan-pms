"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { usePermission } from "@/hooks/use-permission";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { useAdminUsers, useAdminRoles } from "../api/use-users";
import { ALL_ROLES_FILTER, PERMISSION_USERS_MANAGE, USER_STATUS_FILTERS, type UserStatusFilter } from "../constants";
import type { AdminUserDto } from "../types";

export function AdminRbacUsersSection() {
  const router = useRouter();
  const locale = useLocale() as "th" | "en";
  const t = useTranslations("admin.rbac");
  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSION_USERS_MANAGE);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState(ALL_ROLES_FILTER);
  const [status, setStatus] = useState<UserStatusFilter>("All");
  const debounced = useDebouncedValue(search.trim().toLowerCase(), 200);

  const users = useAdminUsers();
  const roles = useAdminRoles();

  const items = useMemo(
    () =>
      (users.data?.items ?? []).filter((u) => {
        if (role !== ALL_ROLES_FILTER && u.roleCode !== role) return false;
        if (status === "Active" && !u.isActive) return false;
        if (status === "Inactive" && u.isActive) return false;
        if (!debounced) return true;
        return [u.username, u.fullName, u.email].some((v) => v.toLowerCase().includes(debounced));
      }),
    [users.data, role, status, debounced]
  );

  const columns: ColumnDef<AdminUserDto>[] = [
    {
      id: "user",
      header: t("colUser"),
      cell: (u) => (
        <div className="space-y-0.5">
          <div className="text-sm font-medium text-ink">{u.fullName}</div>
          <div className="font-mono text-[11px] text-mute">
            {u.username} - {u.email}
          </div>
        </div>
      ),
    },
    { id: "role", header: t("colRole"), cell: (u) => <span className="text-xs">{resolveLocalizedText(u.roleName, locale)}</span> },
    {
      id: "properties",
      header: t("colProperties"),
      cell: (u) => (
        <span className="text-xs">
          {u.allowedProperties.map((p) => p.code).join(", ") || "-"}
        </span>
      ),
    },
    { id: "permissions", header: t("colPermissions"), align: "right", cell: (u) => <span className="font-mono text-xs tabular-nums">{u.permissions.length}</span> },
    {
      id: "status",
      header: t("colStatus"),
      cell: (u) => <Badge variant={u.isActive ? "success" : "outline"}>{u.isActive ? t("statusActive") : t("statusInactive")}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canManage ? (
            <Button type="button" size="sm" onClick={() => router.push("/admin/users/create")} className="h-9 gap-1.5 rounded-full px-4 text-xs">
              <UserPlus className="h-4 w-4" />
              <span>{t("addUser")}</span>
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-3 rounded-[12px] border border-hairline bg-canvas p-4 shadow-none sm:grid-cols-3">
        <Input
          aria-label={t("searchPlaceholder")}
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="!mb-0"
          className="h-10 rounded-full text-sm"
        />
        <SelectPill aria-label={t("colRole")} value={role} onChange={(e) => setRole(e.target.value)} wrapperClassName="!mb-0">
          <option value={ALL_ROLES_FILTER}>{t("filterRoleAll")}</option>
          {(roles.data?.roles ?? []).map((r) => (
            <option key={r.code} value={r.code}>
              {resolveLocalizedText(r.name, locale)}
            </option>
          ))}
        </SelectPill>
        <SelectPill aria-label={t("colStatus")} value={status} onChange={(e) => setStatus(e.target.value as UserStatusFilter)} wrapperClassName="!mb-0">
          {USER_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {t(`filterStatus${s}`)}
            </option>
          ))}
        </SelectPill>
      </div>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(u) => u.id}
        isLoading={users.isLoading}
        isError={users.isError}
        errorMessage={t("loadError")}
        onRetry={() => void users.refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDesc")}
        onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
      />
    </div>
  );
}
