"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Globe } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CommandTag } from "@/components/ui/command-tag";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppLocale } from "@/components/shared/locale-provider";
import { ApiError } from "@/lib/api/api-error";
import { loginWithCredentials } from "@/lib/auth/auth-actions";
import { AREA_HOME, sanitizeReturnTo, type AuthScope } from "@/lib/auth/return-to";
import { useAuthState } from "@/lib/auth/use-auth-state";
import { siteConfig } from "@/config/site";

type LoginFailure = { kind: "invalid" } | { kind: "rateLimited"; retryAfterSeconds?: number } | { kind: "network" };

function toFailure(err: unknown): LoginFailure {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.errorCode === "auth.rate_limited") return { kind: "rateLimited", retryAfterSeconds: err.retryAfterSeconds };
    if (err.status === 0) return { kind: "network" };
  }
  // Wrong identifier, wrong password, locked or inactive accounts all look the same on purpose.
  return { kind: "invalid" };
}

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations("auth");
  const { locale, toggleLocale } = useAppLocale();
  const { status, profile } = useAuthState();

  const [scope, setScope] = useState<AuthScope>(params.get("scope") === "client" ? "client" : "admin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<LoginFailure | null>(null);
  const inFlight = useRef(false);

  const goHome = (target: AuthScope) => {
    router.replace(sanitizeReturnTo(params.get("returnTo"), target) ?? AREA_HOME[target]);
  };

  // Already signed in (e.g. opened /login in a second tab): skip the form.
  useEffect(() => {
    if (status === "authenticated" && profile) goHome(profile.scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || isSubmitting) return;
    inFlight.current = true;
    setIsSubmitting(true);
    setFailure(null);
    try {
      const signedInScope = await loginWithCredentials({ scope, identifier: identifier.trim(), password });
      setPassword("");
      goHome(signedInScope);
    } catch (err) {
      setPassword("");
      setFailure(toFailure(err));
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const failureMessage =
    failure === null
      ? null
      : failure.kind === "rateLimited"
      ? failure.retryAfterSeconds !== undefined
        ? t("errorRateLimitedWithSeconds", { seconds: failure.retryAfterSeconds })
        : t("errorRateLimited")
      : failure.kind === "network"
      ? t("errorNetwork")
      : t("errorInvalidCredentials");

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between pt-4">
        <Link href="/" className="font-rounded font-semibold text-lg tracking-tight text-ink flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>{siteConfig.name}</span>
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={toggleLocale} className="rounded-full text-xs font-mono h-8 px-3 gap-1.5">
          <Globe className="h-3.5 w-3.5" />
          <span>{locale.toUpperCase()}</span>
        </Button>
      </div>

      <div className="my-auto py-8">
        <Card className="rounded-[12px] border border-hairline bg-canvas p-2 shadow-none">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="flex justify-center">
              <CommandTag prefixCode="AUTH">{t("scopeTag")}</CommandTag>
            </div>
            <CardTitle className="text-2xl font-rounded font-medium text-ink">{t("title")}</CardTitle>
            <CardDescription className="text-xs text-body">{t("subtitle")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div role="group" aria-label={t("scopeTag")} className="flex items-center rounded-full bg-surface-soft border border-hairline p-1 gap-1">
              <Button type="button" variant={scope === "admin" ? "default" : "ghost"} size="sm" disabled={isSubmitting} aria-pressed={scope === "admin"} onClick={() => setScope("admin")} className="flex-1 rounded-full text-xs font-medium h-8">
                {t("scopeAdmin")}
              </Button>
              <Button type="button" variant={scope === "client" ? "default" : "ghost"} size="sm" disabled={isSubmitting} aria-pressed={scope === "client"} onClick={() => setScope("client")} className="flex-1 rounded-full text-xs font-medium h-8">
                {t("scopeClient")}
              </Button>
            </div>

            <div className="rounded-[8px] bg-surface-soft p-3 border border-hairline text-xs text-charcoal">
              <span className="font-semibold block text-ink mb-0.5">{scope === "admin" ? t("adminScope") : t("clientScope")}</span>
              {scope === "admin" ? t("adminDesc") : t("clientDesc")}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {failureMessage && (
                <Alert variant="danger" data-testid="login-error">
                  {failureMessage}
                </Alert>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="identifier" className="text-xs font-medium text-charcoal">
                  {scope === "admin" ? t("username") : t("loginIdentifier")}
                </Label>
                <Input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  placeholder={scope === "admin" ? t("username") : t("loginIdentifier")}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isSubmitting}
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
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t("password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="rounded-full h-10 px-4 text-sm font-mono"
                  required
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || identifier.trim() === "" || password === ""}
                className="w-full rounded-full bg-ink text-canvas hover:bg-ink-deep h-10 text-sm font-medium mt-2"
              >
                {isSubmitting ? t("signingIn") : scope === "admin" ? t("loginAsAdmin") : t("loginAsClient")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-[11px] text-body font-mono pb-2">{t("footer")}</div>
    </div>
  );
}
