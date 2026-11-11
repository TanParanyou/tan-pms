import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import thMessages from "@/messages/th.json";
import { apiClient } from "@/lib/api/api-client";
import { ApiError } from "@/lib/api/api-error";
import { buildLoginUrl, sanitizeReturnTo } from "@/lib/auth/return-to";
import { getAccessToken, getAuthState, REFRESH_TOKEN_STORAGE_KEY, resetSessionForTests } from "@/lib/auth/session-store";
import { AuthProvider } from "@/components/shared/auth-provider";
import { RequireAuth } from "@/components/shared/require-auth";
import { LocaleProvider } from "@/components/shared/locale-provider";
import { ChangePasswordDialog } from "@/components/forms/change-password-dialog";
import { useSignOut } from "@/hooks/use-sign-out";
import { useToast } from "@/hooks/use-toast";
import { clearAllToasts, getActiveToasts } from "@/components/ui/toast";
import { LoginView } from "@/features/auth/components/LoginView";
import { AdminUserEditor } from "@/features/users/components/AdminUserEditor";
import { CustomerPortalAccountButton } from "@/features/leases/components/CustomerPortalAccountButton";
import { renderAdmin, signInAs } from "./test-utils";
import type { AdminUserDto } from "@/generated/api";

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/admin/leases",
  useSearchParams: () => searchParams,
}));

const au = thMessages.auth;
const cp = thMessages.auth.changePassword;
const rb = thMessages.admin.rbac;
const tc = thMessages.common;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const session = (n: number, scope: "admin" | "client" = "admin") => ({
  userId: "u-test",
  scope,
  displayName: "Test User",
  roleCode: "OrganizationAdmin",
  roleName: { th: "ผู้ดูแล", en: "Admin" },
  allowedProperties: [],
  permissions: ["*"],
  accessToken: `access-token-${n}`,
  accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  refreshToken: `refresh-token-${n}`,
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  tokenType: "Bearer",
});

const authHeader = (init: RequestInit | undefined) => new Headers(init?.headers).get("Authorization");

function wrap(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="th" messages={thMessages}>
        <LocaleProvider>{ui}</LocaleProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...result };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  searchParams = new URLSearchParams();
  resetSessionForTests();
  clearAllToasts();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetSessionForTests();
  window.history.pushState({}, "", "/");
});

