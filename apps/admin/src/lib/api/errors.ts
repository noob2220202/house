/** Error shape returned by the backend: `{ code, message, details?, requestId }`. */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { path?: string; code?: string; message: string }[];
  requestId?: string;
}

/** The one error type thrown by the API client. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorBody['details'];
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.requestId;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isValidation(): boolean {
    return this.code === 'VALIDATION_FAILED';
  }
  get isNetwork(): boolean {
    return this.status === 0;
  }

  /** Validation details keyed by field path — feed into react-hook-form `setError`. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) {
      if (d.path && !(d.path in out)) out[d.path] = d.message;
    }
    return out;
  }
}

export const ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  BAD_RESPONSE: 'BAD_RESPONSE',
  UNKNOWN: 'UNKNOWN_ERROR',
} as const;

const FALLBACK_MESSAGE: Record<number, string> = {
  0: '네트워크 연결을 확인해 주세요.',
  400: '요청을 처리할 수 없어요. 입력 내용을 확인해 주세요.',
  401: '로그인이 필요해요.',
  403: '접근 권한이 없어요.',
  404: '요청하신 정보를 찾을 수 없어요.',
  409: '이미 처리된 요청이에요.',
  429: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
  500: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
};

export function fallbackMessage(status: number): string {
  return (
    FALLBACK_MESSAGE[status] ?? (status >= 500 ? FALLBACK_MESSAGE[500]! : FALLBACK_MESSAGE[400]!)
  );
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/** Normalizes any failed response body into an ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  if (isErrorBody(body)) return new ApiError(status, body);
  return new ApiError(status, {
    code: status >= 500 ? ERROR_CODES.UNKNOWN : `HTTP_${status}`,
    message: fallbackMessage(status),
  });
}

/** Normalizes anything thrown (ApiError, fetch TypeError, AbortError…) into an ApiError. */
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return new ApiError(0, {
      code: ERROR_CODES.TIMEOUT,
      message: '응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.',
    });
  }
  if (error instanceof TypeError)
    return new ApiError(0, { code: ERROR_CODES.NETWORK, message: fallbackMessage(0) });
  return new ApiError(500, { code: ERROR_CODES.UNKNOWN, message: fallbackMessage(500) });
}

/** User-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  return normalizeError(error).message;
}
