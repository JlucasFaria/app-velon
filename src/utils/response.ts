import type { Context } from "hono";

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

type StatusCode =
  | 200
  | 201
  | 202
  | 400
  | 401
  | 403
  | 404
  | 409
  | 429
  | 500
  | 503;

/**
 * Returns a standardized success response
 */
export function successResponse<T, S extends StatusCode = 200>(
  c: Context,
  data: T,
  status: S,
  message?: string,
) {
  return c.json(
    {
      success: true as const,
      data,
      ...(message ? { message } : {}),
    },
    status,
  );
}

/**
 * Returns a standardized error response
 */
export function errorResponse<S extends StatusCode>(
  c: Context,
  error: string,
  status: S,
  details?: unknown,
) {
  return c.json(
    {
      success: false as const,
      error,
      ...(details !== undefined ? { details } : {}),
    },
    status,
  );
}