describe("ApiClient bearer, single-flight refresh and failure handling", () => {
  it("attaches the bearer token and never sends X-TanPms-* headers", async () => {
    signInAs("admin");
    fetchMock.mockResolvedValue(json({ roles: [], permissions: [] }));
    await apiClient.getAdminRoles();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(authHeader(init)).toBe("Bearer access-token-1");
    expect([...new Headers(init.headers).keys()].some((k) => k.toLowerCase().startsWith("x-tanpms"))).toBe(false);
  });

  it("does not attach a bearer token to login", async () => {
    signInAs("admin");
    fetchMock.mockResolvedValue(json(session(2)));
    await apiClient.login({ scope: "admin", identifier: "a", password: "b" });
    expect(authHeader(fetchMock.mock.calls[0][1] as RequestInit)).toBeNull();
  });

  it("shares ONE refresh between concurrent 401s and retries each request once with the new token", async () => {
    signInAs("admin");
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: "refresh-token-1" });
        await Promise.resolve();
        return json(session(2));
      }
      return authHeader(init) === "Bearer access-token-2" ? json({ roles: [], permissions: [] }) : json({ errorCode: "auth.unauthenticated", title: "x" }, 401);
    });
    await Promise.all([apiClient.getAdminRoles(), apiClient.getAdminRoles(), apiClient.getAdminRoles()]);
    expect(refreshCalls).toBe(1);
    expect(fetchMock.mock.calls.filter((c) => !String(c[0]).endsWith("/auth/refresh"))).toHaveLength(6);
    expect(getAccessToken()).toBe("access-token-2");
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe("refresh-token-2");
  });

  it("retries only once: a second 401 ends the session instead of looping", async () => {
    signInAs("admin");
    const onFailure = vi.fn();
    apiClient.setAuthFailureHandler(onFailure);
    fetchMock.mockImplementation(async (url: string) => (url.endsWith("/auth/refresh") ? json(session(2)) : json({ errorCode: "auth.unauthenticated", title: "x" }, 401)));
    await expect(apiClient.getAdminRoles()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenCalledTimes(1);
    apiClient.setAuthFailureHandler(null);
  });

  it("keeps 403 as a permission error without touching the session", async () => {
    signInAs("admin");
    const onFailure = vi.fn();
    apiClient.setAuthFailureHandler(onFailure);
    fetchMock.mockResolvedValue(json({ errorCode: "auth.permission_denied", title: "x" }, 403));
    await expect(apiClient.getAdminRoles()).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(getAuthState().status).toBe("authenticated");
    apiClient.setAuthFailureHandler(null);
  });

  it("surfaces 429 with Retry-After as a localized retry-later toast", async () => {
    signInAs("admin");
    fetchMock.mockResolvedValue(json({ errorCode: "auth.rate_limited", title: "x" }, 429, { "Retry-After": "30" }));
    const err = await apiClient.getAdminRoles().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 429, retryAfterSeconds: 30 });
    const { result } = renderHook(() => useToast());
    act(() => result.current.toastApiError(err));
    const message = getActiveToasts()[0].message;
    expect(message).toContain(thMessages.errors.auth_rate_limited);
    expect(message).toContain("30");
  });

  it("refresh failure clears the session and redirects to login keeping a safe returnTo", async () => {
    signInAs("admin");
    window.history.pushState({}, "", "/admin/leases?tab=due");
    fetchMock.mockImplementation(async (url: string) => (url.endsWith("/auth/refresh") ? json({ errorCode: "auth.refresh_token_invalid", title: "x" }, 401) : json({ errorCode: "auth.unauthenticated", title: "x" }, 401)));
    const { queryClient } = wrap(<AuthProvider><div /></AuthProvider>);
    queryClient.setQueryData(["secret"], 1);
    await expect(apiClient.getAdminRoles()).rejects.toBeInstanceOf(ApiError);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?scope=admin&returnTo=%2Fadmin%2Fleases%3Ftab%3Ddue"));
    expect(getAuthState().status).toBe("unauthenticated");
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(queryClient.getQueryData(["secret"])).toBeUndefined();
  });

  it("rejects absolute, protocol-relative, scheme and cross-scope returnTo values", () => {
    expect(sanitizeReturnTo("/admin/leases?x=1", "admin")).toBe("/admin/leases?x=1");
    expect(sanitizeReturnTo("https://evil.example/admin", "admin")).toBeNull();
    expect(sanitizeReturnTo("//evil.example", "admin")).toBeNull();
    expect(sanitizeReturnTo("/\\evil.example", "admin")).toBeNull();
    expect(sanitizeReturnTo("/admin/..//x://y", "admin")).toBeNull();
    expect(sanitizeReturnTo("/client/dashboard", "admin")).toBeNull();
    expect(sanitizeReturnTo("%2F%2Fevil.example", "admin")).toBeNull();
    expect(buildLoginUrl("admin", "https://evil.example")).toBe("/login?scope=admin");
  });
});

describe("session restore and route guards", () => {
  it("restores the session from the refresh token after a reload, showing PageLoading meanwhile", async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, "refresh-token-9");
    let release: (r: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)));
    wrap(
      <AuthProvider>
        <RequireAuth scope="admin">
          <div>protected-content</div>
        </RequireAuth>
      </AuthProvider>
    );
    expect(screen.getByText(au.restoringSession)).toBeInTheDocument();
    expect(screen.queryByText("protected-content")).not.toBeInTheDocument();
    await act(async () => release(json(session(3))));
    expect(await screen.findByText("protected-content")).toBeInTheDocument();
    expect(getAccessToken()).toBe("access-token-3");
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends unauthenticated visitors to login with the current path as returnTo", async () => {
    window.history.pushState({}, "", "/admin/leases");
    wrap(
      <AuthProvider>
        <RequireAuth scope="admin">
          <div>protected-content</div>
        </RequireAuth>
      </AuthProvider>
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?scope=admin&returnTo=%2Fadmin%2Fleases"));
    expect(screen.queryByText("protected-content")).not.toBeInTheDocument();
  });

  it("sends a client session that opens the admin area back to its own area (and vice versa)", async () => {
    signInAs("client");
    wrap(<RequireAuth scope="admin"><div>protected-content</div></RequireAuth>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/client/dashboard"));
    expect(screen.queryByText("protected-content")).not.toBeInTheDocument();
  });

  it("logs out other tabs: a broadcast logout ends this session locally", async () => {
    signInAs("admin");
    wrap(<AuthProvider><div /></AuthProvider>);
    const other = new BroadcastChannel("tan-pms-auth");
    other.postMessage({ type: "logout" });
    await waitFor(() => expect(getAuthState().status).toBe("unauthenticated"), { timeout: 2000 });
    other.close();
  });
});

