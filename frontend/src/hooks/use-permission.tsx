"use client";

import React, { createContext, useContext, useMemo } from "react";
import { getAuthState } from "@/lib/auth/session-store";

export interface PermissionContextValue {
  permissions: readonly string[];
  roleCode: string;
  allowedPropertyIds: readonly string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasPropertyAccess: (propertyId: string) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export interface PermissionProviderProps {
  children: React.ReactNode;
  roleCode?: string;
  permissions?: readonly string[];
  allowedPropertyIds?: readonly string[];
}

export function PermissionProvider({
  children,
  roleCode = "",
  permissions = [],
  allowedPropertyIds = [],
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

  // No provider mounted: use the real session profile (never a hardcoded permission list).
  const profile = getAuthState().profile;
  const permissions = profile?.permissions ?? [];
  const allowedPropertyIds = (profile?.allowedProperties ?? []).map((p) => p.id);
  const has = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  return {
    permissions,
    roleCode: profile?.roleCode ?? "",
    allowedPropertyIds,
    hasPermission: has,
    hasAnyPermission: (required: string[]) => required.some(has),
    hasPropertyAccess: (propertyId: string) => has("admin.properties.all") || allowedPropertyIds.includes(propertyId),
  };
}
