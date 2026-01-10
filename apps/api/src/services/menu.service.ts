import { PrismaClient, Prisma, MenuItem, Category } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { BulkPriceUpdateParams, PriceUpdatePreview } from '../types';

const prisma = new PrismaClient();

export interface MenuItemFilters {
  categoryId?: string;
  isAvailable?: boolean;
  isVeg?: boolean;
  search?: string;
  tags?: string[];
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  image?: string;
  sortOrder?: number;
}

export interface CreateMenuItemInput {
  categoryId: string;
  name: string;
  shortName?: string;
  description?: string;
  basePrice: number;
  taxRate?: number;
  taxInclusive?: boolean;
  isVeg?: boolean;
  image?: string;
  preparationTime?: number;
  tags?: string[];
  allergens?: string[];
  modifierGroupIds?: string[];
}

export interface UpdateMenuItemInput {
  categoryId?: string;
  name?: string;
  shortName?: string;
  description?: string;
  basePrice?: number;
  taxRate?: number;
  taxInclusive?: boolean;
  isVeg?: boolean;
  isAvailable?: boolean;
  image?: string;
  preparationTime?: number;
  tags?: string[];
  allergens?: string[];
  sortOrder?: number;
}

class MenuService {
  // ==================== CATEGORIES ====================

  async getCategories(restaurantId: string, includeInactive = false) {
    return prisma.category.findMany({
      where: {
        restaurantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCategoryById(categoryId: string, restaurantId: string) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category');
    }

    return category;
  }

  async createCategory(restaurantId: string, data: CreateCategoryInput) {
    // Get max sort order
    const maxSort = await prisma.category.aggregate({
      where: { restaurantId },
      _max: { sortOrder: true },
    });

    return prisma.category.create({
      data: {
        restaurantId,
        ...data,
        sortOrder: data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateCategory(
    categoryId: string,
    restaurantId: string,
    data: Partial<CreateCategoryInput & { isActive: boolean }>
  ) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId },
    });

    if (!category) {
      throw new NotFoundError('Category');
    }

    return prisma.category.update({
      where: { id: categoryId },
      data,
    });
  }

  async deleteCategory(categoryId: string, restaurantId: string) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, restaurantId },
      include: { _count: { select: { menuItems: true } } },
    });

    if (!category) {
      throw new NotFoundError('Category');
    }

    if (category._count.menuItems > 0) {
      throw new ValidationError('Cannot delete category with menu items. Move or delete items first.');
    }

    await prisma.category.delete({ where: { id: categoryId } });
  }

  async reorderCategories(restaurantId: string, categoryIds: string[]) {
    const updates = categoryIds.map((id, index) =>
      prisma.category.updateMany({
        where: { id, restaurantId },
        data: { sortOrder: index + 1 },
      })
    );

    await prisma.$transaction(updates);
  }

  // ==================== MENU ITEMS ====================

  async getMenuItems(restaurantId: string, filters?: MenuItemFilters) {
    const where: Prisma.MenuItemWhereInput = {
      restaurantId,
      ...(filters?.categoryId && { categoryId: filters.categoryId }),
      ...(filters?.isAvailable !== undefined && { isAvailable: filters.isAvailable }),
      ...(filters?.isVeg !== undefined && { isVeg: filters.isVeg }),
      ...(filters?.tags && filters.tags.length > 0 && { tags: { hasSome: filters.tags } }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { shortName: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    return prisma.menuItem.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        modifierLinks: {
          include: {
            modifierGroup: {
              include: {
                options: {
                  where: { isAvailable: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
  }

  async getMenuItemById(itemId: string, restaurantId: string) {
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId },
      include: {
        category: { select: { id: true, name: true } },
        modifierLinks: {
          include: {
            modifierGroup: {
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!item) {
      throw new NotFoundError('Menu item');
    }

    return item;
  }

  async createMenuItem(restaurantId: string, data: CreateMenuItemInput) {
    const { modifierGroupIds, ...itemData } = data;

    // Verify category exists
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, restaurantId },
    });

    if (!category) {
      throw new ValidationError('Category not found');
    }

    // Get max sort order in category
    const maxSort = await prisma.menuItem.aggregate({
      where: { categoryId: data.categoryId },
      _max: { sortOrder: true },
    });

    return prisma.menuItem.create({
      data: {
        restaurantId,
        ...itemData,
        basePrice: new Prisma.Decimal(data.basePrice),
        taxRate: new Prisma.Decimal(data.taxRate ?? 5),
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        modifierLinks: modifierGroupIds
          ? {
              create: modifierGroupIds.map((groupId, index) => ({
                modifierGroupId: groupId,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        modifierLinks: {
          include: { modifierGroup: { include: { options: true } } },
        },
      },
    });
  }

  async updateMenuItem(
    itemId: string,
    restaurantId: string,
    data: UpdateMenuItemInput
  ) {
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    });

    if (!item) {
      throw new NotFoundError('Menu item');
    }

    // If changing category, verify new category exists
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, restaurantId },
      });
      if (!category) {
        throw new ValidationError('Category not found');
      }
    }

    return prisma.menuItem.update({
      where: { id: itemId },
      data: {
        ...data,
        ...(data.basePrice !== undefined && {
          basePrice: new Prisma.Decimal(data.basePrice),
        }),
        ...(data.taxRate !== undefined && {
          taxRate: new Prisma.Decimal(data.taxRate),
        }),
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async deleteMenuItem(itemId: string, restaurantId: string) {
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    });

    if (!item) {
      throw new NotFoundError('Menu item');
    }

    await prisma.menuItem.delete({ where: { id: itemId } });
  }

  // Toggle availability (for 86ing items)
  async toggleAvailability(itemId: string, restaurantId: string, isAvailable: boolean) {
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    });

    if (!item) {
      throw new NotFoundError('Menu item');
    }

    return prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable },
    });
  }

  // Bulk toggle availability by names (for AI)
  async bulkToggleAvailability(
    restaurantId: string,
    itemNames: string[],
    isAvailable: boolean
  ): Promise<MenuItem[]> {
    // Find items matching the names
    const items = await prisma.menuItem.findMany({
      where: {
        restaurantId,
        OR: itemNames.map((name) => ({
          name: { contains: name, mode: 'insensitive' },
        })),
      },
    });

    if (items.length === 0) {
      return [];
    }

    await prisma.menuItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { isAvailable },
    });

    return items;
  }

  // ==================== PRICE UPDATES ====================

  async previewBulkPriceUpdate(
    restaurantId: string,
    filter: { categoryId?: string; categoryName?: string; itemIds?: string[] },
    update: BulkPriceUpdateParams
  ): Promise<{ items: MenuItem[]; preview: PriceUpdatePreview[] }> {
    let categoryId = filter.categoryId;

    // Find category by name if provided
    if (filter.categoryName && !categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          restaurantId,
          name: { contains: filter.categoryName, mode: 'insensitive' },
        },
      });
      if (category) {
        categoryId = category.id;
      }
    }

    // Find matching items
    const items = await prisma.menuItem.findMany({
      where: {
        restaurantId,
        ...(categoryId && { categoryId }),
        ...(filter.itemIds && filter.itemIds.length > 0 && { id: { in: filter.itemIds } }),
      },
    });

    // Calculate new prices
    const preview: PriceUpdatePreview[] = items.map((item) => {
      const currentPrice = Number(item.basePrice);
      let newPrice: number;

      if (update.isPercentage) {
        const change = currentPrice * (update.value / 100);
        newPrice =
          update.type === 'INCREMENT'
            ? currentPrice + change
            : update.type === 'DECREMENT'
            ? currentPrice - change
            : update.value;
      } else {
        newPrice =
          update.type === 'INCREMENT'
            ? currentPrice + update.value
            : update.type === 'DECREMENT'
            ? currentPrice - update.value
            : update.value;
      }

      // Round to 2 decimal places and ensure not negative
      newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

      return {
        itemId: item.id,
        itemName: item.name,
        oldPrice: currentPrice,
        newPrice,
      };
    });

    return { items, preview };
  }

  async executeBulkPriceUpdate(
    updates: { itemId: string; newPrice: number }[]
  ): Promise<number> {
    const operations = updates.map((u) =>
      prisma.menuItem.update({
        where: { id: u.itemId },
        data: { basePrice: new Prisma.Decimal(u.newPrice) },
      })
    );

    await prisma.$transaction(operations);
    return updates.length;
  }

  // ==================== MODIFIERS ====================

  async getModifierGroups(restaurantId: string) {
    return prisma.modifierGroup.findMany({
      where: { restaurantId },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { menuItemLinks: true },
        },
      },
    });
  }

  async createModifierGroup(
    restaurantId: string,
    data: {
      name: string;
      displayName?: string;
      selectionType?: 'SINGLE' | 'MULTIPLE';
      minSelection?: number;
      maxSelection?: number;
      isRequired?: boolean;
      options?: { name: string; price: number; isDefault?: boolean }[];
    }
  ) {
    const { options, ...groupData } = data;

    return prisma.modifierGroup.create({
      data: {
        restaurantId,
        ...groupData,
        options: options
          ? {
              create: options.map((opt, index) => ({
                ...opt,
                price: new Prisma.Decimal(opt.price),
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async linkModifiersToItem(
    itemId: string,
    restaurantId: string,
    modifierGroupIds: string[]
  ) {
    // Verify item exists
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId, restaurantId },
    });

    if (!item) {
      throw new NotFoundError('Menu item');
    }

    // Delete existing links
    await prisma.menuItemModifier.deleteMany({
      where: { menuItemId: itemId },
    });

    // Create new links
    await prisma.menuItemModifier.createMany({
      data: modifierGroupIds.map((groupId, index) => ({
        menuItemId: itemId,
        modifierGroupId: groupId,
        sortOrder: index,
      })),
    });

    return this.getMenuItemById(itemId, restaurantId);
  }

  // ==================== SEARCH ====================

  async searchItems(restaurantId: string, query: string, limit = 10) {
    return prisma.menuItem.findMany({
      where: {
        restaurantId,
        isAvailable: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { shortName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query.toLowerCase()] } },
        ],
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }
}

export const menuService = new MenuService();
