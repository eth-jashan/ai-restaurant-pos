import { Router, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { success, created } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  restaurantSlug: z.string().min(1),
});

const pinLoginSchema = z.object({
  pin: z.string().length(4),
  restaurantId: z.string().uuid(),
});

const registerSchema = z.object({
  restaurant: z.object({
    name: z.string().min(2),
    slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
    address: z.string().min(5),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/),
    phone: z.string().regex(/^\+?\d{10,12}$/),
    email: z.string().email(),
    gstin: z.string().optional(),
    fssaiNumber: z.string().optional(),
  }),
  owner: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().regex(/^\d{10}$/),
    password: z.string().min(8),
  }),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const updatePinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
});

// Routes

// Login with email/password
router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.login(req.body);
    return success(res, result);
  })
);

// Quick login with PIN
router.post(
  '/login/pin',
  validate(pinLoginSchema),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.loginWithPin(req.body);
    return success(res, result);
  })
);

// Register new restaurant
router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res: Response) => {
    const result = await authService.registerRestaurant(req.body);
    return created(res, result);
  })
);

// Refresh token
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req, res: Response) => {
    const tokens = await authService.refreshToken(req.body.refreshToken);
    return success(res, { tokens });
  })
);

// Logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1] || '';
    await authService.logout(token);
    return success(res, { message: 'Logged out successfully' });
  })
);

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.id);
    return success(res, { user });
  })
);

// Change password
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await authService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    return success(res, { message: 'Password changed successfully' });
  })
);

// Update PIN
router.post(
  '/update-pin',
  authenticate,
  validate(updatePinSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await authService.updatePin(req.user!.id, req.body.pin);
    return success(res, { message: 'PIN updated successfully' });
  })
);

export default router;
