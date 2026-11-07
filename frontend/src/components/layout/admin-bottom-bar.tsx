"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AdminModuleKey } from "./admin-sidebar";
import {
  BedDouble,
  CalendarDays,
  Menu,
  Receipt,
  Zap,
} from "lucide-react";

export interface AdminBottomBarProps {
  onOpenMobileDrawer: () => void;
  selectedProperty: string;
  shiftNumber?: string;
  isShiftOpen?: boolean;
  activeModule?: AdminModuleKey;
  onSelectModule?: (module: AdminModuleKey) => void;
}

export function AdminBottomBar({
  onOpenMobileDrawer,
  selectedProperty,
  shiftNumber = "SHF-2603-0001",
  isShiftOpen = true,
  activeModule: controlledActiveModule,
  onSelectModule,
}: AdminBottomBarProps) {
  const tShell = useTranslations("admin.shell");
  const pathname = usePathname();

  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          timeZone: "Asia/Bangkok",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const isTabActive = (href: string, key: AdminModuleKey) => {
    if (controlledActiveModule) {
      return controlledActiveModule === key;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const mobileTabs: { key: AdminModuleKey; href: string; icon: React.ComponentType<{ className?: string }>; labelKey: "mobileTabRack" | "mobileTabStays" | "mobileTabReservations" | "mobileTabMeters" }[] = [
    { key: "rack", href: "/admin/rack", icon: BedDouble, labelKey: "mobileTabRack" },
    { key: "stays", href: "/admin/stays", icon: Receipt, labelKey: "mobileTabStays" },
    { key: "reservations", href: "/admin/reservations", icon: CalendarDays, labelKey: "mobileTabReservations" },
    { key: "meters", href: "/admin/meters", icon: Zap, labelKey: "mobileTabMeters" },
  ];

  return (
    <>
      {/* 1. Desktop Enterprise Operational Status Bar */}
      <footer
        className="hidden md:flex h-8 shrink-0 border-t border-hairline bg-surface-soft text-[11px] font-mono text-charcoal px-6 items-center justify-between select-none z-20"
        aria-label="Desktop Operational Status Bar"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-ink">
            {tShell("branchLabel")}: {selectedProperty}
          </span>
          <span className="h-3 w-[1px] bg-hairline" />
          <span>
            {tShell("shiftLabel")}: {shiftNumber}
          </span>
          <span
            className={
              isShiftOpen
                ? "text-terminal-green font-semibold"
                : "text-mute"
            }
          >
            ({isShiftOpen ? tShell("shiftOpen") : "-"})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-ink">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terminal-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-terminal-green" />
            </span>
            <span>{tShell("liveSync")}</span>
          </span>

          <span className="h-3 w-[1px] bg-hairline" />

          <span className="tabular-nums">
            {tShell("systemTime")}: {currentTime || "--:--:--"}
          </span>
        </div>
      </footer>

      {/* 2. Mobile Responsive Bottom Navigation Bar */}
      <nav
        className="grid grid-cols-5 md:hidden shrink-0 h-14 border-t border-hairline bg-canvas/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] items-stretch px-1 shadow-sm z-40 select-none"
        aria-label="Mobile Navigation Bar"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.href, tab.key);

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectModule?.(tab.key)}
              className={cn(
                "flex flex-col items-center justify-center min-h-[44px] h-full w-full rounded-lg transition-all active:scale-95 py-1 px-0.5 overflow-hidden",
                active ? "text-ink font-semibold" : "text-mute hover:text-body"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-[10px] leading-tight truncate max-w-full text-center mt-0.5 font-medium">
                {tShell(tab.labelKey)}
              </span>
              <span
                className={cn(
                  "h-0.5 w-3 rounded-full transition-all duration-150 mt-0.5 shrink-0",
                  active ? "bg-ink" : "bg-transparent"
                )}
              />
            </button>
          );
        })}

        {/* Tab 5: More Menu (Drawer Trigger) */}
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="flex flex-col items-center justify-center min-h-[44px] h-full w-full rounded-lg text-mute hover:text-body transition-all active:scale-95 py-1 px-0.5 overflow-hidden"
        >
          <Menu className="h-4 w-4 shrink-0" />
          <span className="text-[10px] leading-tight truncate max-w-full text-center mt-0.5 font-medium">
            {tShell("mobileTabMore")}
          </span>
          <span className="h-0.5 w-3 rounded-full bg-transparent mt-0.5 shrink-0" />
        </button>
      </nav>
    </>
  );
}
