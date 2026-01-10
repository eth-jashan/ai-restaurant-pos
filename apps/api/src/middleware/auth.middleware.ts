import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, JWTPayload } from '../types';
import { unauthorized, forbidden } from '../utils/response';

const prisma = new PrismaClient();

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JWTPayload;

    if (decoded.type !== 'access') {
      return unauthorized(res, 'Invalid token type');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        restaurantId: true,
        role: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return unauthorized(res, 'User not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return unauthorized(res, 'Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return unauthorized(res, 'Invalid token');
    }
    return unauthorized(res, 'Authentication failed');
  }
}

// PIN-based authentication for quick POS access
export async function authenticateByPin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { pin, restaurantId } = req.body;

    if (!pin || !restaurantId) {
      return unauthorized(res, 'PIN and restaurant ID required');
    }

    const user = await prisma.user.findFirst({
      where: {
        restaurantId,
        pin,
        isActive: true,
      },
      select: {
        id: true,
        restaurantId: true,
        role: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!user) {
      return unauthorized(res, 'Invalid PIN');
    }

    req.user = user;
    next();
  } catch (error) {
    return unauthorized(res, 'Authentication failed');
  }
}

// Role-based access control
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return unauthorized(res, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(res, 'Insufficient permissions');
    }

    next();
  };
}

// Verify user belongs to the restaurant in the request
export function requireSameRestaurant(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void | Response {
  if (!req.user) {
    return unauthorized(res, 'Authentication required');
  }

  const restaurantId = req.params.restaurantId || req.body.restaurantId;

  if (restaurantId && restaurantId !== req.user.restaurantId) {
    return forbidden(res, 'Access denied to this restaurant');
  }

  next();
}

// Optional authentication (doesn't fail if no token)
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        restaurantId: true,
        role: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Ignore errors for optional auth
  }

  next();
}
