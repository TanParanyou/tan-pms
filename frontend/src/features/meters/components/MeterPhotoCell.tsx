"use client";

import React, { useEffect } from "react";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { DeferredFilePicker } from "@/components/ui/deferred-file-picker";

export interface MeterPhotoCellProps {
  label: string;
  disabled?: boolean;
  /** Reports the staged File (or null) to the parent; the parent uploads it on Save only. */
  onStagedChange: (file: File | null) => void;
}

export function MeterPhotoCell({ label, disabled = false, onStagedChange }: MeterPhotoCellProps) {
  const { queuedFiles, stageFiles, removeFile } = useDeferredFileUpload({ maxFiles: 1 });
  const staged = queuedFiles[0]?.file ?? null;

  useEffect(() => {
    onStagedChange(staged);
    // onStagedChange is a stable parent setter wrapper per cell render; only react to file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged]);

  return (
    <DeferredFilePicker
      label={label}
      helperText=" "
      queuedFiles={queuedFiles}
      onFilesSelected={stageFiles}
      onRemoveFile={removeFile}
      isUploading={disabled}
      accept="image/*"
      className="w-56 space-y-1"
    />
  );
}
