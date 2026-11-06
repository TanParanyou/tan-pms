"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CommandTag } from "@/components/ui/command-tag";
import { useAppLocale } from "@/components/shared/locale-provider";

export default function LoginPage() {
  const router = useRouter();
  const { messages, locale, toggleLocale } = useAppLocale();
  const [scope, setScope] = useState<"admin" | "client">("admin");
  const [identifier, setIdentifier] = useState(scope === "admin" ? "staff.reception@tan-pms" : "1-1002-39481-22-1");
  const [password, setPassword] = useState("••••••••••••");

  const handleScopeChange = (newScope: "admin" | "client") => {
    setScope(newScope);
    if (newScope === "admin") {
      setIdentifier("staff.reception@tan-pms");
    } else {
      setIdentifier("1-1002-39481-22-1");
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
    <div className="min-h-screen bg-[#ffffff] flex flex-col justify-between p-6 max-w-lg mx-auto">
      {/* Header with Language Pill */}
      <div className="flex items-center justify-between pt-4">
        <Link href="/" className="font-rounded font-semibold text-lg tracking-tight text-[#000000]">
          ← tan-pms
        </Link>
        <button
          type="button"
          onClick={toggleLocale}
          className="rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-1 text-xs font-mono font-medium hover:bg-[#f0f0f0] transition-colors"
        >
          🌐 {locale.toUpperCase()}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="my-auto py-8">
        <Card className="rounded-[12px] border border-[#e5e5e5] bg-[#ffffff] p-2 shadow-none">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="flex justify-center">
              <CommandTag prefixCode="AUTH">AUTHORIZATION SCOPE</CommandTag>
            </div>
            <CardTitle className="text-2xl font-rounded font-medium">
              {messages.auth.title}
            </CardTitle>
            <CardDescription className="text-xs text-[#737373]">
              {messages.auth.subtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Scope Switcher Pill */}
            <div className="flex items-center rounded-full bg-[#fafafa] border border-[#e5e5e5] p-1 gap-1">
              <button
                type="button"
                onClick={() => handleScopeChange("admin")}
                className={`flex-1 rounded-full py-2 text-xs font-medium transition-all ${
                  scope === "admin"
                    ? "bg-[#000000] text-[#ffffff] shadow-sm"
                    : "text-[#737373] hover:text-[#000000]"
                }`}
              >
                AdminScope
              </button>
              <button
                type="button"
                onClick={() => handleScopeChange("client")}
                className={`flex-1 rounded-full py-2 text-xs font-medium transition-all ${
                  scope === "client"
                    ? "bg-[#000000] text-[#ffffff] shadow-sm"
                    : "text-[#737373] hover:text-[#000000]"
                }`}
              >
                ClientScope
              </button>
            </div>

            {/* Scope Scope Description */}
            <div className="rounded-[8px] bg-[#fafafa] p-3 border border-[#e5e5e5] text-xs text-[#525252]">
              <span className="font-semibold block text-[#000000] mb-0.5">
                {scope === "admin" ? messages.auth.adminScope : messages.auth.clientScope}
              </span>
              {scope === "admin" ? messages.auth.adminDesc : messages.auth.clientDesc}
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-xs font-medium text-[#525252]">
                  {scope === "admin" ? messages.auth.username : messages.auth.nationalId}
                </Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="rounded-full h-10 px-4 text-sm font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-[#525252]">
                    {messages.auth.password}
                  </Label>
                  <span className="text-[11px] text-[#737373] font-mono">Demo: auto-filled</span>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-full h-10 px-4 text-sm font-mono"
                  required
                />
              </div>

              {scope === "admin" && (
                <div className="pt-1">
                  <span className="text-[11px] text-[#737373] block mb-1.5 font-medium">
                    {messages.auth.propertyScopeLabel}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="mono">BKK01 (Rama 9)</Badge>
                    <Badge variant="mono">BKK02 (Sukhumvit)</Badge>
                    <Badge variant="secondary">CNX01 (Nimman)</Badge>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full rounded-full bg-[#000000] text-[#ffffff] hover:bg-[#090909] h-10 text-sm font-medium mt-2"
              >
                {scope === "admin" ? messages.auth.loginAsAdmin : messages.auth.loginAsClient} →
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-[#737373] font-mono pb-2">
        Single-Organization Multi-Property • Strict Token Isolation
      </div>
    </div>
  );
}
