import { Router, Response } from 'express';
import { z } from 'zod';
import { orderService } from '../services/order.service';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { success, created } from '../utils/response';
import { AuthRequest } from '../types';
import { OrderStatus, KOTStatus } from '@prisma/client';

const router = Router();

// Validation schemas
const createOrderSchema = z.object({
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
  tableId: z.string().uuid().optional(),
  covers: z.number().int().min(1).optional(),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(15).optional(),
  customerAddress: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().min(1),
      notes: z.string().max(200).optional(),
      modifiers: z
        .array(
          z.object({
            name: z.string(),
            price: z.number().min(0),
            groupName: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
});

const addItemsSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().min(1),
      notes: z.string().max(200).optional(),
      modifiers: z
        .array(
          z.object({
            name: z.string(),
            price: z.number().min(0),
            groupName: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  notes: z.string().max(200).optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

const cancelOrderSchema = z.object({
  reason: z.string().max(200).optional(),
});

const createKOTSchema = z.object({
  itemIds: z.array(z.string().uuid()).optional(),
});

const updateKOTStatusSchema = z.object({
  status: z.nativeEnum(KOTStatus),
});

// Routes

// Get all orders (with filters)
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      status: req.query.status as OrderStatus,
      orderType: req.query.orderType as 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY',
      tableId: req.query.tableId as string,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      channel: req.query.channel as string,
    };

    const orders = await orderService.getOrders(req.user!.restaurantId, filters);
    return success(res, { orders });
  })
);

// Get active orders
router.get(
  '/active',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orders = await orderService.getActiveOrders(req.user!.restaurantId);
    return success(res, { orders });
  })
);

// Get single order
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.getOrderById(
      req.params.id,
      req.user!.restaurantId
    );
    return success(res, { order });
  })
);

// Create order
router.post(
  '/',
  authenticate,
  validate(createOrderSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.createOrder(
      req.user!.restaurantId,
      req.user!.id,
      req.body
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('order:created', {
        orderId: order.id,
        tableId: order.tableId,
      });
    }

    return created(res, { order });
  })
);

// Add items to existing order
router.post(
  '/:id/items',
  authenticate,
  validate(addItemsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.addItemsToOrder(
      req.params.id,
      req.user!.restaurantId,
      req.body.items
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', {
        orderId: order.id,
        status: order.status,
      });
    }

    return success(res, { order });
  })
);

// Update order item
router.patch(
  '/items/:itemId',
  authenticate,
  validate(updateItemSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.updateOrderItem(
      req.params.itemId,
      req.user!.restaurantId,
      req.body
    );
    return success(res, { order });
  })
);

// Cancel order item
router.post(
  '/items/:itemId/cancel',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.cancelOrderItem(
      req.params.itemId,
      req.user!.restaurantId,
      req.body.reason
    );
    return success(res, { order });
  })
);

// Update order status
router.patch(
  '/:id/status',
  authenticate,
  validate(updateStatusSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      req.user!.restaurantId,
      req.body.status
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', {
        orderId: order.id,
        status: order.status,
      });
    }

    return success(res, { order });
  })
);

// Cancel order
router.post(
  '/:id/cancel',
  authenticate,
  validate(cancelOrderSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const order = await orderService.cancelOrder(
      req.params.id,
      req.user!.restaurantId,
      req.body.reason
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('order:cancelled', {
        orderId: order.id,
      });
    }

    return success(res, { order });
  })
);

// ==================== KOT ====================

// Get pending KOTs
router.get(
  '/kots/pending',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const kots = await orderService.getPendingKOTs(req.user!.restaurantId);
    return success(res, { kots });
  })
);

// Create KOT
router.post(
  '/:id/kot',
  authenticate,
  validate(createKOTSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const kot = await orderService.createKOT(
      req.params.id,
      req.user!.restaurantId,
      req.body.itemIds
    );

    // Emit to KDS
    const io = req.app.get('io');
    if (io) {
      io.to(`kds:${req.user!.restaurantId}`).emit('kot:created', {
        kotId: kot!.id,
        orderId: req.params.id,
      });
    }

    return created(res, { kot });
  })
);

// Update KOT status
router.patch(
  '/kots/:kotId/status',
  authenticate,
  validate(updateKOTStatusSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const kot = await orderService.updateKOTStatus(
      req.params.kotId,
      req.user!.restaurantId,
      req.body.status
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`kds:${req.user!.restaurantId}`).emit('kot:updated', {
        kotId: kot.id,
        status: kot.status,
      });
    }

    return success(res, { kot });
  })
);

export default router;
