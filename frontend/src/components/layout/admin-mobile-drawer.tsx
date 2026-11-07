"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/components/shared/locale-provider";
import { cn } from "@/lib/utils";
import type { AdminModuleKey } from "./admin-sidebar";
import { siteConfig } from "@/config/site";
import {
  BedDouble,
  Building2,
  CalendarDays,
  Globe,
  LogOut,
  Percent,
  Receipt,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

export interface AdminMobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProperty?: string;
  activeModule?: AdminModuleKey;
  onSelectModule?: (module: AdminModuleKey) => void;
}

interface DrawerMenuItem {
  key: AdminModuleKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
}

interface DrawerMenuGroup {
  groupKey: "groupOperations" | "groupMasterData" | "groupFinance";
  items: DrawerMenuItem[];
}

const DRAWER_GROUPS: DrawerMenuGroup[] = [
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

export function AdminMobileDrawer({
  isOpen,
  onClose,
  selectedProperty,
  activeModule: controlledActiveModule,
  onSelectModule,
}: AdminMobileDrawerProps) {
  const { locale, toggleLocale } = useAppLocale();
  const tNav = useTranslations("admin.nav");
  const tShell = useTranslations("admin.shell");
  const tCommon = useTranslations("common");
  const pathname = usePathname();

  const isItemActive = (href: string, key: AdminModuleKey) => {
    if (controlledActiveModule) {
      return controlledActiveModule === key || (key === "users" && controlledActiveModule === "rbac");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleItemClick = (key: AdminModuleKey) => {
    onSelectModule?.(key);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-[300px] p-0 flex flex-col justify-between">
        <div>
          {/* Header */}
          <SheetHeader className="p-4 border-b border-hairline text-left">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-canvas text-xs font-mono font-bold">
                T
              </span>
              <SheetTitle className="font-rounded font-semibold text-lg text-ink">
                {siteConfig.name}
              </SheetTitle>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink text-canvas font-mono font-bold">
                ADMIN
              </span>
            </div>
            {selectedProperty && (
              <div className="flex items-center gap-1.5 text-xs text-body font-mono pt-1">
                <Building2 className="h-3.5 w-3.5 text-mute" />
                <span>{selectedProperty}</span>
              </div>
            )}
          </SheetHeader>

          {/* Menu Items */}
          <div className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
            {DRAWER_GROUPS.map((group) => (
              <div key={group.groupKey} className="space-y-1">
                <div className="px-3 text-[10px] font-semibold text-mute uppercase tracking-wider mb-1">
                  {tShell(group.groupKey)}
                </div>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = isItemActive(item.href, item.key);
                    const label = tNav(item.labelKey);

                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => handleItemClick(item.key)}
                        className="block w-full"
                      >
                        <Button
                          type="button"
                          variant={isActive ? "default" : "ghost"}
                          size="sm"
                          className={cn(
                            "w-full justify-start rounded-full text-xs h-10 px-3 gap-2.5 transition-colors",
                            isActive
                              ? "bg-ink text-canvas font-medium shadow-none"
                              : "text-body hover:text-ink hover:bg-surface-soft font-normal"
                          )}
                        >
                          <IconComponent className="h-4 w-4 shrink-0" />
                          <span className="truncate">{label}</span>
                        </Button>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-hairline space-y-2 bg-surface-soft/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleLocale}
            className="w-full rounded-full text-xs font-mono h-9 justify-center gap-2 border-hairline"
          >
            <Globe className="h-3.5 w-3.5 text-body" />
            <span>{locale.toUpperCase()}</span>
          </Button>

          <Link href="/login" className="block w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full rounded-full text-xs h-9 justify-center gap-2 text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{tCommon("logout")}</span>
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
