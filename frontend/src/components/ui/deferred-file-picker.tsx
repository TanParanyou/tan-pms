"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useTranslations } from "next-intl";
import type { QueuedFile } from "@/hooks/use-deferred-file-upload";

export interface DeferredFilePickerProps {
  queuedFiles: QueuedFile[];
  onFilesSelected: (files: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
  isUploading?: boolean;
  accept?: string;
  multiple?: boolean;
  label?: string;
  helperText?: string;
  className?: string;
}

export function DeferredFilePicker({
  queuedFiles,
  onFilesSelected,
  onRemoveFile,
  isUploading = false,
  accept = "image/*,.pdf",
  multiple = false,
  label,
  helperText,
  className,
}: DeferredFilePickerProps) {
  const t = useTranslations("common.filePicker");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resolvedLabel = label || t("defaultLabel");
  const resolvedHelperText = helperText || t("defaultHelper");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{resolvedLabel}</span>
        <span className="text-xs text-body tabular-nums">
          {queuedFiles.length} {t("filesStaged")}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border-hairline bg-canvas text-xs hover:bg-surface-soft"
        >
          📎 {t("chooseFile")}
        </Button>
        <span className="text-xs text-body">{resolvedHelperText}</span>
      </div>

      {queuedFiles.length > 0 && (
        <div className="space-y-2 pt-1">
          {queuedFiles.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-full border border-hairline bg-surface-soft px-3 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="h-6 w-6 rounded-full object-cover border border-hairline"
                  />
                ) : (
                  <span className="text-sm" aria-hidden="true">📄</span>
                )}
                <span className="font-mono truncate max-w-[200px] text-ink">
                  {item.name}
                </span>
                <span className="text-body tabular-nums">
                  ({(item.size / 1024).toFixed(1)} KB)
                </span>
                <span className="rounded-full bg-terminal-yellow/20 text-amber-700 px-2 py-0.5 text-[10px] font-medium">
                  {t("stagedBadge")}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveFile(item.id)}
                disabled={isUploading}
                title={t("removeFile")}
                aria-label={t("removeFile")}
                className="h-6 w-6 rounded-full text-body hover:text-destructive"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
