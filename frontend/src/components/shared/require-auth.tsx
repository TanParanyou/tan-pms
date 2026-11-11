"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageLoading } from "@/components/ui/mono-spinner";
import { useAuthState } from "@/lib/auth/use-auth-state";
import { AREA_HOME, buildLoginUrl, type AuthScope } from "@/lib/auth/return-to";

export interface RequireAuthProps {
  scope: AuthScope;
  children: React.ReactNode;
}

/** UX-only route guard (the backend stays the authority): login redirect, wrong-scope redirect, restoring spinner. */
export function RequireAuth({ scope, children }: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("auth");
  const { status, profile } = useAuthState();

  const wrongScope = status === "authenticated" && profile !== null && profile.scope !== scope;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(buildLoginUrl(scope, `${pathname}${typeof window === "undefined" ? "" : window.location.search}`));
    } else if (wrongScope && profile) {
      router.replace(AREA_HOME[profile.scope]);
    }
  }, [status, wrongScope, profile, scope, pathname, router]);

  if (status !== "authenticated" || wrongScope) {
    return <PageLoading message={t("restoringSession")} />;
  }
  return <>{children}</>;
}
