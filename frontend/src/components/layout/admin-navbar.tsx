"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SelectPill } from "@/components/ui/select-pill";
import { Tooltip } from "@/components/ui/tooltip";
import { useAppLocale } from "@/components/shared/locale-provider";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveLocalizedText, type LocalizedTextDto } from "@/lib/i18n/localized-text";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Search,
  KeyRound,
  Settings,
  User,
} from "lucide-react";
import { useSignOut } from "@/hooks/use-sign-out";
import { ChangePasswordDialog } from "@/components/forms/change-password-dialog";

export interface AdminNavbarProps {
  selectedProperty: string;
  onSelectProperty: (code: string) => void;
  properties: ReadonlyArray<{ code: string; name: LocalizedTextDto }>;
  activeModuleName: string;
  onOpenMobileDrawer: () => void;
  onOpenSearch?: () => void;
  shiftNumber?: string;
  isShiftOpen?: boolean;
}

export function AdminNavbar({
  selectedProperty,
  onSelectProperty,
  properties,
  activeModuleName,
  onOpenMobileDrawer,
  onOpenSearch,
  shiftNumber = "SHF-2603-0001",
  isShiftOpen = true,
}: AdminNavbarProps) {
  const { locale, setLocale } = useAppLocale();
  const tCommon = useTranslations("common");
  const { signOut, isSigningOut } = useSignOut();
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const tShell = useTranslations("admin.shell");

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
      <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Brand + Scope Badge + Property Pill + Breadcrumbs */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          {/* Mobile Drawer Trigger */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenMobileDrawer}
            aria-label={tShell("moreMenu")}
            className="md:hidden h-8 w-8 shrink-0 rounded-full text-ink hover:bg-surface-soft"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <Link
            href="/"
            className="font-rounded font-semibold text-lg sm:text-xl tracking-tight text-ink flex items-center gap-1.5 shrink-0"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-canvas text-xs font-mono font-bold">
              T
            </span>
            <span className="hidden sm:inline">{siteConfig.name}</span>
          </Link>

          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-ink text-canvas font-mono font-bold shrink-0">
            ADMIN
          </span>

          {/* Property Switcher Pill */}
          <div className="shrink-0">
            <SelectPill
              value={selectedProperty}
              onChange={(e) => onSelectProperty(e.target.value)}
              wrapperClassName="w-[105px] sm:w-[200px] shrink-0"
              className="h-8 text-xs font-mono font-medium pl-2 pr-6 bg-surface-soft border-hairline truncate"
            >
              {properties.map((prop) => (
                <option key={prop.code} value={prop.code}>
                  {prop.code} — {resolveLocalizedText(prop.name, locale)}
                </option>
              ))}
            </SelectPill>
          </div>

          {/* Active Module Breadcrumb (Desktop) */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-body pl-2 border-l border-hairline shrink-0">
            <Building2 className="h-3.5 w-3.5 text-mute" />
            <span className="font-medium text-ink truncate max-w-[200px] whitespace-nowrap">
              {activeModuleName}
            </span>
          </div>
        </div>

        {/* Right: Search + Shift Pill + Notifications + Language + User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Search Trigger */}
          {onOpenSearch ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSearch}
              className="hidden sm:flex items-center justify-between gap-3 h-8 rounded-full border-hairline bg-surface-soft text-body hover:text-ink text-xs px-3"
            >
              <div className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-mute" />
                <span className="text-[11px] font-sans truncate">{tShell("searchPlaceholder")}</span>
              </div>
              <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-canvas border border-hairline text-mute">
                ⌘K
              </kbd>
            </Button>
          ) : (
            <div className="hidden sm:flex items-center justify-between gap-3 h-8 px-3 rounded-full border border-hairline bg-surface-soft text-xs text-body">
              <div className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-mute" />
                <span className="text-[11px] font-sans truncate">{tShell("searchPlaceholder")}</span>
              </div>
              <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-canvas border border-hairline text-mute">
                ⌘K
              </kbd>
            </div>
          )}

          {/* Shift Live Pill (Desktop) */}
          <div className="hidden xl:flex items-center gap-2 h-8 px-3 rounded-full border border-hairline bg-surface-soft text-[11px] font-mono text-body whitespace-nowrap shrink-0">
            <span>{shiftNumber}</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isShiftOpen ? "bg-terminal-green" : "bg-mute"
                }`}
              />
              <span
                className={
                  isShiftOpen
                    ? "text-terminal-green font-semibold"
                    : "text-mute"
                }
              >
                {isShiftOpen ? tShell("shiftOpen") : "-"}
              </span>
            </span>
          </div>

          {/* Notifications Bell */}
          <Tooltip content={tCommon("details")} position="bottom">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={tCommon("details")}
              className="h-8 w-8 rounded-full border-hairline relative"
            >
              <Bell className="h-3.5 w-3.5 text-ink" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            </Button>
          </Tooltip>

          {/* Language Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={tCommon("language")}
                className="rounded-full text-xs font-mono h-8 px-2 sm:px-2.5 gap-1.5 border-hairline shrink-0 hover:bg-surface-soft active:scale-95"
              >
                <Globe className="h-3.5 w-3.5 text-body" />
                <span>{locale.toUpperCase()}</span>
                <ChevronDown className="h-3 w-3 text-mute" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-36 rounded-[12px] p-1.5 border border-hairline bg-canvas shadow-lg space-y-0.5 z-50"
            >
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  onClick={() => setLocale("th")}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors",
                    locale === "th"
                      ? "bg-surface-soft text-ink font-semibold"
                      : "text-body hover:text-ink hover:bg-surface-soft"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-canvas border border-hairline font-bold">
                      TH
                    </span>
                    <span>{tCommon("th")}</span>
                  </div>
                  {locale === "th" && <Check className="h-3.5 w-3.5 text-ink shrink-0" />}
                </button>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer transition-colors",
                    locale === "en"
                      ? "bg-surface-soft text-ink font-semibold"
                      : "text-body hover:text-ink hover:bg-surface-soft"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-canvas border border-hairline font-bold">
                      EN
                    </span>
                    <span>{tCommon("en")}</span>
                  </div>
                  {locale === "en" && <Check className="h-3.5 w-3.5 text-ink shrink-0" />}
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Avatar Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={tShell("userProfile")}
                className="h-8 w-8 rounded-full bg-ink text-canvas font-mono text-xs font-bold transition-all relative select-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-ink"
              >
                <span>AD</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-[12px] p-2 border border-hairline bg-canvas shadow-lg space-y-1 z-50"
            >
              <DropdownMenuLabel className="p-1.5 font-normal">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-ink text-canvas font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    AD
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-xs text-ink truncate">
                      Admin Manager
                    </span>
                    <span className="text-[10px] font-mono text-mute truncate">
                      admin@tan-pms.local
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="inline-block text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-surface-soft border border-hairline text-ink">
                    {tShell("userRole")}
                  </span>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="bg-hairline my-1" />

              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-body hover:text-ink hover:bg-surface-soft rounded-lg cursor-pointer transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-mute" />
                  <span>{tShell("userProfile")}</span>
                </button>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-body hover:text-ink hover:bg-surface-soft rounded-lg cursor-pointer transition-colors"
                >
                  <Settings className="h-3.5 w-3.5 text-mute" />
                  <span>{tShell("settings")}</span>
                </button>
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => setShowChangePassword(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-body hover:text-ink hover:bg-surface-soft rounded-lg cursor-pointer transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 text-mute" />
                <span>{tShell("changePassword")}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-hairline my-1" />

              <DropdownMenuItem
                disabled={isSigningOut}
                onSelect={() => void signOut()}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{tCommon("logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
    </header>
  );
}
