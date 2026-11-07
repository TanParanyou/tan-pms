"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAppLocale } from "@/components/shared/locale-provider";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  FileText,
  Globe,
  Home,
  LogOut,
  Package,
  Wrench,
} from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale, toggleLocale } = useAppLocale();
  const tNav = useTranslations("admin.nav");
  const tCommon = useTranslations("common");

  const navLinks = [
    { href: "/client/dashboard", label: "Dashboard", icon: Home },
    { href: "/client/book", label: "Book Room", icon: CalendarDays },
    { href: "/client/invoices", label: "Invoices & Lease", icon: FileText },
    { href: "/client/work-orders", label: "Work Orders", icon: Wrench },
    { href: "/client/parcels", label: "Parcels", icon: Package },
  ];

  const isLinkActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* 1. Sticky Client Header */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/client/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink text-canvas text-xs font-mono font-bold">
              T
            </span>
            <span className="font-rounded font-semibold text-lg tracking-tight text-ink">
              {siteConfig.name}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-soft border border-hairline text-body font-mono font-bold">
              CLIENT
            </span>
          </Link>

          {/* Capsule Nav Links */}
          <nav
            aria-label="Client Capsule Navigation"
            className="hidden md:flex items-center gap-1.5 p-1 rounded-full bg-surface-soft border border-hairline"
          >
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isLinkActive(link.href);

              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    type="button"
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "rounded-full text-xs h-8 px-3.5 gap-1.5 transition-colors",
                      active
                        ? "bg-ink text-canvas font-medium shadow-none"
                        : "text-body hover:text-ink hover:bg-canvas"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{link.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              className="rounded-full text-xs font-mono h-8 px-3 gap-1.5 border-hairline"
            >
              <Globe className="h-3.5 w-3.5 text-body" />
              <span>{locale.toUpperCase()}</span>
            </Button>

            <Link href="/login">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-xs h-8 px-3 gap-1.5 text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tCommon("logout")}</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Nav Links Row */}
        <div className="flex md:hidden overflow-x-auto gap-1 pt-2 pb-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isLinkActive(link.href);

            return (
              <Link key={link.href} href={link.href} className="shrink-0">
                <Button
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "rounded-full text-xs h-7 px-2.5 gap-1",
                    active ? "bg-ink text-canvas" : "text-body"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{link.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </header>

      {/* 2. Main Viewport */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
