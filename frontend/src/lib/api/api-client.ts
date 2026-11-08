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
import type {
  MeterReadingSheetResponse,
  MeterReadingSheetRowDto,
  SaveMeterReadingsRequest,
  SaveMeterReadingsResponse,
  BatchInvoiceRunRequest,
  BatchInvoiceRunResponse,
  InvoiceListResponse,
  InvoiceIssueResponse,
  InvoiceItemDto,
  IssueInvoicesRequest,
} from "@/features/billing/types";
import type {
  CashierShiftDto,
  CashierShiftListResponse,
  CurrentCashierShiftResponse,
  OpenCashierShiftRequest,
  CloseCashierShiftRequest,
  ReconcileCashierShiftRequest,
} from "@/features/cashier/types";
import type { DepositLedgerListResponse } from "@/features/deposits/types";
import type {
  PaymentSlipQueueResponse,
  AdminPaymentSlipDto,
  RejectPaymentSlipRequest,
} from "@/features/payments/types";
import type {
  UpdateLeaseRequest,
  UpdateLeaseOccupantRequest,
} from "@/features/leases/types";
import type { InvoiceLineRequest } from "@/features/billing/types";
import type { UpdateCashierShiftRemarkRequest } from "@/features/cashier/types";
import type { DepositLedgerItemDto } from "@/features/deposits/types";
import type {
  HousekeepingTaskDto,
  HousekeepingTaskListResponse,
  CreateHousekeepingTaskRequest,
  CompleteHousekeepingTaskRequest,
  AssignHousekeepingTaskRequest,
  UpdateHousekeepingTaskRequest,
} from "@/features/housekeeping/types";
import type {
  WorkOrderItemDto,
  WorkOrderListResponse,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
  AssignWorkOrderRequest,
  ResolveWorkOrderRequest,
} from "@/features/work-orders/types";
import type {
  ParcelItemDto,
  ParcelListResponse,
  ReceiveParcelRequest,
  PickUpParcelRequest,
} from "@/features/parcels/types";
import type { ReceiptListResponse, StoredFileDto, StoredFilePurpose } from "@/features/files/types";
import type {
  LeaseIntentDto,
  LeaseIntentListResponse,
  CreateLeaseIntentRequest,
  UpdateLeaseIntentRequest,
  ClientInvoiceDto,
  ClientInvoiceListResponse,
  ClientPaymentSlipDto,
  ClientPaymentSlipListResponse,
  SubmitPaymentSlipRequest,
  ClientUtilityUsageResponse,
  AnalyticsReportKind,
} from "@/features/client/types";
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

  private async fetchOk(endpoint: string, options: RequestInit, accept: string): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", accept);

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
    return response;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await this.fetchOk(endpoint, options, "application/json, application/problem+json");
    if (response.status === 204) {
      return undefined as unknown as T;
    }
    return (await response.json()) as T;
  }

  private async requestBlob(endpoint: string, scope: "AdminScope" | "ClientScope" = "AdminScope"): Promise<Blob> {
    const response = await this.fetchOk(
      endpoint,
      { method: "GET", headers: { "X-TanPms-Scope": scope } },
      "*/*, application/problem+json"
    );
    return response.blob();
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
      slotStartAt: params.checkIn,
      slotEndAt: params.checkOut,
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
    slotStartAt: string;
    slotEndAt: string;
    stayMode: string;
  }): Promise<AvailabilitySearchResponse> {
    const query = new URLSearchParams(params);
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

  // --- 6c. Bulk Meter Readings & Batch Billing APIs (PM-07) ---
  async getAdminMeterReadingSheet(
    propertyId: string,
    params: { period: string; buildingId?: string }
  ): Promise<MeterReadingSheetResponse> {
    const qs = new URLSearchParams({ period: params.period });
    if (params.buildingId) qs.set("buildingId", params.buildingId);
    return this.request<MeterReadingSheetResponse>(
      `/api/v1/admin/properties/${propertyId}/meter-readings?${qs.toString()}`,
      { method: "GET", headers: { "X-TanPms-Scope": "AdminScope" } }
    );
  }

  async saveAdminMeterReadings(
    propertyId: string,
    req: SaveMeterReadingsRequest
  ): Promise<SaveMeterReadingsResponse> {
    return this.request<SaveMeterReadingsResponse>(`/api/v1/admin/properties/${propertyId}/meter-readings`, {
      method: "PUT",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async runAdminBatchInvoices(propertyId: string, req: BatchInvoiceRunRequest): Promise<BatchInvoiceRunResponse> {
    return this.request<BatchInvoiceRunResponse>(
      `/api/v1/admin/properties/${propertyId}/billing/batch-invoice-runs`,
      { method: "POST", headers: { "X-TanPms-Scope": "AdminScope" }, body: JSON.stringify(req) }
    );
  }

  async issueAdminInvoicesForPeriod(propertyId: string, req: IssueInvoicesRequest): Promise<InvoiceIssueResponse> {
    return this.request<InvoiceIssueResponse>(
      `/api/v1/admin/properties/${propertyId}/billing/batch-invoice-runs/issue`,
      { method: "POST", headers: { "X-TanPms-Scope": "AdminScope" }, body: JSON.stringify(req) }
    );
  }

  async getAdminInvoices(
    propertyId: string,
    params: { period?: string; status?: string } = {}
  ): Promise<InvoiceListResponse> {
    const qs = new URLSearchParams();
    if (params.period) qs.set("period", params.period);
    if (params.status) qs.set("status", params.status);
    const query = qs.toString();
    return this.request<InvoiceListResponse>(
      `/api/v1/admin/properties/${propertyId}/invoices${query ? `?${query}` : ""}`,
      { method: "GET", headers: { "X-TanPms-Scope": "AdminScope" } }
    );
  }

  async issueAdminInvoice(propertyId: string, invoiceId: string): Promise<InvoiceItemDto> {
    return this.request<InvoiceItemDto>(`/api/v1/admin/properties/${propertyId}/invoices/${invoiceId}/issue`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async deleteAdminInvoice(propertyId: string, invoiceId: string): Promise<InvoiceItemDto> {
    return this.request<InvoiceItemDto>(`/api/v1/admin/properties/${propertyId}/invoices/${invoiceId}`, {
      method: "DELETE",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  // --- 6d. Cashier Shifts, Payment Slips & Deposit Ledger APIs (PM-08) ---
  async openAdminCashierShift(propertyId: string, req: OpenCashierShiftRequest): Promise<CashierShiftDto> {
    return this.request<CashierShiftDto>(`/api/v1/admin/properties/${propertyId}/cashier/shifts/open`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async getAdminCurrentCashierShift(propertyId: string): Promise<CurrentCashierShiftResponse> {
    return this.request<CurrentCashierShiftResponse>(`/api/v1/admin/properties/${propertyId}/cashier/shifts/current`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async getAdminCashierShifts(propertyId: string, params: { status?: string } = {}): Promise<CashierShiftListResponse> {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.request<CashierShiftListResponse>(`/api/v1/admin/properties/${propertyId}/cashier/shifts${query}`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async closeAdminCashierShift(
    propertyId: string,
    shiftId: string,
    req: CloseCashierShiftRequest
  ): Promise<CashierShiftDto> {
    return this.request<CashierShiftDto>(`/api/v1/admin/properties/${propertyId}/cashier/shifts/${shiftId}/close`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async reconcileAdminCashierShift(
    propertyId: string,
    shiftId: string,
    req: ReconcileCashierShiftRequest
  ): Promise<CashierShiftDto> {
    return this.request<CashierShiftDto>(`/api/v1/admin/properties/${propertyId}/cashier/shifts/${shiftId}/reconcile`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  async getAdminDepositLedgers(propertyId: string, params: { type?: string } = {}): Promise<DepositLedgerListResponse> {
    const query = params.type ? `?type=${encodeURIComponent(params.type)}` : "";
    return this.request<DepositLedgerListResponse>(`/api/v1/admin/properties/${propertyId}/deposit-ledgers${query}`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async getAdminPaymentSlips(propertyId: string, params: { status?: string } = {}): Promise<PaymentSlipQueueResponse> {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.request<PaymentSlipQueueResponse>(`/api/v1/admin/properties/${propertyId}/payments/slips${query}`, {
      method: "GET",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async approveAdminPaymentSlip(propertyId: string, slipId: string): Promise<AdminPaymentSlipDto> {
    return this.request<AdminPaymentSlipDto>(`/api/v1/admin/properties/${propertyId}/payments/slips/${slipId}/approve`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
    });
  }

  async rejectAdminPaymentSlip(
    propertyId: string,
    slipId: string,
    req: RejectPaymentSlipRequest
  ): Promise<AdminPaymentSlipDto> {
    return this.request<AdminPaymentSlipDto>(`/api/v1/admin/properties/${propertyId}/payments/slips/${slipId}/reject`, {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: JSON.stringify(req),
    });
  }

  // --- 6e. CRUD completion + Operations APIs (PM-09) ---
  private adminCall<T>(propertyId: string, path: string, method: string, body?: unknown): Promise<T> {
    return this.request<T>(`/api/v1/admin/properties/${propertyId}/${path}`, {
      method,
      headers: { "X-TanPms-Scope": "AdminScope" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  updateAdminLease(propertyId: string, leaseId: string, req: UpdateLeaseRequest) {
    return this.adminCall<LeaseItemDto>(propertyId, `leases/${leaseId}`, "PUT", req);
  }
  cancelAdminLease(propertyId: string, leaseId: string, reason: string) {
    return this.adminCall<LeaseSettlementDto>(propertyId, `leases/${leaseId}/cancel`, "POST", { reason });
  }
  updateAdminLeaseOccupant(propertyId: string, leaseId: string, occupantId: string, req: UpdateLeaseOccupantRequest) {
    return this.adminCall<LeaseItemDto>(propertyId, `leases/${leaseId}/occupants/${occupantId}`, "PUT", req);
  }
  deleteAdminLeaseOccupant(propertyId: string, leaseId: string, occupantId: string) {
    return this.adminCall<LeaseItemDto>(propertyId, `leases/${leaseId}/occupants/${occupantId}`, "DELETE");
  }
  updateAdminLeaseVehicle(propertyId: string, leaseId: string, vehicleId: string, req: LeaseVehicleRequest) {
    return this.adminCall<LeaseItemDto>(propertyId, `leases/${leaseId}/vehicles/${vehicleId}`, "PUT", req);
  }
  deleteAdminLeaseVehicle(propertyId: string, leaseId: string, vehicleId: string) {
    return this.adminCall<LeaseItemDto>(propertyId, `leases/${leaseId}/vehicles/${vehicleId}`, "DELETE");
  }

  deleteAdminMeterReading(propertyId: string, unitId: string, params: { period: string; overrideReason?: string }) {
    const qs = new URLSearchParams({ period: params.period });
    if (params.overrideReason) qs.set("overrideReason", params.overrideReason);
    return this.adminCall<MeterReadingSheetRowDto>(propertyId, `meter-readings/units/${unitId}?${qs.toString()}`, "DELETE");
  }

  getAdminInvoice(propertyId: string, invoiceId: string) {
    return this.adminCall<InvoiceItemDto>(propertyId, `invoices/${invoiceId}`, "GET");
  }
  addAdminInvoiceLine(propertyId: string, invoiceId: string, req: InvoiceLineRequest) {
    return this.adminCall<InvoiceItemDto>(propertyId, `invoices/${invoiceId}/lines`, "POST", req);
  }
  updateAdminInvoiceLine(propertyId: string, invoiceId: string, lineId: string, req: InvoiceLineRequest) {
    return this.adminCall<InvoiceItemDto>(propertyId, `invoices/${invoiceId}/lines/${lineId}`, "PUT", req);
  }
  deleteAdminInvoiceLine(propertyId: string, invoiceId: string, lineId: string) {
    return this.adminCall<InvoiceItemDto>(propertyId, `invoices/${invoiceId}/lines/${lineId}`, "DELETE");
  }
  voidAdminInvoice(propertyId: string, invoiceId: string, reason: string) {
    return this.adminCall<InvoiceItemDto>(propertyId, `invoices/${invoiceId}/void`, "POST", { reason });
  }

  getAdminCashierShift(propertyId: string, shiftId: string) {
    return this.adminCall<CashierShiftDto>(propertyId, `cashier/shifts/${shiftId}`, "GET");
  }
  cancelAdminCashierShift(propertyId: string, shiftId: string, reason: string) {
    return this.adminCall<CashierShiftDto>(propertyId, `cashier/shifts/${shiftId}/cancel`, "POST", { reason });
  }
  updateAdminCashierShiftRemark(propertyId: string, shiftId: string, req: UpdateCashierShiftRemarkRequest) {
    return this.adminCall<CashierShiftDto>(propertyId, `cashier/shifts/${shiftId}/variance-remark`, "PUT", req);
  }

  getAdminDepositLedger(propertyId: string, ledgerId: string) {
    return this.adminCall<DepositLedgerItemDto>(propertyId, `deposit-ledgers/${ledgerId}`, "GET");
  }
  getAdminPaymentSlip(propertyId: string, slipId: string) {
    return this.adminCall<AdminPaymentSlipDto>(propertyId, `payments/slips/${slipId}`, "GET");
  }

  getAdminHousekeepingTasks(propertyId: string, params: { status?: string; buildingId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.buildingId) qs.set("buildingId", params.buildingId);
    const query = qs.toString();
    return this.adminCall<HousekeepingTaskListResponse>(propertyId, `housekeeping/tasks${query ? `?${query}` : ""}`, "GET");
  }
  createAdminHousekeepingTask(propertyId: string, req: CreateHousekeepingTaskRequest) {
    return this.adminCall<HousekeepingTaskDto>(propertyId, "housekeeping/tasks", "POST", req);
  }
  startAdminHousekeepingTask(propertyId: string, taskId: string) {
    return this.adminCall<HousekeepingTaskDto>(propertyId, `housekeeping/tasks/${taskId}/start`, "POST");
  }
  completeAdminHousekeepingTask(propertyId: string, taskId: string, req: CompleteHousekeepingTaskRequest) {
    return this.adminCall<HousekeepingTaskDto>(propertyId, `housekeeping/tasks/${taskId}/complete`, "POST", req);
  }
  assignAdminHousekeepingTask(propertyId: string, taskId: string, req: AssignHousekeepingTaskRequest) {
    return this.adminCall<HousekeepingTaskDto>(propertyId, `housekeeping/tasks/${taskId}/assign`, "POST", req);
  }
  updateAdminHousekeepingTask(propertyId: string, taskId: string, req: UpdateHousekeepingTaskRequest) {
    return this.adminCall<HousekeepingTaskDto>(propertyId, `housekeeping/tasks/${taskId}`, "PUT", req);
  }
  deleteAdminHousekeepingTask(propertyId: string, taskId: string) {
    return this.adminCall<HousekeepingTaskDto>(propertyId, `housekeeping/tasks/${taskId}`, "DELETE");
  }

  getAdminWorkOrders(propertyId: string, params: { status?: string } = {}) {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.adminCall<WorkOrderListResponse>(propertyId, `work-orders${query}`, "GET");
  }
  getAdminWorkOrder(propertyId: string, workOrderId: string) {
    return this.adminCall<WorkOrderItemDto>(propertyId, `work-orders/${workOrderId}`, "GET");
  }
  createAdminWorkOrder(propertyId: string, req: CreateWorkOrderRequest) {
    return this.adminCall<WorkOrderItemDto>(propertyId, "work-orders", "POST", req);
  }
  updateAdminWorkOrder(propertyId: string, workOrderId: string, req: UpdateWorkOrderRequest) {
    return this.adminCall<WorkOrderItemDto>(propertyId, `work-orders/${workOrderId}`, "PUT", req);
  }
  assignAdminWorkOrder(propertyId: string, workOrderId: string, req: AssignWorkOrderRequest) {
    return this.adminCall<WorkOrderItemDto>(propertyId, `work-orders/${workOrderId}/assign`, "POST", req);
  }
  resolveAdminWorkOrder(propertyId: string, workOrderId: string, req: ResolveWorkOrderRequest) {
    return this.adminCall<WorkOrderItemDto>(propertyId, `work-orders/${workOrderId}/resolve`, "POST", req);
  }
  cancelAdminWorkOrder(propertyId: string, workOrderId: string, reason: string) {
    return this.adminCall<WorkOrderItemDto>(propertyId, `work-orders/${workOrderId}/cancel`, "POST", { reason });
  }

  getAdminParcels(propertyId: string, params: { status?: string } = {}) {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.adminCall<ParcelListResponse>(propertyId, `parcels${query}`, "GET");
  }
  getAdminParcel(propertyId: string, parcelId: string) {
    return this.adminCall<ParcelItemDto>(propertyId, `parcels/${parcelId}`, "GET");
  }
  receiveAdminParcel(propertyId: string, req: ReceiveParcelRequest) {
    return this.adminCall<ParcelItemDto>(propertyId, "parcels", "POST", req);
  }
  updateAdminParcel(propertyId: string, parcelId: string, req: ReceiveParcelRequest) {
    return this.adminCall<ParcelItemDto>(propertyId, `parcels/${parcelId}`, "PUT", req);
  }
  pickUpAdminParcel(propertyId: string, parcelId: string, req: PickUpParcelRequest) {
    return this.adminCall<ParcelItemDto>(propertyId, `parcels/${parcelId}/pickup`, "POST", req);
  }
  voidAdminParcel(propertyId: string, parcelId: string, reason: string) {
    return this.adminCall<ParcelItemDto>(propertyId, `parcels/${parcelId}/void`, "POST", { reason });
  }

  // --- 6f. Files & PDFs (authorized storage) ---
  uploadAdminFile(propertyId: string, purpose: StoredFilePurpose, file: File) {
    const form = new FormData();
    form.append("propertyId", propertyId);
    form.append("purpose", purpose);
    form.append("file", file);
    return this.request<StoredFileDto>("/api/v1/admin/files", {
      method: "POST",
      headers: { "X-TanPms-Scope": "AdminScope" },
      body: form,
    });
  }
  downloadAdminFile(fileKey: string) {
    return this.requestBlob(`/api/v1/admin/files/${encodeURIComponent(fileKey)}`);
  }
  downloadAdminContractPdf(propertyId: string, leaseId: string) {
    return this.requestBlob(`/api/v1/admin/properties/${propertyId}/leases/${leaseId}/contract.pdf`);
  }
  listAdminReceipts(propertyId: string, params: { invoiceId?: string } = {}) {
    const query = params.invoiceId ? `?invoiceId=${encodeURIComponent(params.invoiceId)}` : "";
    return this.adminCall<ReceiptListResponse>(propertyId, `receipts${query}`, "GET");
  }
  downloadAdminReceiptPdf(propertyId: string, receiptId: string) {
    return this.requestBlob(`/api/v1/admin/properties/${propertyId}/receipts/${receiptId}/pdf`);
  }

  // --- 6g. Client portal (ClientScope) ---
  private clientCall<T>(path: string, method: string, body?: unknown): Promise<T> {
    return this.request<T>(`/api/v1/client/${path}`, {
      method,
      headers: { "X-TanPms-Scope": "ClientScope" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  uploadClientFile(purpose: StoredFilePurpose, file: File) {
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", file);
    return this.request<StoredFileDto>("/api/v1/client/files", {
      method: "POST",
      headers: { "X-TanPms-Scope": "ClientScope" },
      body: form,
    });
  }
  downloadClientFile(fileKey: string) {
    return this.requestBlob(`/api/v1/client/files/${encodeURIComponent(fileKey)}`, "ClientScope");
  }
  downloadClientReceiptPdf(receiptId: string) {
    return this.requestBlob(`/api/v1/client/receipts/${receiptId}/pdf`, "ClientScope");
  }
  getClientLeases() {
    return this.clientCall<LeaseListResponse>("leases", "GET");
  }
  getClientLease(leaseId: string) {
    return this.clientCall<LeaseItemDto>(`leases/${leaseId}`, "GET");
  }
  createClientLeaseIntent(leaseId: string, req: CreateLeaseIntentRequest) {
    return this.clientCall<LeaseIntentDto>(`leases/${leaseId}/intents`, "POST", req);
  }
  getClientLeaseIntents() {
    return this.clientCall<LeaseIntentListResponse>("lease-intents", "GET");
  }
  updateClientLeaseIntent(intentId: string, req: UpdateLeaseIntentRequest) {
    return this.clientCall<LeaseIntentDto>(`lease-intents/${intentId}`, "PUT", req);
  }
  withdrawClientLeaseIntent(intentId: string) {
    return this.clientCall<LeaseIntentDto>(`lease-intents/${intentId}`, "DELETE");
  }
  getClientInvoices(params: { status?: string } = {}) {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.clientCall<ClientInvoiceListResponse>(`invoices${query}`, "GET");
  }
  getClientInvoice(invoiceId: string) {
    return this.clientCall<ClientInvoiceDto>(`invoices/${invoiceId}`, "GET");
  }
  submitClientPaymentSlip(invoiceId: string, req: SubmitPaymentSlipRequest) {
    return this.clientCall<ClientPaymentSlipDto>(`invoices/${invoiceId}/slips`, "POST", req);
  }
  updateClientPaymentSlip(invoiceId: string, slipId: string, req: SubmitPaymentSlipRequest) {
    return this.clientCall<ClientPaymentSlipDto>(`invoices/${invoiceId}/slips/${slipId}`, "PUT", req);
  }
  withdrawClientPaymentSlip(invoiceId: string, slipId: string) {
    return this.clientCall<ClientPaymentSlipDto>(`invoices/${invoiceId}/slips/${slipId}`, "DELETE");
  }
  getClientAllPaymentSlips() {
    return this.clientCall<ClientPaymentSlipListResponse>("payment-slips", "GET");
  }
  getClientUtilityUsage(params: { leaseId?: string; months?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.leaseId) qs.set("leaseId", params.leaseId);
    if (params.months) qs.set("months", String(params.months));
    const query = qs.toString();
    return this.clientCall<ClientUtilityUsageResponse>(`utility-usage${query ? `?${query}` : ""}`, "GET");
  }
  getClientWorkOrders(params: { status?: string } = {}) {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.clientCall<WorkOrderListResponse>(`work-orders${query}`, "GET");
  }
  getClientWorkOrder(workOrderId: string) {
    return this.clientCall<WorkOrderItemDto>(`work-orders/${workOrderId}`, "GET");
  }
  createClientWorkOrder(req: CreateWorkOrderRequest) {
    return this.clientCall<WorkOrderItemDto>("work-orders", "POST", req);
  }
  updateClientWorkOrder(workOrderId: string, req: UpdateWorkOrderRequest) {
    return this.clientCall<WorkOrderItemDto>(`work-orders/${workOrderId}`, "PUT", req);
  }
  cancelClientWorkOrder(workOrderId: string, reason: string) {
    return this.clientCall<WorkOrderItemDto>(`work-orders/${workOrderId}/cancel`, "POST", { reason });
  }
  getClientParcels(params: { status?: string } = {}) {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.clientCall<ParcelListResponse>(`parcels${query}`, "GET");
  }
  getClientReservation(reservationId: string) {
    return this.clientCall<ReservationItemDto>(`reservations/${reservationId}`, "GET");
  }
  cancelClientReservation(reservationId: string, reason: string) {
    return this.clientCall<ReservationItemDto>(`reservations/${reservationId}/cancel`, "POST", { reason });
  }

  // --- 6h. Admin lease intents & analytics ---
  getAdminLeaseIntents(propertyId: string, params: { status?: string } = {}) {
    const query = params.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return this.adminCall<LeaseIntentListResponse>(propertyId, `lease-intents${query}`, "GET");
  }
  approveAdminLeaseIntent(propertyId: string, intentId: string) {
    return this.adminCall<LeaseIntentDto>(propertyId, `lease-intents/${intentId}/approve`, "POST");
  }
  rejectAdminLeaseIntent(propertyId: string, intentId: string, reason: string) {
    return this.adminCall<LeaseIntentDto>(propertyId, `lease-intents/${intentId}/reject`, "POST", { reason });
  }
  getAdminAnalytics<T>(propertyId: string, report: AnalyticsReportKind, range: { from?: string; to?: string }) {
    const qs = new URLSearchParams();
    if (range.from) qs.set("from", range.from);
    if (range.to) qs.set("to", range.to);
    const query = qs.toString();
    return this.adminCall<T>(propertyId, `analytics/${report}${query ? `?${query}` : ""}`, "GET");
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
