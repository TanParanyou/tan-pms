import type {
  RoomRackResponse,
  CheckInStayRequest,
  StaySummaryDto,
  ClientDashboardResponse,
  ProblemDetailsResponse,
  LoginRequest,
  AuthSessionResponse,
  RoleCatalogResponse,
  AdminUserListResponse,
  AdminUserDto,
  UpsertAdminUserRequest,
  DispatchNotificationRequest,
  NotificationItemDto,
  NotificationListResponse,
  PropertyHierarchyResponse,
  UpsertUnitMasterRequest,
  UnitMasterItemDto,
  PropertyRateCatalogResponse,
  UpsertRatePlanRequest,
  RatePlanItemDto,
  UpsertUtilityTariffRequest,
  UtilityTariffItemDto,
  UpsertTaxProfileRequest,
  TaxProfileItemDto,
  RateSimulationRequest,
  RateSimulationResponse,
  AvailabilitySearchResponse,
  ReservationListResponse,
  CreateAdminReservationRequest,
  ReservationItemDto,
  AssignReservationUnitRequest,
  CancelReservationRequest,
  CreateClientHoldReservationRequest,
  SubmitReservationSlipRequest,
  StayListResponse,
  StayDetailDto,
  ExtendStayRequest,
  AddFolioChargeRequest,
  RecordFolioPaymentRequest,
  CheckOutStayRequest,
  RegulatoryExportResponse,
} from "@/generated/api";
import type {
  LeaseListResponse,
  LeaseItemDto,
  LeaseSettlementDto,
  CreateLeaseRequest,
  LeaseOccupantRequest,
  LeaseVehicleRequest,
  RenewLeaseRequest,
  SettleLeaseMoveOutRequest,
  LeaseStatusType,
  CustomerListResponse,
} from "@/features/leases/types";
import { ApiError } from "./api-error";

export interface ApiClientConfig {
  baseUrl?: string;
  defaultScope?: "AdminScope" | "ClientScope";
  defaultPropertyId?: string;
}

