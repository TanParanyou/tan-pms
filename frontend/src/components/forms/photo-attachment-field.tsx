"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";
import { StoredFileViewer } from "@/components/shared/stored-file-viewer";
import type { QueuedFile } from "@/hooks/use-deferred-file-upload";

export interface PhotoAttachmentFieldProps {
  label: string;
  existingKey?: string | null;
  queuedFiles: QueuedFile[];
  stageFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  isUploading: boolean;
  disabled?: boolean;
}

/** Deferred single-file field: shows the stored file (if any) and stages a replacement until save. */
export function PhotoAttachmentField({
  label,
  existingKey,
  queuedFiles,
  stageFiles,
  removeFile,
  isUploading,
  disabled = false,
}: PhotoAttachmentFieldProps) {
  const t = useTranslations("common.files");
  return (
    <div className="space-y-2">
      {existingKey && (
        <div className="space-y-1">
          <div className="text-[11px] text-mute">{t("currentFile")}</div>
          <StoredFileViewer fileKey={existingKey} />
        </div>
      )}
      <DeferredFilePicker
        label={label}
        helperText={existingKey ? t("replaceHint") : undefined}
        queuedFiles={queuedFiles}
        onFilesSelected={stageFiles}
        onRemoveFile={removeFile}
        isUploading={isUploading || disabled}
        accept="image/*"
      />
    </div>
  );
}
