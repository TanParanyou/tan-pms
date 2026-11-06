import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeferredFileUpload } from "@/hooks/use-deferred-file-upload";

describe("useDeferredFileUpload Hook", () => {
  it("should stage files in memory without calling the upload function", () => {
    const { result } = renderHook(() => useDeferredFileUpload());

    const mockFile1 = new File(["dummy content 1"], "slip.jpg", { type: "image/jpeg" });
    const mockFile2 = new File(["dummy content 2"], "meter.png", { type: "image/png" });

    // Stage files
    act(() => {
      result.current.stageFiles([mockFile1, mockFile2]);
    });

    // Check queued files in memory
    expect(result.current.queuedFiles).toHaveLength(2);
    expect(result.current.queuedFiles[0].name).toBe("slip.jpg");
    expect(result.current.queuedFiles[1].name).toBe("meter.png");
    expect(result.current.queuedFiles[0].previewUrl).toBeDefined();
    expect(result.current.isUploading).toBe(false);
  });

  it("should remove staged file by id correctly", () => {
    const { result } = renderHook(() => useDeferredFileUpload());

    const mockFile = new File(["dummy"], "idcard.pdf", { type: "application/pdf" });

    act(() => {
      result.current.stageFiles([mockFile]);
    });

    const fileId = result.current.queuedFiles[0].id;
    expect(result.current.queuedFiles).toHaveLength(1);

    act(() => {
      result.current.removeFile(fileId);
    });

    expect(result.current.queuedFiles).toHaveLength(0);
  });

  it("should only call upload function when commitUploads is explicitly invoked on submit", async () => {
    const { result } = renderHook(() => useDeferredFileUpload());

    const mockUploader = vi.fn().mockImplementation(async (file: File) => {
      return `https://storage.tan-pms.internal/uploads/${file.name}`;
    });

    const mockFile = new File(["content"], "transfer-slip.jpg", { type: "image/jpeg" });

    // Step 1: User selects file -> staged in memory
    act(() => {
      result.current.stageFiles(mockFile);
    });

    // Crucial check: Uploader function must NOT have been called yet!
    expect(mockUploader).not.toHaveBeenCalled();
    expect(result.current.queuedFiles).toHaveLength(1);

    // Step 2: User submits form -> commitUploads is called
    let uploadResults: string[] = [];
    await act(async () => {
      uploadResults = await result.current.commitUploads(mockUploader);
    });

    // Verify upload function was called on form commit
    expect(mockUploader).toHaveBeenCalledTimes(1);
    expect(mockUploader).toHaveBeenCalledWith(mockFile);
    expect(uploadResults).toEqual(["https://storage.tan-pms.internal/uploads/transfer-slip.jpg"]);
    expect(result.current.isUploading).toBe(false);
  });
});
