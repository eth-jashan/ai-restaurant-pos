import { Router } from 'express';
import authRoutes from './auth.routes';
import menuRoutes from './menu.routes';
import orderRoutes from './order.routes';
import tableRoutes from './table.routes';
import billingRoutes from './billing.routes';
import aiRoutes from './ai.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/tables', tableRoutes);
router.use('/billing', billingRoutes);
router.use('/ai', aiRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
