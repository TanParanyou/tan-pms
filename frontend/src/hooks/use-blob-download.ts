"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export type BlobDownloadMode = "save" | "open";

/** Central download/open helper for authorized binary endpoints (PDFs, stored files). */
export function useBlobDownload() {
  const { toastApiError } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const download = useCallback(
    async (fetcher: () => Promise<Blob>, filename: string, mode: BlobDownloadMode = "save") => {
      setIsDownloading(true);
      try {
        const blob = await fetcher();
        const url = URL.createObjectURL(blob);
        if (mode === "open") {
          window.open(url, "_blank", "noopener");
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (err) {
        toastApiError(err);
      } finally {
        setIsDownloading(false);
      }
    },
    [toastApiError]
  );

  return { download, isDownloading };
}