describe("login form", () => {
  const fill = (id: string, password: string) => {
    fireEvent.change(screen.getByLabelText(au.username), { target: { value: id } });
    fireEvent.change(screen.getByLabelText(au.password), { target: { value: password } });
  };

  it("signs in, keeps tokens out of localStorage and URLs and goes to the admin home", async () => {
    fetchMock.mockResolvedValue(json(session(1)));
    wrap(<LoginView />);
    expect(screen.getByLabelText(au.password)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(au.password)).toHaveAttribute("autocomplete", "current-password");
    fill("admin", "correct-horse-battery");
    fireEvent.click(screen.getByRole("button", { name: au.loginAsAdmin }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/rack"));
    expect(window.localStorage.length).toBe(0);
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/token/i);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ scope: "admin", identifier: "admin", password: "correct-horse-battery" });
    expect(window.location.href).not.toMatch(/token/i);
  });

  it("honours a safe returnTo", async () => {
    fetchMock.mockResolvedValue(json(session(1)));
    searchParams = new URLSearchParams({ returnTo: "/admin/leases?x=1" });
    wrap(<LoginView />);
    fill("admin", "correct-horse-battery");
    fireEvent.click(screen.getByRole("button", { name: au.loginAsAdmin }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/leases?x=1"));
  });

  it("ignores an external returnTo", async () => {
    fetchMock.mockResolvedValue(json(session(1)));
    searchParams = new URLSearchParams({ returnTo: "https://evil.example" });
    wrap(<LoginView />);
    fill("admin", "correct-horse-battery");
    fireEvent.click(screen.getByRole("button", { name: au.loginAsAdmin }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/rack"));
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("evil"));
  });

  it("shows one generic message for invalid credentials and clears the password", async () => {
    fetchMock.mockResolvedValue(json({ errorCode: "auth.invalid_credentials", title: "x" }, 401));
    wrap(<LoginView />);
    fill("admin", "wrong-password-1");
    fireEvent.click(screen.getByRole("button", { name: au.loginAsAdmin }));
    expect(await screen.findByText(au.errorInvalidCredentials)).toBeInTheDocument();
    expect((screen.getByLabelText(au.password) as HTMLInputElement).value).toBe("");
    expect(replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the lockout / rate limit message with the retry time", async () => {
    fetchMock.mockResolvedValue(json({ errorCode: "auth.rate_limited", title: "x" }, 429, { "Retry-After": "45" }));
    wrap(<LoginView />);
    fill("admin", "wrong-password-1");
    fireEvent.click(screen.getByRole("button", { name: au.loginAsAdmin }));
    expect(await screen.findByText(au.errorRateLimitedWithSeconds.replace("{seconds}", "45"))).toBeInTheDocument();
  });

  it("guards against double submit while the request is pending", async () => {
    let release: (r: Response) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)));
    wrap(<LoginView />);
    fill("admin", "correct-horse-battery");
    const form = screen.getByRole("button", { name: au.loginAsAdmin }).closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: au.signingIn })).toBeDisabled();
    await act(async () => release(json(session(1))));
  });
});

describe("sign-out", () => {
  it("clears session, cache and storage and routes to login even when the API fails", async () => {
    signInAs("admin");
    fetchMock.mockRejectedValue(new Error("offline"));
    const queryClient = new QueryClient();
    queryClient.setQueryData(["secret"], 1);
    const { result } = renderHook(() => useSignOut(), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });
    await act(async () => result.current.signOut());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ refreshToken: "refresh-token-1" });
    expect(getAuthState().status).toBe("unauthenticated");
    expect(getAccessToken()).toBeNull();
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(queryClient.getQueryData(["secret"])).toBeUndefined();
    expect(push).toHaveBeenCalledWith("/login?scope=admin");
  });
});

