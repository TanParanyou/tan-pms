/** Maps /admin/<segment>/... to the camelCase key used by admin.nav translations (lease-intents -> leaseIntents). */
export function adminModuleKeyFromPath(pathname: string): string {
  const segment = pathname.split("/")[2] || "rack";
  return segment.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
