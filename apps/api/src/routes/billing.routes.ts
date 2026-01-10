import { Router, Response } from 'express';
import { z } from 'zod';
import { billingService } from '../services/billing.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { success, created } from '../utils/response';
import { AuthRequest } from '../types';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

const router = Router();

// Validation schemas
const createInvoiceSchema = z.object({
  orderId: z.string().uuid(),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(15).optional(),
  customerEmail: z.string().email().optional(),
  customerGstin: z.string().max(20).optional(),
  customerAddress: z.string().max(500).optional(),
  discount: z.number().min(0).optional(),
  discountReason: z.string().max(200).optional(),
});

const processPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  receivedAmount: z.number().positive().optional(),
  transactionId: z.string().max(100).optional(),
  notes: z.string().max(200).optional(),
});

const splitPaymentSchema = z.object({
  payments: z.array(
    z.object({
      amount: z.number().positive(),
      method: z.nativeEnum(PaymentMethod),
    })
  ),
});

const applyDiscountSchema = z.object({
  discount: z.number().min(0),
  reason: z.string().max(200).optional(),
});

const voidInvoiceSchema = z.object({
  reason: z.string().min(1).max(200),
});

// Routes

// ==================== INVOICES ====================

// Get all invoices
router.get(
  '/invoices',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      status: req.query.status as InvoiceStatus,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      customerPhone: req.query.customerPhone as string,
    };

    const invoices = await billingService.getInvoices(
      req.user!.restaurantId,
      filters
    );
    return success(res, { invoices });
  })
);

// Get invoice by ID
router.get(
  '/invoices/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const invoice = await billingService.getInvoice(
      req.params.id,
      req.user!.restaurantId
    );
    return success(res, { invoice });
  })
);

// Get invoice by order
router.get(
  '/orders/:orderId/invoice',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const invoice = await billingService.getInvoiceByOrder(
      req.params.orderId,
      req.user!.restaurantId
    );
    return success(res, { invoice });
  })
);

// Create invoice
router.post(
  '/invoices',
  authenticate,
  validate(createInvoiceSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const invoice = await billingService.createInvoice(
      req.user!.restaurantId,
      req.user!.id,
      req.body
    );
    return created(res, { invoice });
  })
);

// Apply discount
router.post(
  '/invoices/:id/discount',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(applyDiscountSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const invoice = await billingService.applyDiscount(
      req.params.id,
      req.user!.restaurantId,
      req.body.discount,
      req.body.reason
    );
    return success(res, { invoice });
  })
);

// Void invoice
router.post(
  '/invoices/:id/void',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(voidInvoiceSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const invoice = await billingService.voidInvoice(
      req.params.id,
      req.user!.restaurantId,
      req.body.reason
    );
    return success(res, { invoice });
  })
);

// ==================== PAYMENTS ====================

// Process payment
router.post(
  '/payments',
  authenticate,
  validate(processPaymentSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await billingService.processPayment(
      req.user!.restaurantId,
      req.user!.id,
      req.body
    );
    return created(res, result);
  })
);

// Process split payment
router.post(
  '/invoices/:id/split-payment',
  authenticate,
  validate(splitPaymentSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const results = await billingService.processSplitPayment(
      req.user!.restaurantId,
      req.user!.id,
      req.params.id,
      req.body.payments
    );
    return created(res, { payments: results });
  })
);

// ==================== REPORTS ====================

// Get daily summary
router.get(
  '/reports/daily',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const date = req.query.date
      ? new Date(req.query.date as string)
      : new Date();

    const summary = await billingService.getDailySummary(
      req.user!.restaurantId,
      date
    );
    return success(res, { summary });
  })
);

// Get sales report
router.get(
  '/reports/sales',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const fromDate = req.query.fromDate
      ? new Date(req.query.fromDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const toDate = req.query.toDate
      ? new Date(req.query.toDate as string)
      : new Date();

    const report = await billingService.getSalesReport(
      req.user!.restaurantId,
      fromDate,
      toDate
    );
    return success(res, { report });
  })
);

export default router;
