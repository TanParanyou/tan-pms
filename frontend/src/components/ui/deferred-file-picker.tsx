import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
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
  label = "แนบไฟล์เอกสาร / รูปภาพ (Deferred)",
  helperText = "ไฟล์จะถูกพักไว้ในหน่วยความจำ และอัปโหลดจริงเมื่อกดบันทึกฟอร์มเท่านั้น",
  className,
}: DeferredFilePickerProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      // Reset input value so re-selecting same file triggers change
      e.target.value = "";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#000000]">{label}</label>
        <span className="text-xs text-[#737373] tabular-nums">
          {queuedFiles.length} ไฟล์รอส่ง
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
          className="rounded-full border-[#e5e5e5] bg-[#ffffff] text-xs hover:bg-[#fafafa]"
        >
          📎 เลือกไฟล์...
        </Button>
        <span className="text-xs text-[#737373]">{helperText}</span>
      </div>

      {queuedFiles.length > 0 && (
        <div className="space-y-2 pt-1">
          {queuedFiles.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="h-6 w-6 rounded-full object-cover border border-[#e5e5e5]"
                  />
                ) : (
                  <span className="text-sm">📄</span>
                )}
                <span className="font-mono truncate max-w-[200px] text-[#000000]">
                  {item.name}
                </span>
                <span className="text-[#737373] tabular-nums">
                  ({(item.size / 1024).toFixed(1)} KB)
                </span>
                <span className="rounded-full bg-[#ffbd2e]/20 text-[#966b0a] px-2 py-0.2 text-[10px] font-medium">
                  Staged (รอ Submit)
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(item.id)}
                disabled={isUploading}
                className="text-[#737373] hover:text-[#ff5f56] px-1 font-bold transition-colors"
                title="Remove file"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
