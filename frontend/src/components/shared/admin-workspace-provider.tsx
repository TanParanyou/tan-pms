"use client";

import React, { createContext, useContext, useState, useMemo } from "react";
import { CENTRAL_PROPERTIES, type PropertyMasterItem } from "@/constants/master-data";

export interface AdminWorkspaceContextType {
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  activeProperty: PropertyMasterItem;
  properties: readonly PropertyMasterItem[];
  isQuickWalkInOpen: boolean;
  openQuickWalkIn: () => void;
  closeQuickWalkIn: () => void;
}

const AdminWorkspaceContext = createContext<AdminWorkspaceContextType | null>(null);

export interface AdminWorkspaceProviderProps {
  children: React.ReactNode;
  initialPropertyId?: string;
  /** Properties the signed-in user may work in (from the real session profile); defaults to the central master list. */
  properties?: readonly PropertyMasterItem[];
}

export function AdminWorkspaceProvider({
  children,
  initialPropertyId,
  properties = CENTRAL_PROPERTIES,
}: AdminWorkspaceProviderProps) {
  const firstId = initialPropertyId ?? properties[0]?.id ?? CENTRAL_PROPERTIES[0].id;
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<string>(firstId);
  const [isQuickWalkInOpen, setIsQuickWalkInOpen] = useState(false);

  const setSelectedPropertyId = (id: string) => {
    setSelectedPropertyIdState(id);
  };

  const activeProperty = useMemo(() => {
    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    return propertyMap.get(selectedPropertyId) ?? properties[0] ?? CENTRAL_PROPERTIES[0];
  }, [selectedPropertyId, properties]);

  const value = useMemo<AdminWorkspaceContextType>(() => ({
    selectedPropertyId,
    setSelectedPropertyId,
    activeProperty,
    properties,
    isQuickWalkInOpen,
    openQuickWalkIn: () => setIsQuickWalkInOpen(true),
    closeQuickWalkIn: () => setIsQuickWalkInOpen(false),
  }), [selectedPropertyId, activeProperty, properties, isQuickWalkInOpen]);

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