describe("change password", () => {
  const open = () => wrap(<ChangePasswordDialog open onOpenChange={() => undefined} />);
  const typeInto = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

  it("validates policy and confirmation before calling the API", async () => {
    const spy = vi.spyOn(apiClient, "changePassword").mockResolvedValue(undefined);
    open();
    typeInto(cp.current, "old-password-1");
    typeInto(cp.new, "short");
    typeInto(cp.confirm, "short");
    fireEvent.click(screen.getByRole("button", { name: cp.submit }));
    expect(await screen.findByText(cp.errorPolicy.replace("{min}", "10"))).toBeInTheDocument();
    typeInto(cp.new, "a-long-new-password");
    typeInto(cp.confirm, "different-password");
    fireEvent.click(screen.getByRole("button", { name: cp.submit }));
    expect(await screen.findByText(cp.errorMismatch)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("changes the password, explains that every session ended and goes to login", async () => {
    signInAs("admin");
    const spy = vi.spyOn(apiClient, "changePassword").mockResolvedValue(undefined);
    open();
    typeInto(cp.current, "old-password-1");
    typeInto(cp.new, "a-long-new-password");
    typeInto(cp.confirm, "a-long-new-password");
    fireEvent.click(screen.getByRole("button", { name: cp.submit }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ currentPassword: "old-password-1", newPassword: "a-long-new-password" }));
    expect(await screen.findByText(cp.doneMessage)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: cp.goToLogin }));
    expect(getAuthState().status).toBe("unauthenticated");
    expect(push).toHaveBeenCalledWith("/login?scope=admin");
  });
});

describe("admin user passwords", () => {
  const user = (): AdminUserDto => ({
    id: "u1",
    username: "mali",
    fullName: "Mali Dee",
    email: "mali@tan-pms.internal",
    roleCode: "FrontDesk",
    roleName: { th: "พนักงานต้อนรับ", en: "Front desk" },
    isActive: true,
    allowedProperties: [],
    permissions: [],
  });

  it("resets a password only after the confirmation modal, without showing it back", async () => {
    vi.spyOn(apiClient, "getAdminUser").mockResolvedValue(user());
    vi.spyOn(apiClient, "getAdminRoles").mockResolvedValue({ roles: [{ code: "FrontDesk", name: { th: "พนักงานต้อนรับ", en: "Front desk" }, scope: "AdminScope", defaultPermissions: [] }], permissions: [] });
    const reset = vi.spyOn(apiClient, "resetAdminUserPassword").mockResolvedValue(user());
    renderAdmin(<AdminUserEditor userId="u1" />);
    fireEvent.click(await screen.findByRole("button", { name: rb.btnResetPassword }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(au.setPassword.password), { target: { value: "short" } });
    fireEvent.click(within(dialog).getByRole("button", { name: rb.btnResetPassword }));
    expect(await within(dialog).findByText(au.setPassword.errorPolicy.replace("{min}", "10"))).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByPlaceholderText(au.setPassword.password), { target: { value: "brand-new-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: rb.btnResetPassword }));
    const confirm = await screen.findByRole("alertdialog");
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: rb.btnResetPassword }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith("u1", "brand-new-password"));
    await waitFor(() => expect(getActiveToasts().map((t) => t.message)).toContain(rb.toastPasswordReset));
  });

  it("creates a portal account with identifier and initial password after confirmation", async () => {
    const account = vi.spyOn(apiClient, "upsertCustomerAccount").mockResolvedValue({ customerId: "c1", loginIdentifier: "somchai@example.com", isActive: true });
    renderAdmin(<CustomerPortalAccountButton customerId="c1" />, ["admin.leases.manage"]);
    fireEvent.click(screen.getByRole("button", { name: au.portalAccount.button }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(au.portalAccount.identifierPlaceholder), { target: { value: "somchai@example.com" } });
    fireEvent.change(within(dialog).getByPlaceholderText(au.setPassword.password), { target: { value: "initial-password-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: au.portalAccount.action }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: au.portalAccount.action }));
    await waitFor(() => expect(account).toHaveBeenCalledWith("c1", { loginIdentifier: "somchai@example.com", initialPassword: "initial-password-1" }));
  });

  it("hides the portal account action without the required permission", () => {
    renderAdmin(<CustomerPortalAccountButton customerId="c1" />, ["admin.rack.view"]);
    expect(screen.queryByRole("button", { name: au.portalAccount.button })).not.toBeInTheDocument();
    expect(tc.cancel).toBeTruthy();
  });
});
