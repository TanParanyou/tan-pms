"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommandTag } from "@/components/ui/command-tag";
import { TerminalCard } from "@/components/ui/terminal-card";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const t = useTranslations("home");

  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-6 sm:p-12 md:p-24 max-w-4xl mx-auto">
      {/* Top Bar with Status Tag */}
      <div className="w-full flex items-center justify-between">
        <span className="font-rounded font-semibold text-xl tracking-tight text-ink">
          {siteConfig.name}
        </span>
        <div className="flex items-center gap-2">
          <CommandTag prefixCode="STATUS">ONLINE</CommandTag>
          <CommandTag prefixCode="SCOPE">DUAL-ISOLATED</CommandTag>
        </div>
      </div>

      {/* Hero Section (Ollama Minimal Design System) */}
      <div className="my-auto py-16 text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-rounded font-medium tracking-tight text-ink">
            {t("subtitle")}
          </h1>
          <p className="text-lg text-body max-w-2xl mx-auto leading-relaxed">
            {t("description")}
          </p>
        </div>

        {/* Command Pill */}
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-full bg-surface-soft border border-hairline px-6 py-2.5 text-sm font-mono text-ink">
            <span className="text-body mr-2">$</span>
            <span>{siteConfig.name} --property BKK01 --mode unified</span>
          </div>
        </div>

        {/* Action Buttons (Pill Geometry 9999px) */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/admin">
            <Button size="lg" className="rounded-full shadow-none gap-2">
              <span>{t("adminCta")}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/client">
            <Button variant="outline" size="lg" className="rounded-full shadow-none gap-2">
              <span>{t("clientCta")}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg" className="rounded-full shadow-none">
              {t("loginCta")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Terminal Card Footer */}
      <div className="w-full pt-8">
        <TerminalCard
          title={t("terminalTitle")}
          badge={t("terminalBadge")}
        >
          <div className="space-y-1 text-xs text-charcoal">
            <p>{t("terminalLine1")}</p>
            <p>{t("terminalLine2")}</p>
            <p>{t("terminalLine3")}</p>
          </div>
        </TerminalCard>
      </div>
    </main>
  );
}
