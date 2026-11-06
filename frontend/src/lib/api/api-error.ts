import type { ProblemDetailsResponse } from "@/generated/api";

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly traceId?: string;
  readonly errors?: Record<string, string[]>;
  readonly isAbort: boolean;

  constructor(options: {
    status: number;
    errorCode: string;
    message: string;
    traceId?: string;
    errors?: Record<string, string[]>;
    isAbort?: boolean;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.errorCode = options.errorCode;
    this.traceId = options.traceId;
    this.errors = options.errors;
    this.isAbort = options.isAbort ?? false;
  }

  static fromProblemDetails(status: number, problem: ProblemDetailsResponse): ApiError {
    const errorCode = problem.errorCode || (status === 401 ? "auth.unauthenticated" : "generic");
    return new ApiError({
      status,
      errorCode,
      message: problem.detail || problem.title || errorCode,
      traceId: problem.traceId || undefined,
      errors: problem.errors || undefined,
    });
  }

  static fromAbort(): ApiError {
    return new ApiError({
      status: 0,
      errorCode: "request.aborted",
      message: "The request was aborted.",
      isAbort: true,
    });
  }

  static fromUnknown(status = 500, traceId?: string): ApiError {
    return new ApiError({
      status,
      errorCode: "generic",
      message: "An unexpected server error occurred.",
      traceId,
    });
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getApiErrorMessage(error: unknown, fallback = "An error occurred"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
