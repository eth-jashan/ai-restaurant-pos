import { Router, Response } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.service';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { success } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// Validation schemas
const messageSchema = z.object({
  message: z.string().min(1).max(500),
  conversationId: z.string().uuid().optional(),
});

const confirmActionSchema = z.object({
  actionId: z.string().min(1),
});

// Routes

// Send message to AI
router.post(
  '/message',
  authenticate,
  validate(messageSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const response = await aiService.processMessage(
      req.body.message,
      req.user!.id,
      req.user!.restaurantId,
      req.body.conversationId
    );

    return success(res, response);
  })
);

// Confirm pending action
router.post(
  '/confirm',
  authenticate,
  validate(confirmActionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await aiService.confirmAction(req.body.actionId);

    if (!result.success) {
      return success(res, {
        success: false,
        message: 'Action not found or already executed',
      });
    }

    return success(res, {
      success: true,
      message: 'Action completed successfully!',
      result: result.result,
    });
  })
);

// Cancel pending action
router.post(
  '/cancel',
  authenticate,
  validate(confirmActionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const cancelled = aiService.cancelAction(req.body.actionId);

    return success(res, {
      success: cancelled,
      message: cancelled ? 'Action cancelled' : 'No pending action found',
    });
  })
);

export default router;
