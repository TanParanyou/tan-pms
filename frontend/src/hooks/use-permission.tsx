"use client";

import React, { createContext, useContext, useMemo } from "react";
import { CENTRAL_PROPERTIES } from "@/constants/master-data";

export interface PermissionContextValue {
  permissions: readonly string[];
  roleCode: string;
  allowedPropertyIds: readonly string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasPropertyAccess: (propertyId: string) => boolean;
}

const DEFAULT_ADMIN_PERMISSIONS: readonly string[] = [
  "*",
  "admin.users.manage",
  "admin.users.view",
  "admin.roles.view",
  "admin.properties.all",
  "admin.properties.scoped",
  "admin.financial.all",
  "admin.financial.approve",
  "admin.operations.all",
];

const DEFAULT_ALLOWED_PROPERTIES: readonly string[] = CENTRAL_PROPERTIES.map((p) => p.id);

const PermissionContext = createContext<PermissionContextValue | null>(null);

export interface PermissionProviderProps {
  children: React.ReactNode;
  roleCode?: string;
  permissions?: readonly string[];
  allowedPropertyIds?: readonly string[];
}

export function PermissionProvider({
  children,
  roleCode = "OrganizationAdmin",
  permissions = DEFAULT_ADMIN_PERMISSIONS,
  allowedPropertyIds = DEFAULT_ALLOWED_PROPERTIES,
}: PermissionProviderProps) {
  const value = useMemo<PermissionContextValue>(() => {
    const hasPermission = (permission: string) => {
      if (permissions.includes("*")) return true;
      return permissions.includes(permission);
    };

    const hasAnyPermission = (required: string[]) => {
      if (permissions.includes("*")) return true;
      return required.some((req) => permissions.includes(req));
    };

    const hasPropertyAccess = (propertyId: string) => {
      if (permissions.includes("*") || permissions.includes("admin.properties.all")) {
        return true;
      }
      return allowedPropertyIds.includes(propertyId);
    };

    return {
      permissions,
      roleCode,
      allowedPropertyIds,
      hasPermission,
      hasAnyPermission,
      hasPropertyAccess,
    };
  }, [roleCode, permissions, allowedPropertyIds]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (context) {
    return context;
  }

  // Fallback defaults for dev/demo or unnested components
  return {
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    roleCode: "OrganizationAdmin",
    allowedPropertyIds: DEFAULT_ALLOWED_PROPERTIES,
    hasPermission: (permission: string) => {
      if (DEFAULT_ADMIN_PERMISSIONS.includes("*")) return true;
      return DEFAULT_ADMIN_PERMISSIONS.includes(permission);
    },
    hasAnyPermission: (required: string[]) => {
      if (DEFAULT_ADMIN_PERMISSIONS.includes("*")) return true;
      return required.some((req) => DEFAULT_ADMIN_PERMISSIONS.includes(req));
    },
    hasPropertyAccess: () => true,
  };
}
