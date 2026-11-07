"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { SelectPill } from "@/components/ui/select-pill";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useDataTableState } from "@/hooks/use-data-table-state";
import { ListToolbar } from "@/components/layout/list-toolbar";
import { BulkActionToolbar } from "@/components/layout/bulk-action-toolbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FormTabs, type FormTabItem } from "@/components/ui/form-tabs";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations, useLocale } from "next-intl";
import { resolveLocalizedText } from "@/lib/i18n/localized-text";
import { UserCog, UserPlus } from "lucide-react";
import { CENTRAL_PROPERTIES } from "@/constants/master-data";
import {
  ROLE_CATALOG_PROJECTION,
  ROLE_CATALOG_MAP,
  INITIAL_ADMIN_USERS,
} from "../constants";
import type { AdminUserDto, PropertyRefDto } from "../types";

export interface AdminRbacUsersSectionProps {
  initialUsers?: AdminUserDto[];
  isLoading?: boolean;
}

export function AdminRbacUsersSection({
  initialUsers = INITIAL_ADMIN_USERS,
  isLoading = false,
}: AdminRbacUsersSectionProps) {
  const locale = useLocale() as "th" | "en";
  const tRbac = useTranslations("admin.rbac");
  const tCommon = useTranslations("common");

  const [users, setUsers] = useState<AdminUserDto[]>(initialUsers);
  // Filters & Table State
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    selectedIds: selectedRowIds,
    setSelectedIds: setSelectedRowIds,
  } = useDataTableState<{ role: string }>({
    initialFilters: { role: "All" },
    debounceMs: 0,
  });
  const selectedRoleFilter = filters.role;
  const setSelectedRoleFilter = (v: string) => setFilter("role", v);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form Fields
  const [formFullName, setFormFullName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRoleCode, setFormRoleCode] = useState<string>(
    ROLE_CATALOG_PROJECTION[0].code
  );
  const [formIsActive, setFormIsActive] = useState(true);
  const [formAllowedPropertyIds, setFormAllowedPropertyIds] = useState<string[]>([
    CENTRAL_PROPERTIES[0].id,
  ]);
  const [activeTab, setActiveTab] = useState("tab-profile");

  // Confirmation Modal State (High-Risk RBAC change)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Users (Search + Role Filter)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole =
        selectedRoleFilter === "All" || u.roleCode === selectedRoleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, selectedRoleFilter, searchQuery]);

  const handleOpenCreate = () => {
    setEditingUserId(null);
    setFormFullName("");
    setFormUsername("");
    setFormEmail("");
    setFormRoleCode(ROLE_CATALOG_PROJECTION[0].code);
    setFormIsActive(true);
    setFormAllowedPropertyIds([CENTRAL_PROPERTIES[0].id]);
    setActiveTab("tab-profile");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: AdminUserDto) => {
    setEditingUserId(user.id);
    setFormFullName(user.fullName);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormRoleCode(user.roleCode);
    setFormIsActive(user.isActive);
    setFormAllowedPropertyIds(user.allowedProperties.map((p) => p.id));
    setActiveTab("tab-profile");
    setIsModalOpen(true);
  };

  const handleToggleProperty = (propId: string) => {
    setFormAllowedPropertyIds((prev) =>
      prev.includes(propId)
        ? prev.length > 1
          ? prev.filter((id) => id !== propId)
          : prev
        : [...prev, propId]
    );
  };

  const handleTriggerSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim() || !formUsername.trim()) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setIsSubmitting(true);
    try {
      const selectedRole =
        ROLE_CATALOG_MAP[formRoleCode] ?? ROLE_CATALOG_PROJECTION[0];

      const resolvedProperties: PropertyRefDto[] = CENTRAL_PROPERTIES.filter((p) =>
        formAllowedPropertyIds.includes(p.id)
      ).map((p) => ({
        id: p.id,
        code: p.code,
        name: { ...p.name },
      }));

      if (editingUserId) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUserId
              ? {
                  ...u,
                  fullName: formFullName,
                  username: formUsername,
                  email: formEmail,
                  roleCode: selectedRole.code,
                  roleName: selectedRole.name,
                  isActive: formIsActive,
                  allowedProperties: resolvedProperties,
                  permissions: selectedRole.defaultPermissions,
                }
              : u
          )
        );
      } else {
        const newUser: AdminUserDto = {
          id: `usr-${Date.now()}`,
          fullName: formFullName,
          username: formUsername,
          email: formEmail,
          roleCode: selectedRole.code,
          roleName: selectedRole.name,
          isActive: formIsActive,
          allowedProperties: resolvedProperties,
          permissions: selectedRole.defaultPermissions,
        };
        setUsers((prev) => [newUser, ...prev]);
      }

      setIsConfirmOpen(false);
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: ColumnDef<AdminUserDto>[] = [
    {
      id: "user",
      header: tRbac("colUser"),
      headerClassName: "w-[240px]",
      sortable: true,
      sortValue: (row) => row.fullName,
      cell: (row) => (
        <div>
          <span className="font-medium text-ink block">{row.fullName}</span>
          <span className="text-[11px] font-mono text-body">{row.username}</span>
        </div>
      ),
    },
    {
      id: "role",
      header: tRbac("colRole"),
      headerClassName: "w-[200px]",
      cell: (row) => (
        <div className="space-y-1">
          <span className="text-xs font-medium text-ink block">
            {resolveLocalizedText(row.roleName, locale)}
          </span>
          <CommandTag className="text-[10px]">{row.roleCode}</CommandTag>
        </div>
      ),
    },
    {
      id: "properties",
      header: tRbac("colProperties"),
      headerClassName: "w-[240px]",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.allowedProperties.map((p) => (
            <Badge key={p.id} variant="outline" className="text-[10px] font-mono">
              {p.code} — {resolveLocalizedText(p.name, locale)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "permissions",
      header: tRbac("colPermissions"),
      headerClassName: "w-[120px]",
      cell: (row) => (
        <Badge variant="mono" className="text-[11px] tabular-nums">
          {row.permissions.length} {tRbac("permissionsCount")}
        </Badge>
      ),
    },
    {
      id: "status",
      header: tRbac("colStatus"),
      headerClassName: "w-[110px]",
      cell: (row) => (
        <Badge variant={row.isActive ? "success" : "secondary"}>
          {row.isActive ? tRbac("statusActive") : tRbac("statusInactive")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{tRbac("colActions")}</span>,
      headerClassName: "w-[80px] text-right",
      className: "text-right",
      cell: (row) => (
        <div className="flex items-center justify-end">
          <Tooltip content={tRbac("editUser")} position="top">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleOpenEdit(row)}
              aria-label={tRbac("editUser")}
              className="rounded-full h-7 w-7 text-xs text-ink hover:bg-surface-soft"
            >
              <UserCog className="h-3.5 w-3.5" />
              <span className="sr-only">{tRbac("editUser")}</span>
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const modalTabs: FormTabItem[] = [
    {
      id: "tab-profile",
      label: tRbac("tabProfile"),
      content: (
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="user-fullname" className="text-xs font-medium text-ink">
              {tRbac("fieldFullName")}
            </Label>
            <Input
              id="user-fullname"
              value={formFullName}
              onChange={(e) => setFormFullName(e.target.value)}
              placeholder={tRbac("fieldFullName")}
              required
              className="h-10 text-xs"
              wrapperClassName="!mb-0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="user-username" className="text-xs font-medium text-ink">
                {tRbac("fieldUsername")}
              </Label>
              <Input
                id="user-username"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder={tRbac("fieldUsername")}
                required
                className="h-10 text-xs font-mono"
                wrapperClassName="!mb-0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-email" className="text-xs font-medium text-ink">
                {tRbac("fieldEmail")}
              </Label>
              <Input
                id="user-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder={tRbac("fieldEmail")}
                className="h-10 text-xs font-mono"
                wrapperClassName="!mb-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="user-role" className="text-xs font-medium text-ink">
                {tRbac("fieldRole")}
              </Label>
              <SelectPill
                id="user-role"
                value={formRoleCode}
                onChange={(e) => setFormRoleCode(e.target.value)}
                className="h-10 text-xs"
              >
                {ROLE_CATALOG_PROJECTION.map((r) => (
                  <option key={r.code} value={r.code}>
                    {resolveLocalizedText(r.name, locale)} ({r.code})
                  </option>
                ))}
              </SelectPill>
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-status" className="text-xs font-medium text-ink">
                {tRbac("fieldStatus")}
              </Label>
              <SelectPill
                id="user-status"
                value={formIsActive ? "active" : "inactive"}
                onChange={(e) => setFormIsActive(e.target.value === "active")}
                className="h-10 text-xs"
              >
                <option value="active">{tRbac("statusActive")}</option>
                <option value="inactive">{tRbac("statusInactive")}</option>
              </SelectPill>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tab-scope",
      label: tRbac("tabScope"),
      content: (
        <div className="space-y-3 py-2">
          <p className="text-xs text-body">{tRbac("modalDesc")}</p>
          <div className="space-y-2">
            {CENTRAL_PROPERTIES.map((prop) => {
              const isChecked = formAllowedPropertyIds.includes(prop.id);
              return (
                <div
                  key={prop.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-hairline bg-surface-soft"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-ink block font-mono">
                      {prop.code}
                    </span>
                    <span className="text-xs text-body">
                      {resolveLocalizedText(prop.name, locale)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={isChecked ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleProperty(prop.id)}
                    className="rounded-full h-8 px-4 text-xs"
                  >
                    {isChecked ? tCommon("confirm") : tCommon("filter")}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4" aria-label="Admin User RBAC Management">
      {/* Header and Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-rounded font-medium text-ink">
            {tRbac("title")}
          </h2>
          <p className="text-xs text-body">{tRbac("description")}</p>
        </div>
        <Button
          type="button"
          onClick={handleOpenCreate}
          size="sm"
          className="rounded-full shadow-none gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>{tRbac("addUser")}</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={tRbac("searchPlaceholder")}
        filters={
          <div className="w-full sm:w-60">
            <SelectPill
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="rounded-full h-10 text-xs bg-canvas"
            >
              <option value="All">{tRbac("filterRoleAll")}</option>
              {ROLE_CATALOG_PROJECTION.map((r) => (
                <option key={r.code} value={r.code}>
                  {resolveLocalizedText(r.name, locale)}
                </option>
              ))}
            </SelectPill>
          </div>
        }
      />

      {/* Users DataTable (Table-Preserved Architecture) */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        isLoading={isLoading}
        getRowId={(row) => row.id}
        enableRowSelection
        selectedRowIds={selectedRowIds}
        onSelectionChange={setSelectedRowIds}
        enablePagination
        pageSize={20}
        emptyTitle={tRbac("emptyTitle")}
        emptyDescription={tRbac("emptyDesc")}
      />

      <BulkActionToolbar
        selectedCount={selectedRowIds.length}
        onClearSelection={() => setSelectedRowIds([])}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7 text-canvas border-canvas/40 hover:bg-canvas/20"
            onClick={() => setSelectedRowIds([])}
          >
            {tCommon("actions")}
          </Button>
        }
      />

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingUserId ? tRbac("modalTitleEdit") : tRbac("modalTitleCreate")}
            </DialogTitle>
            <DialogDescription>{tRbac("modalDesc")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTriggerSave} className="space-y-4 pt-2">
            <FormTabs
              tabs={modalTabs}
              value={activeTab}
              onValueChange={setActiveTab}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full h-9 text-xs"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-full h-9 text-xs"
              >
                {tCommon("save")} →
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* High-Risk Action Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={tRbac("confirmHighRiskTitle")}
        message={tRbac("confirmHighRiskMessage")}
        confirmText={tCommon("confirm")}
        cancelText={tCommon("cancel")}
        variant="warning"
        isLoading={isSubmitting}
      />
    </section>
  );
}