export class ApiClient {
  private baseUrl: string;
  private defaultScope?: "AdminScope" | "ClientScope";
  private defaultPropertyId?: string;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? "";
    this.defaultScope = config.defaultScope;
    this.defaultPropertyId = config.defaultPropertyId;
  }

  public setScope(scope: "AdminScope" | "ClientScope") {
    this.defaultScope = scope;
  }

  public setPropertyId(propertyId: string) {
    this.defaultPropertyId = propertyId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json, application/problem+json");

    if (this.defaultScope && !headers.has("X-TanPms-Scope")) {
      headers.set("X-TanPms-Scope", this.defaultScope);
    }
    if (this.defaultPropertyId && !headers.has("X-TanPms-Property-Id")) {
      headers.set("X-TanPms-Property-Id", this.defaultPropertyId);
    }

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw ApiError.fromAbort();
      }
      throw new ApiError({
        status: 0,
        errorCode: "network.error",
        message: err instanceof Error ? err.message : "Network failure",
      });
    }

    if (!response.ok) {
      let problemDetails: ProblemDetailsResponse | null = null;
      try {
        problemDetails = (await response.json()) as ProblemDetailsResponse;
      } catch {
        // Response was not JSON
      }

      if (problemDetails && (problemDetails.errorCode || problemDetails.title)) {
        throw ApiError.fromProblemDetails(response.status, problemDetails);
      }

      throw ApiError.fromUnknown(response.status);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  // --- 1. Auth APIs ---
  async login(req: LoginRequest): Promise<AuthSessionResponse> {
    return this.request<AuthSessionResponse>(`/api/v1/auth/login`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async getMe(): Promise<AuthSessionResponse> {
    return this.request<AuthSessionResponse>(`/api/v1/auth/me`, {
      method: "GET",
    });
  }

  // --- 2. RBAC & Notifications APIs ---
  async getAdminRoles(): Promise<RoleCatalogResponse> {
    return this.request<RoleCatalogResponse>(`/api/v1/admin/roles`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async getAdminUsers(): Promise<AdminUserListResponse> {
    return this.request<AdminUserListResponse>(`/api/v1/admin/users`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async upsertAdminUser(req: UpsertAdminUserRequest): Promise<AdminUserDto> {
    return this.request<AdminUserDto>(`/api/v1/admin/users`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async dispatchAdminNotification(req: DispatchNotificationRequest): Promise<NotificationItemDto> {
    return this.request<NotificationItemDto>(`/api/v1/admin/notifications/dispatch`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async getClientNotifications(): Promise<NotificationListResponse> {
    return this.request<NotificationListResponse>(`/api/v1/client/notifications`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "ClientScope" },
    });
  }

  // --- 3. Properties & Units APIs ---
  async getAdminPropertyHierarchy(propertyId: string): Promise<PropertyHierarchyResponse> {
    return this.request<PropertyHierarchyResponse>(`/api/v1/admin/properties/${propertyId}/hierarchy`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async upsertAdminUnitMaster(propertyId: string, req: UpsertUnitMasterRequest): Promise<UnitMasterItemDto> {
    return this.request<UnitMasterItemDto>(`/api/v1/admin/properties/${propertyId}/units`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  // --- 4. Rates, Tariffs & Taxes APIs ---
  async getAdminPropertyRates(propertyId: string): Promise<PropertyRateCatalogResponse> {
    return this.request<PropertyRateCatalogResponse>(`/api/v1/admin/properties/${propertyId}/rates`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async upsertAdminRatePlan(propertyId: string, req: UpsertRatePlanRequest): Promise<RatePlanItemDto> {
    return this.request<RatePlanItemDto>(`/api/v1/admin/properties/${propertyId}/rates/plans`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async upsertAdminUtilityTariff(propertyId: string, req: UpsertUtilityTariffRequest): Promise<UtilityTariffItemDto> {
    return this.request<UtilityTariffItemDto>(`/api/v1/admin/properties/${propertyId}/rates/utilities`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async upsertAdminTaxProfile(propertyId: string, req: UpsertTaxProfileRequest): Promise<TaxProfileItemDto> {
    return this.request<TaxProfileItemDto>(`/api/v1/admin/properties/${propertyId}/rates/taxes`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async simulateAdminRateAndTax(propertyId: string, req: RateSimulationRequest): Promise<RateSimulationResponse> {
    return this.request<RateSimulationResponse>(`/api/v1/admin/properties/${propertyId}/rates/simulate`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  // --- 5. Availability & Reservations APIs ---
  async getAdminAvailability(
    propertyId: string,
    params: { checkIn: string; checkOut: string; stayMode?: string }
  ): Promise<AvailabilitySearchResponse> {
    const query = new URLSearchParams({
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      ...(params.stayMode ? { stayMode: params.stayMode } : {}),
    });
    return this.request<AvailabilitySearchResponse>(
      `/api/v1/admin/properties/${propertyId}/availability?${query.toString()}`,
      {
        method: "GET",
        headers: { "X-TanPms-Scope": "AdminScope" },
      }
    );
  }

  async getAdminReservations(propertyId: string): Promise<ReservationListResponse> {
    return this.request<ReservationListResponse>(`/api/v1/admin/properties/${propertyId}/reservations`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async createAdminReservation(propertyId: string, req: CreateAdminReservationRequest): Promise<ReservationItemDto> {
    return this.request<ReservationItemDto>(`/api/v1/admin/properties/${propertyId}/reservations`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async assignAdminReservationUnit(
    propertyId: string,
    reservationId: string,
    req: AssignReservationUnitRequest
  ): Promise<ReservationItemDto> {
    return this.request<ReservationItemDto>(
      `/api/v1/admin/properties/${propertyId}/reservations/${reservationId}/assign-unit`,
      {
        method: "POST",
        headers: { "X-TanPms-Scope": "AdminScope" },
        body: JSON.stringify(req),
      }
    );
  }

  async confirmAdminReservation(propertyId: string, reservationId: string): Promise<ReservationItemDto> {
    return this.request<ReservationItemDto>(
      `/api/v1/admin/properties/${propertyId}/reservations/${reservationId}/confirm`,
      {
        method: "POST",
        headers: { "X-TanPms-Scope": "AdminScope" },
      }
    );
  }

  async cancelAdminReservation(
    propertyId: string,
    reservationId: string,
    req: CancelReservationRequest
  ): Promise<ReservationItemDto> {
    return this.request<ReservationItemDto>(
      `/api/v1/admin/properties/${propertyId}/reservations/${reservationId}/cancel`,
      {
        method: "POST",
        headers: { "X-TanPms-Scope": "AdminScope" },
        body: JSON.stringify(req),
      }
    );
  }

  async getClientAvailability(params: {
    propertyId: string;
    checkIn: string;
    checkOut: string;
    stayMode?: string;
  }): Promise<AvailabilitySearchResponse> {
    const query = new URLSearchParams({
      propertyId: params.propertyId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      ...(params.stayMode ? { stayMode: params.stayMode } : {}),
    });
    return this.request<AvailabilitySearchResponse>(`/api/v1/client/availability?${query.toString()}`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "ClientScope" },
    });
  }

  async getClientReservations(): Promise<ReservationListResponse> {
    return this.request<ReservationListResponse>(`/api/v1/client/reservations`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "ClientScope" },
    });
  }

  async createClientHoldReservation(req: CreateClientHoldReservationRequest): Promise<ReservationItemDto> {
    return this.request<ReservationItemDto>(`/api/v1/client/reservations/hold`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "ClientScope" },
      body: JSON.stringify(req),
    });
  }

  async submitClientReservationSlip(
    reservationId: string,
    req: SubmitReservationSlipRequest
  ): Promise<ReservationItemDto> {
    return this.request<ReservationItemDto>(`/api/v1/client/reservations/${reservationId}/slip`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "ClientScope" },
      body: JSON.stringify(req),
    });
  }

  // --- 6. Room Rack & Stays APIs ---
  async getAdminRoomRack(propertyId: string): Promise<RoomRackResponse> {
    return this.request<RoomRackResponse>(`/api/v1/admin/properties/${propertyId}/rack`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async checkInStay(req: CheckInStayRequest): Promise<StaySummaryDto> {
    return this.request<StaySummaryDto>(`/api/v1/admin/stays/check-in`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async getAdminStays(propertyId: string): Promise<StayListResponse> {
    return this.request<StayListResponse>(`/api/v1/admin/properties/${propertyId}/stays`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async extendAdminStay(propertyId: string, stayId: string, req: ExtendStayRequest): Promise<StayDetailDto> {
    return this.request<StayDetailDto>(`/api/v1/admin/properties/${propertyId}/stays/${stayId}/extend`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async addAdminFolioCharge(propertyId: string, stayId: string, req: AddFolioChargeRequest): Promise<StayDetailDto> {
    return this.request<StayDetailDto>(`/api/v1/admin/properties/${propertyId}/stays/${stayId}/folio/charges`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async recordAdminFolioPayment(
    propertyId: string,
    stayId: string,
    req: RecordFolioPaymentRequest
  ): Promise<StayDetailDto> {
    return this.request<StayDetailDto>(`/api/v1/admin/properties/${propertyId}/stays/${stayId}/folio/payments`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async checkOutAdminStay(propertyId: string, stayId: string, req: CheckOutStayRequest): Promise<StayDetailDto> {
    return this.request<StayDetailDto>(`/api/v1/admin/properties/${propertyId}/stays/${stayId}/check-out`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async getAdminRegulatoryExports(propertyId: string): Promise<RegulatoryExportResponse> {
    return this.request<RegulatoryExportResponse>(`/api/v1/admin/properties/${propertyId}/regulatory-exports`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  // --- 6b. Monthly Leases APIs (PM-06) ---
  async getAdminLeases(
    propertyId: string,
    params: { status?: LeaseStatusType; licensePlate?: string } = {}
  ): Promise<LeaseListResponse> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.licensePlate) qs.set("licensePlate", params.licensePlate);
    const query = qs.toString();
    return this.request<LeaseListResponse>(
      `/api/v1/admin/properties/${propertyId}/leases${query ? `?${query}` : ""}`,
      { method: "GET", headers: { "X-TanPms-Scope": "AdminScope" } }
    );
  }

  async getAdminLease(propertyId: string, leaseId: string): Promise<LeaseItemDto> {
    return this.request<LeaseItemDto>(`/api/v1/admin/properties/${propertyId}/leases/${leaseId}`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async searchAdminCustomers(propertyId: string, search = ""): Promise<CustomerListResponse> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return this.request<CustomerListResponse>(`/api/v1/admin/properties/${propertyId}/customers${query}`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async createAdminLease(propertyId: string, req: CreateLeaseRequest): Promise<LeaseItemDto> {
    return this.request<LeaseItemDto>(`/api/v1/admin/properties/${propertyId}/leases`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async addAdminLeaseOccupant(propertyId: string, leaseId: string, req: LeaseOccupantRequest): Promise<LeaseItemDto> {
    return this.request<LeaseItemDto>(`/api/v1/admin/properties/${propertyId}/leases/${leaseId}/occupants`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async addAdminLeaseVehicle(propertyId: string, leaseId: string, req: LeaseVehicleRequest): Promise<LeaseItemDto> {
    return this.request<LeaseItemDto>(`/api/v1/admin/properties/${propertyId}/leases/${leaseId}/vehicles`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async renewAdminLease(propertyId: string, leaseId: string, req: RenewLeaseRequest): Promise<LeaseItemDto> {
    return this.request<LeaseItemDto>(`/api/v1/admin/properties/${propertyId}/leases/${leaseId}/renew`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async giveAdminLeaseMoveOutNotice(propertyId: string, leaseId: string): Promise<LeaseItemDto> {
    return this.request<LeaseItemDto>(`/api/v1/admin/properties/${propertyId}/leases/${leaseId}/move-out-notice`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async settleAdminLeaseMoveOut(
    propertyId: string,
    leaseId: string,
    req: SettleLeaseMoveOutRequest
  ): Promise<LeaseSettlementDto> {
    return this.request<LeaseSettlementDto>(`/api/v1/admin/properties/${propertyId}/leases/${leaseId}/settle-move-out`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  // --- 7. Client Dashboard API ---
  async getClientDashboard(): Promise<ClientDashboardResponse> {
    return this.request<ClientDashboardResponse>(`/api/v1/client/dashboard`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "ClientScope" },
    });
  }
}

export const apiClient = new ApiClient();
