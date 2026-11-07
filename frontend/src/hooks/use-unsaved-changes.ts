import { useEffect } from "react";

export function useUnsavedChanges(isDirty: boolean): { isDirty: boolean } {
  useEffect(() => {
    if (typeof window === "undefined" || !isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  return { isDirty };
}
