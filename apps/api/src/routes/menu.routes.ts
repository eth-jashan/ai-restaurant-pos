import { Router, Response } from 'express';
import { z } from 'zod';
import { menuService } from '../services/menu.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { success, created, noContent } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  image: z.string().url().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const createMenuItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  shortName: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  basePrice: z.number().positive(),
  taxRate: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  isVeg: z.boolean().optional(),
  image: z.string().url().optional(),
  preparationTime: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  modifierGroupIds: z.array(z.string().uuid()).optional(),
});

const updateMenuItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  shortName: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  basePrice: z.number().positive().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  image: z.string().url().optional(),
  preparationTime: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
  allergens: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()),
});

const createModifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().max(100).optional(),
  selectionType: z.enum(['SINGLE', 'MULTIPLE']).optional(),
  minSelection: z.number().int().min(0).optional(),
  maxSelection: z.number().int().min(1).optional(),
  isRequired: z.boolean().optional(),
  options: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.number().min(0),
        isDefault: z.boolean().optional(),
      })
    )
    .optional(),
});

// Routes

// ==================== CATEGORIES ====================

// Get all categories
router.get(
  '/categories',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const categories = await menuService.getCategories(
      req.user!.restaurantId,
      includeInactive
    );
    return success(res, { categories });
  })
);

// Get single category
router.get(
  '/categories/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const category = await menuService.getCategoryById(
      req.params.id,
      req.user!.restaurantId
    );
    return success(res, { category });
  })
);

// Create category
router.post(
  '/categories',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(createCategorySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const category = await menuService.createCategory(
      req.user!.restaurantId,
      req.body
    );
    return created(res, { category });
  })
);

// Update category
router.patch(
  '/categories/:id',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(createCategorySchema.partial()),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const category = await menuService.updateCategory(
      req.params.id,
      req.user!.restaurantId,
      req.body
    );
    return success(res, { category });
  })
);

// Delete category
router.delete(
  '/categories/:id',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await menuService.deleteCategory(req.params.id, req.user!.restaurantId);
    return noContent(res);
  })
);

// Reorder categories
router.post(
  '/categories/reorder',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(reorderCategoriesSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await menuService.reorderCategories(req.user!.restaurantId, req.body.categoryIds);
    return success(res, { message: 'Categories reordered' });
  })
);

// ==================== MENU ITEMS ====================

// Get all menu items
router.get(
  '/items',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filters = {
      categoryId: req.query.categoryId as string,
      isAvailable: req.query.isAvailable === 'true' ? true : req.query.isAvailable === 'false' ? false : undefined,
      isVeg: req.query.isVeg === 'true' ? true : req.query.isVeg === 'false' ? false : undefined,
      search: req.query.search as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    };

    const items = await menuService.getMenuItems(req.user!.restaurantId, filters);
    return success(res, { items });
  })
);

// Search menu items
router.get(
  '/items/search',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

    const items = await menuService.searchItems(req.user!.restaurantId, query, limit);
    return success(res, { items });
  })
);

// Get single menu item
router.get(
  '/items/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = await menuService.getMenuItemById(
      req.params.id,
      req.user!.restaurantId
    );
    return success(res, { item });
  })
);

// Create menu item
router.post(
  '/items',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(createMenuItemSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = await menuService.createMenuItem(req.user!.restaurantId, req.body);
    return created(res, { item });
  })
);

// Update menu item
router.patch(
  '/items/:id',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(updateMenuItemSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const item = await menuService.updateMenuItem(
      req.params.id,
      req.user!.restaurantId,
      req.body
    );
    return success(res, { item });
  })
);

// Delete menu item
router.delete(
  '/items/:id',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await menuService.deleteMenuItem(req.params.id, req.user!.restaurantId);
    return noContent(res);
  })
);

// Toggle availability
router.post(
  '/items/:id/availability',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const isAvailable = req.body.isAvailable !== false;
    const item = await menuService.toggleAvailability(
      req.params.id,
      req.user!.restaurantId,
      isAvailable
    );
    return success(res, { item });
  })
);

// ==================== MODIFIER GROUPS ====================

// Get all modifier groups
router.get(
  '/modifiers',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const groups = await menuService.getModifierGroups(req.user!.restaurantId);
    return success(res, { groups });
  })
);

// Create modifier group
router.post(
  '/modifiers',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  validate(createModifierGroupSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const group = await menuService.createModifierGroup(
      req.user!.restaurantId,
      req.body
    );
    return created(res, { group });
  })
);

// Link modifiers to item
router.post(
  '/items/:id/modifiers',
  authenticate,
  requireRole('OWNER', 'MANAGER'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { modifierGroupIds } = req.body;
    const item = await menuService.linkModifiersToItem(
      req.params.id,
      req.user!.restaurantId,
      modifierGroupIds
    );
    return success(res, { item });
  })
);

export default router;
