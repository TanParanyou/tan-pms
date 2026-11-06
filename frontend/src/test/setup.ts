import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock window.URL methods in test environment
if (typeof window !== "undefined") {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn((file: File) => `blob:mock-url/${file.name}`);
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }
}
