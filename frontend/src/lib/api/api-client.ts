import type {
  RoomRackResponse,
  CheckInStayRequest,
  StaySummaryDto,
  ClientDashboardResponse,
  ProblemDetailsResponse,
} from "@/generated/api";
import { ApiError } from "./api-error";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json, application/problem+json");

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

  // Admin APIs
  async getAdminRoomRack(propertyId: string): Promise<RoomRackResponse> {
    return this.request<RoomRackResponse>(`/api/v1/admin/properties/${propertyId}/rack`, {
      method: "GET",
    });
  }

  async checkInStay(req: CheckInStayRequest): Promise<StaySummaryDto> {
    return this.request<StaySummaryDto>(`/api/v1/admin/stays/check-in`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  // Client APIs
  async getClientDashboard(): Promise<ClientDashboardResponse> {
    return this.request<ClientDashboardResponse>(`/api/v1/client/dashboard`, {
      method: "GET",
    });
  }
}

export const apiClient = new ApiClient();
