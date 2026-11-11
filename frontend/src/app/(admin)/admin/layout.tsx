"use client";

import React, { useMemo, useState } from "react";
import { AdminWorkspaceProvider, useAdminWorkspace } from "@/components/shared/admin-workspace-provider";
import { AdminNavbar } from "@/components/layout/admin-navbar";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminBottomBar } from "@/components/layout/admin-bottom-bar";
import { AdminMobileDrawer } from "@/components/layout/admin-mobile-drawer";
import { QuickWalkInModal } from "@/features/rack/components/QuickWalkInModal";
import { useTranslations } from "next-intl";
import { RequireAuth } from "@/components/shared/require-auth";
import { PermissionProvider } from "@/hooks/use-permission";
import { useAuthState } from "@/lib/auth/use-auth-state";
import { usePathname } from "next/navigation";
import { adminModuleKeyFromPath } from "@/lib/admin-nav";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const {
    activeProperty,
    selectedPropertyId,
    setSelectedPropertyId,
    properties,
    isQuickWalkInOpen,
    openQuickWalkIn,
    closeQuickWalkIn,
  } = useAdminWorkspace();

  const tNav = useTranslations("admin.nav");
  const pathname = usePathname();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Derive active module title from current pathname
  const activeModuleKey = adminModuleKeyFromPath(pathname);
  const activeModuleName = tNav.has(activeModuleKey)
    ? tNav(activeModuleKey)
    : activeModuleKey.toUpperCase();

  return (
    <div className="h-screen w-screen overflow-hidden bg-canvas text-ink flex flex-col">
      {/* 1. Top Command Navbar (Fixed height, zero vertical jitter) */}
      <AdminNavbar
        selectedProperty={activeProperty.code}
        onSelectProperty={(code) => {
          const found = properties.find((p) => p.code === code);
          if (found) setSelectedPropertyId(found.id);
        }}
        properties={properties}
        activeModuleName={activeModuleName}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      {/* 2. Workspace Body: Left Pinned Sidebar + Independent Scroll Viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <AdminSidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="flex-1 h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <div className="max-w-6xl space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* 3. Operational Bottom Bar: Desktop Status Bar + Mobile Bottom Nav */}
      <AdminBottomBar
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
        selectedProperty={activeProperty.code}
      />

      {/* 4. Mobile Drawer */}
      <AdminMobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        selectedProperty={activeProperty.code}
      />

      {/* 5. Global Quick Walk-In Modal */}
      <QuickWalkInModal
        isOpen={isQuickWalkInOpen}
        onClose={closeQuickWalkIn}
        onSuccess={() => closeQuickWalkIn()}
      />
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthState();
  const properties = useMemo(
    () => (profile?.allowedProperties ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name })),
    [profile]
  );
  const allowedPropertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  return (
    <PermissionProvider roleCode={profile?.roleCode ?? ""} permissions={profile?.permissions ?? []} allowedPropertyIds={allowedPropertyIds}>
      <AdminWorkspaceProvider properties={properties.length > 0 ? properties : undefined}>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </AdminWorkspaceProvider>
    </PermissionProvider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth scope="admin">
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
