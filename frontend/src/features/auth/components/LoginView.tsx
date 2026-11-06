"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectPill } from "@/components/ui/select-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/components/shared/locale-provider";
import {
  DEMO_AUTH_CREDENTIALS,
  DEMO_ROLE_PRESETS,
  type DemoRolePreset,
} from "../constants";
import { siteConfig } from "@/config/site";

export function LoginView() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tTerms = useTranslations("terms");
  const { locale, toggleLocale } = useAppLocale();
  const [scope, setScope] = useState<"admin" | "client">("admin");
  const [selectedPreset, setSelectedPreset] = useState<DemoRolePreset>(
    DEMO_ROLE_PRESETS[0]
  );
  const [identifier, setIdentifier] = useState<string>(
    DEMO_ROLE_PRESETS[0].username
  );
  const [password, setPassword] = useState<string>(
    DEMO_AUTH_CREDENTIALS.maskedPassword
  );

  const handleScopeChange = (newScope: "admin" | "client") => {
    setScope(newScope);
    if (newScope === "admin") {
      setIdentifier(selectedPreset.username);
      setPassword(selectedPreset.password);
    } else {
      setIdentifier(DEMO_AUTH_CREDENTIALS.clientNationalId);
      setPassword(DEMO_AUTH_CREDENTIALS.maskedPassword);
    }
  };

  const handleRolePresetChange = (roleCode: string) => {
    const found = DEMO_ROLE_PRESETS.find((r) => r.roleCode === roleCode);
    if (found) {
      setSelectedPreset(found);
      setIdentifier(found.username);
      setPassword(found.password);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scope === "admin") {
      router.push("/admin");
    } else {
      router.push("/client");
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between p-6 max-w-lg mx-auto">
      {/* Header with Language Pill */}
      <div className="flex items-center justify-between pt-4">
        <Link
          href="/"
          className="font-rounded font-semibold text-lg tracking-tight text-ink"
        >
          ← {siteConfig.name}
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleLocale}
          className="rounded-full text-xs font-mono h-8 px-3"
        >
          🌐 {locale.toUpperCase()}
        </Button>
      </div>

      {/* Main Login Card */}
      <div className="my-auto py-8">
        <Card className="rounded-[12px] border border-hairline bg-canvas p-2 shadow-none">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="flex justify-center">
              <CommandTag prefixCode="AUTH">{t("scopeTag")}</CommandTag>
            </div>
            <CardTitle className="text-2xl font-rounded font-medium text-ink">
              {t("title")}
            </CardTitle>
            <CardDescription className="text-xs text-body">
              {t("subtitle")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Scope Switcher Pill */}
            <div className="flex items-center rounded-full bg-surface-soft border border-hairline p-1 gap-1">
              <Button
                type="button"
                variant={scope === "admin" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleScopeChange("admin")}
                className="flex-1 rounded-full text-xs font-medium h-8"
              >
                {t("scopeAdmin")}
              </Button>
              <Button
                type="button"
                variant={scope === "client" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleScopeChange("client")}
                className="flex-1 rounded-full text-xs font-medium h-8"
              >
                {t("scopeClient")}
              </Button>
            </div>

            {/* Scope Description */}
            <div className="rounded-[8px] bg-surface-soft p-3 border border-hairline text-xs text-charcoal">
              <span className="font-semibold block text-ink mb-0.5">
                {scope === "admin" ? t("adminScope") : t("clientScope")}
              </span>
              {scope === "admin" ? t("adminDesc") : t("clientDesc")}
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {scope === "admin" && (
                <div className="space-y-2 p-3 rounded-lg border border-hairline bg-surface-soft">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rolePreset" className="text-xs font-medium text-ink">
                      {t("demoRole")}
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="mono" className="text-[10px]">
                        {t("permissionsBadge", { count: selectedPreset.permissionsCount })}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {t("propertiesBadge", { count: selectedPreset.propertiesCount })}
                      </Badge>
                    </div>
                  </div>
                  <SelectPill
                    id="rolePreset"
                    value={selectedPreset.roleCode}
                    onChange={(e) => handleRolePresetChange(e.target.value)}
                    className="h-9 text-xs bg-canvas"
                  >
                    {DEMO_ROLE_PRESETS.map((p) => (
                      <option key={p.roleCode} value={p.roleCode}>
                        {t(p.labelKey as "roleSuperAdmin" | "rolePropertyManager" | "roleFrontDesk")} ({p.roleCode})
                      </option>
                    ))}
                  </SelectPill>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-xs font-medium text-charcoal">
                  {scope === "admin" ? t("username") : t("nationalId")}
                </Label>
                <Input
                  id="identifier"
                  value={identifier}
                  placeholder={scope === "admin" ? t("username") : t("nationalId")}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="rounded-full h-10 px-4 text-sm font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-charcoal">
                  {t("password")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-full h-10 px-4 text-sm font-mono"
                  required
                />
              </div>

              {scope === "admin" && (
                <div className="pt-1">
                  <span className="text-[11px] text-body block mb-1.5 font-medium">
                    {t("propertyScopeLabel")} ({tTerms("Property")}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPreset.propertyCodes.map((code) => (
                      <Badge key={code} variant="mono">
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full rounded-full bg-ink text-canvas hover:bg-ink-deep h-10 text-sm font-medium mt-2"
              >
                {scope === "admin" ? t("loginAsAdmin") : t("loginAsClient")} →
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-body font-mono pb-2">
        {t("footer")}
      </div>
    </div>
  );
}
