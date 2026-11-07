"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CommandTag } from "@/components/ui/command-tag";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  prefixCode?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  description,
  prefixCode,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  const displaySubtitle = subtitle ?? description;

  return (
    <div className={cn("flex flex-col gap-2 pb-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-body overflow-x-auto"
        >
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-mute">/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-ink transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ink font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            {prefixCode && (
              <CommandTag prefixCode={prefixCode}>{prefixCode}</CommandTag>
            )}
            <h1 className="text-2xl font-rounded font-semibold text-ink tracking-tight">
              {title}
            </h1>
          </div>
          {displaySubtitle && (
            <p className="text-xs text-body leading-relaxed">{displaySubtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
