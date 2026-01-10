import { Response } from 'express';
import { ApiResponse, ApiError, ResponseMeta } from '../types';

export function success<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: ResponseMeta
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };
  return res.status(statusCode).json(response);
}

export function created<T>(res: Response, data: T): Response {
  return success(res, data, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function error(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: Record<string, unknown>
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
  return res.status(statusCode).json(response);
}

export function unauthorized(res: Response, message = 'Unauthorized'): Response {
  return error(res, 'UNAUTHORIZED', message, 401);
}

export function forbidden(res: Response, message = 'Forbidden'): Response {
  return error(res, 'FORBIDDEN', message, 403);
}

export function notFound(res: Response, resource = 'Resource'): Response {
  return error(res, 'NOT_FOUND', `${resource} not found`, 404);
}

export function conflict(res: Response, message: string): Response {
  return error(res, 'CONFLICT', message, 409);
}

export function validationError(
  res: Response,
  details: Record<string, unknown>
): Response {
  return error(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
}

export function serverError(
  res: Response,
  message = 'Internal server error'
): Response {
  return error(res, 'INTERNAL_ERROR', message, 500);
}

// Pagination helper
export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
  total: number
): { data: T[]; meta: ResponseMeta } {
  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };
}
