"use client";

import React from "react";

export interface FormSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  actions,
  children,
  className = "",
}: FormSectionProps) {
  return (
    <section
      className={`rounded-[12px] border border-hairline bg-canvas p-6 shadow-none space-y-4 ${className}`}
    >
      {(title || description || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-3 mb-2">
          <div>
            {title && (
              <h3 className="font-rounded font-semibold text-base tracking-tight text-ink">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-body">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {children}
    </section>
  );
}
