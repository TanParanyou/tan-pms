"use client";

import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";
import { apiClient } from "@/lib/api/api-client";
import type { StoredFilePurpose } from "@/features/files/types";

/** Single deferred attachment: staged in memory, uploaded only when commit() runs inside onSubmit. */
export function useStagedPhoto(propertyId: string, purpose: StoredFilePurpose) {
  const upload = useDeferredFileUpload({ maxFiles: 1 });
  const { queuedFiles, commitUploads, clearFiles } = upload;

  /** Returns the new fileKey if a file is staged, otherwise the existing key. Throws on upload failure. */
  const commit = async (existingKey?: string | null): Promise<string | undefined> => {
    if (queuedFiles.length === 0) return existingKey ?? undefined;
    const [stored] = await commitUploads((file) => apiClient.uploadAdminFile(propertyId, purpose, file));
    return stored.fileKey;
  };

  return { ...upload, commit, clear: clearFiles };
}
