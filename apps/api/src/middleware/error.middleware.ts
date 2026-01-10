import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { error as errorResponse, serverError } from '../utils/response';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  console.error(`[Error] ${err.name}: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Handle known operational errors
  if (err instanceof AppError && err.isOperational) {
    return errorResponse(res, err.code, err.message, err.statusCode, err.details);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const path = e.path.join('.');
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(e.message);
    });
    return errorResponse(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        return errorResponse(
          res,
          'CONFLICT',
          `A record with this ${target} already exists`,
          409
        );
      }
      case 'P2025':
        // Record not found
        return errorResponse(res, 'NOT_FOUND', 'Record not found', 404);
      case 'P2003':
        // Foreign key constraint failed
        return errorResponse(
          res,
          'VALIDATION_ERROR',
          'Related record not found',
          400
        );
      default:
        return errorResponse(res, 'DATABASE_ERROR', 'Database operation failed', 500);
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return errorResponse(res, 'VALIDATION_ERROR', 'Invalid data provided', 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'UNAUTHORIZED', 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'TOKEN_EXPIRED', 'Token has expired', 401);
  }

  // Handle syntax errors in JSON body
  if (err instanceof SyntaxError && 'body' in err) {
    return errorResponse(res, 'INVALID_JSON', 'Invalid JSON in request body', 400);
  }

  // Default to internal server error for unknown errors
  return serverError(res, process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message
  );
}

// Async wrapper for route handlers
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
