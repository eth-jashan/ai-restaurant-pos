import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient, TableStatus } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { success, created, noContent, notFound } from '../utils/response';
import { AuthRequest } from '../types';
import { orderService } from '../services/order.service';

const prisma = new PrismaClient();
const router = Router();

// Validation schemas
const createTableSchema = z.object({
  name: z.string().min(1).max(20),
  capacity: z.number().int().min(1).max(50).optional(),
  section: z.string().max(50).optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
  shape: z.enum(['rectangle', 'circle', 'square']).optional(),
});

const updateTableSchema = createTableSchema.partial().extend({
  status: z.nativeEnum(TableStatus).optional(),
});

const bulkCreateTablesSchema = z.object({
  prefix: z.string().min(1).max(10),
  count: z.number().int().min(1).max(50),
  startNumber: z.number().int().min(1).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  section: z.string().max(50).optional(),
});

// Routes

// Get all tables
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const section = req.query.section as string;
    const status = req.query.status as TableStatus;

    const tables = await prisma.restaurantTable.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        ...(section && { section }),
        ...(status && { status }),
      },
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
    });

    return success(res, { tables });
  })
);

// Get tables with active orders
router.get(
  '/with-orders',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const tables = await prisma.restaurantTable.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
      },
      include: {
        orders: {
          where: {
            status: {
              notIn: ['COMPLETED', 'CANCELLED'],
            },
          },
          include: {
            items: {
              include: { modifiers: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
    });

    return success(res, { tables });
  })
);

// Get single table
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const table = await prisma.restaurantTable.findFirst({
      where: {
        id: req.params.id,
        restaurantId: req.user!.restaurantId,
      },
    });

    if (!table) {
      return notFound(res, 'Table');
    }

    return success(res, { table });
  })
);

// Get table with active orders
router.get(
  '/:id/orders',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orders = await orderService.getOrdersByTable(
      req.params.id,
      req.user!.restaurantId
    );
    return success(res, { orders });
  })
);

// Create table
router.post(
  '/',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(createTableSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const table = await prisma.restaurantTable.create({
      data: {
        restaurantId: req.user!.restaurantId,
        ...req.body,
      },
    });

    return created(res, { table });
  })
);

// Bulk create tables
router.post(
  '/bulk',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(bulkCreateTablesSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { prefix, count, startNumber = 1, capacity, section } = req.body;

    const tables = [];
    for (let i = 0; i < count; i++) {
      const tableNumber = startNumber + i;
      tables.push({
        restaurantId: req.user!.restaurantId,
        name: `${prefix}${tableNumber}`,
        capacity: capacity || 4,
        section,
      });
    }

    await prisma.restaurantTable.createMany({
      data: tables,
      skipDuplicates: true,
    });

    const createdTables = await prisma.restaurantTable.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        name: { in: tables.map((t) => t.name) },
      },
    });

    return created(res, { tables: createdTables });
  })
);

// Update table
router.patch(
  '/:id',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(updateTableSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const table = await prisma.restaurantTable.findFirst({
      where: {
        id: req.params.id,
        restaurantId: req.user!.restaurantId,
      },
    });

    if (!table) {
      return notFound(res, 'Table');
    }

    const updatedTable = await prisma.restaurantTable.update({
      where: { id: req.params.id },
      data: req.body,
    });

    // Emit socket event if status changed
    if (req.body.status && req.body.status !== table.status) {
      const io = req.app.get('io');
      if (io) {
        io.to(`restaurant:${req.user!.restaurantId}`).emit('table:status-changed', {
          tableId: updatedTable.id,
          status: updatedTable.status,
        });
      }
    }

    return success(res, { table: updatedTable });
  })
);

// Update table status
router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body;

    const table = await prisma.restaurantTable.findFirst({
      where: {
        id: req.params.id,
        restaurantId: req.user!.restaurantId,
      },
    });

    if (!table) {
      return notFound(res, 'Table');
    }

    const updatedTable = await prisma.restaurantTable.update({
      where: { id: req.params.id },
      data: { status },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('table:status-changed', {
        tableId: updatedTable.id,
        status: updatedTable.status,
      });
    }

    return success(res, { table: updatedTable });
  })
);

// Delete table
router.delete(
  '/:id',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const table = await prisma.restaurantTable.findFirst({
      where: {
        id: req.params.id,
        restaurantId: req.user!.restaurantId,
      },
      include: {
        orders: {
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        },
      },
    });

    if (!table) {
      return notFound(res, 'Table');
    }

    if (table.orders.length > 0) {
      return success(res, {
        error: 'Cannot delete table with active orders',
      });
    }

    await prisma.restaurantTable.delete({
      where: { id: req.params.id },
    });

    return noContent(res);
  })
);

// Get sections
router.get(
  '/sections/list',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const sections = await prisma.restaurantTable.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        section: { not: null },
      },
      select: { section: true },
      distinct: ['section'],
    });

    return success(res, {
      sections: sections.map((s) => s.section).filter(Boolean),
    });
  })
);

export default router;
