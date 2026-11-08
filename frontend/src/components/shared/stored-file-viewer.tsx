"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoSpinner } from "@/components/ui/mono-spinner";
import { apiClient } from "@/lib/api/api-client";

export interface StoredFileViewerProps {
  fileKey: string | null | undefined;
}

/** Fetches an authorized stored file as a blob and shows it as image or open-in-tab link. */
export function StoredFileViewer({ fileKey }: StoredFileViewerProps) {
  const t = useTranslations("common.files");
  const { data, isLoading, isError, refetch } = useQuery<Blob>({
    queryKey: ["stored-file", fileKey],
    queryFn: () => apiClient.downloadAdminFile(fileKey as string),
    enabled: Boolean(fileKey),
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const objectUrl = URL.createObjectURL(data);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [data]);

  if (!fileKey) return <span className="text-mute">-</span>;
  if (isLoading) return <MonoSpinner size="sm" label={t("loading")} />;
  if (isError) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
        <span>{t("loadError")}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void refetch()} className="h-7 rounded-full px-3 text-xs">
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (!data || !url) return null;
  if (data.type.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={t("imageAlt")} className="max-h-64 rounded-[12px] border border-hairline object-contain" />;
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => window.open(url, "_blank", "noopener")} className="h-8 rounded-full px-4 gap-1.5 text-xs">
      <FileText className="h-4 w-4" />
      <span>{t("openFile")}</span>
    </Button>
  );
}
