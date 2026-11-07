"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  BedDouble,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Percent,
  Receipt,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

export type AdminModuleKey =
  | "rack"
  | "stays"
  | "reservations"
  | "meters"
  | "properties"
  | "rates"
  | "users"
  | "rbac"
  | "cashier";

export interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
  activeModule?: AdminModuleKey;
  onSelectModule?: (module: AdminModuleKey) => void;
}

export interface NavItem {
  key: AdminModuleKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

interface NavGroup {
  groupKey: "groupOperations" | "groupMasterData" | "groupFinance";
  items: NavItem[];
}

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "groupOperations",
    items: [
      { key: "rack", href: "/admin/rack", icon: BedDouble, labelKey: "rack" },
      { key: "stays", href: "/admin/stays", icon: Receipt, labelKey: "stays" },
      { key: "reservations", href: "/admin/reservations", icon: CalendarDays, labelKey: "reservations" },
      { key: "meters", href: "/admin/meters", icon: Zap, labelKey: "meters" },
    ],
  },
  {
    groupKey: "groupMasterData",
    items: [
      { key: "properties", href: "/admin/properties", icon: Building2, labelKey: "properties" },
      { key: "rates", href: "/admin/rates", icon: Percent, labelKey: "rates" },
      { key: "users", href: "/admin/users", icon: Users, labelKey: "rbac" },
    ],
  },
  {
    groupKey: "groupFinance",
    items: [
      { key: "cashier", href: "/admin/cashier", icon: Wallet, labelKey: "cashier" },
    ],
  },
];

export function AdminSidebar({
  isCollapsed,
  onToggleCollapse,
  className,
  activeModule: controlledActiveModule,
  onSelectModule,
}: AdminSidebarProps) {
  const tNav = useTranslations("admin.nav");
  const tShell = useTranslations("admin.shell");
  const pathname = usePathname();

  const isItemActive = (href: string, key: AdminModuleKey) => {
    if (controlledActiveModule) {
      return controlledActiveModule === key || (key === "users" && controlledActiveModule === "rbac");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      aria-label="Admin Sidebar Navigation"
      className={cn(
        "hidden md:flex flex-col border-r border-hairline bg-canvas transition-[width] duration-200 ease-in-out shrink-0 select-none",
        isCollapsed ? "w-16" : "w-56",
        className
      )}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.groupKey} className="space-y-1">
            {!isCollapsed && (
              <span className="px-3 text-[10px] font-semibold text-mute uppercase tracking-wider block">
                {tShell(group.groupKey)}
              </span>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href, item.key);
                const label = tNav(item.labelKey);

                const linkContent = (
                  <Button
                    type="button"
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onSelectModule?.(item.key)}
                    className={cn(
                      "w-full rounded-full transition-colors font-medium text-xs h-9",
                      isCollapsed ? "px-0 justify-center" : "px-3 justify-start gap-2.5",
                      active
                        ? "bg-ink text-canvas hover:bg-neutral-800"
                        : "text-body hover:text-ink hover:bg-surface-soft"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed && (
                      <span className="truncate">{label}</span>
                    )}
                  </Button>
                );

                return (
                  <div key={item.key}>
                    {isCollapsed ? (
                      <Tooltip content={label} position="right">
                        <Link href={item.href} className="block w-full" aria-label={label}>
                          {linkContent}
                        </Link>
                      </Tooltip>
                    ) : (
                      <Link href={item.href} className="block w-full" aria-label={label}>
                        {linkContent}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-hairline">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className={cn(
            "w-full rounded-full text-xs text-mute hover:text-ink hover:bg-surface-soft h-9",
            isCollapsed ? "px-0 justify-center" : "px-3 justify-between"
          )}
          aria-label={isCollapsed ? tShell("expand") : tShell("collapse")}
        >
          {!isCollapsed && (
            <span className="text-[11px] font-mono">{tShell("collapse")}</span>
          )}
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
