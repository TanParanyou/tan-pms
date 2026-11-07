"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { CENTRAL_PROPERTIES, type PropertyMasterItem } from "@/constants/master-data";
import { apiClient } from "@/lib/api/api-client";

export interface AdminWorkspaceContextType {
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  activeProperty: PropertyMasterItem;
  properties: readonly PropertyMasterItem[];
  isQuickWalkInOpen: boolean;
  openQuickWalkIn: () => void;
  closeQuickWalkIn: () => void;
}

const PROPERTY_MAP: Record<string, PropertyMasterItem> = Object.fromEntries(
  CENTRAL_PROPERTIES.map((p) => [p.id, p])
);

const AdminWorkspaceContext = createContext<AdminWorkspaceContextType | null>(null);

export interface AdminWorkspaceProviderProps {
  children: React.ReactNode;
  initialPropertyId?: string;
}

export function AdminWorkspaceProvider({
  children,
  initialPropertyId = CENTRAL_PROPERTIES[0].id,
}: AdminWorkspaceProviderProps) {
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string>(initialPropertyId);
  const [isQuickWalkInOpen, setIsQuickWalkInOpen] = useState(false);

  const setSelectedPropertyId = (id: string) => {
    setSelectedPropertyIdState(id);
    apiClient.setPropertyId(id);
  };

  const activeProperty = useMemo(() => {
    return PROPERTY_MAP[selectedPropertyId] ?? CENTRAL_PROPERTIES[0];
  }, [selectedPropertyId]);

  const value = useMemo<AdminWorkspaceContextType>(() => ({
    selectedPropertyId,
    setSelectedPropertyId,
    activeProperty,
    properties: CENTRAL_PROPERTIES,
    isQuickWalkInOpen,
    openQuickWalkIn: () => setIsQuickWalkInOpen(true),
    closeQuickWalkIn: () => setIsQuickWalkInOpen(false),
  }), [selectedPropertyId, activeProperty, isQuickWalkInOpen]);

  return (
    <AdminWorkspaceContext.Provider value={value}>
      {children}
    </AdminWorkspaceContext.Provider>
  );
}

export function useAdminWorkspace(): AdminWorkspaceContextType {
  const context = useContext(AdminWorkspaceContext);
  if (!context) {
    throw new Error("useAdminWorkspace must be used within an AdminWorkspaceProvider");
  }
  return context;
}
