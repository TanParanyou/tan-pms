import { useState, useCallback, useEffect } from "react";

export interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  uploadedUrl?: string;
}

export interface UseDeferredFileUploadOptions {
  maxFiles?: number;
  maxSizeBytes?: number;
}

export function useDeferredFileUpload(options: UseDeferredFileUploadOptions = {}) {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageFiles = useCallback(
    (filesInput: FileList | File[] | File) => {
      setError(null);
      const rawList =
        filesInput instanceof File
          ? [filesInput]
          : Array.from(filesInput);

      const newQueued: QueuedFile[] = rawList.map((file) => {
        let previewUrl = "";
        if (typeof window !== "undefined" && window.URL && window.URL.createObjectURL) {
          try {
            previewUrl = window.URL.createObjectURL(file);
          } catch {
            previewUrl = "";
          }
        }
        return {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          name: file.name,
          size: file.size,
          previewUrl,
        };
      });

      setQueuedFiles((prev) => {
        const combined = [...prev, ...newQueued];
        if (options.maxFiles && combined.length > options.maxFiles) {
          return combined.slice(-options.maxFiles);
        }
        return combined;
      });
    },
    [options.maxFiles]
  );

  const removeFile = useCallback((id: string) => {
    setQueuedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl && typeof window !== "undefined" && window.URL?.revokeObjectURL) {
        try {
          window.URL.revokeObjectURL(target.previewUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setQueuedFiles((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl && typeof window !== "undefined" && window.URL?.revokeObjectURL) {
          try {
            window.URL.revokeObjectURL(f.previewUrl);
          } catch {
            // ignore
          }
        }
      });
      return [];
    });
  }, []);

  const commitUploads = useCallback(
    async <T = string>(uploaderFn: (file: File) => Promise<T>): Promise<T[]> => {
      if (queuedFiles.length === 0) return [];
      setIsUploading(true);
      setError(null);
      try {
        const results: T[] = [];
        for (const item of queuedFiles) {
          const res = await uploaderFn(item.file);
          results.push(res);
        }
        return results;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to upload files";
        setError(message);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [queuedFiles]
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      queuedFiles.forEach((f) => {
        if (f.previewUrl && typeof window !== "undefined" && window.URL?.revokeObjectURL) {
          try {
            window.URL.revokeObjectURL(f.previewUrl);
          } catch {
            // ignore
          }
        }
      });
    };
  }, [queuedFiles]);

  return {
    queuedFiles,
    stageFiles,
    removeFile,
    clearFiles,
    commitUploads,
    isUploading,
    error,
  };
}
