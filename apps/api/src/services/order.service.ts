import { PrismaClient, Prisma, OrderStatus, ItemStatus, TableStatus, KOTStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { CreateOrderInput, CreateOrderItemInput } from '../types';

const prisma = new PrismaClient();

export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableId?: string;
  fromDate?: Date;
  toDate?: Date;
  channel?: string;
}

class OrderService {
  // ==================== ORDER CREATION ====================

  async createOrder(
    restaurantId: string,
    userId: string,
    data: CreateOrderInput
  ) {
    // Get next order number
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { orderCounter: { increment: 1 } },
      select: { orderCounter: true },
    });

    const orderNumber = restaurant.orderCounter;

    // Verify table if dine-in
    if (data.orderType === 'DINE_IN' && data.tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: data.tableId, restaurantId },
      });

      if (!table) {
        throw new ValidationError('Table not found');
      }

      if (table.status !== TableStatus.AVAILABLE && table.status !== TableStatus.OCCUPIED) {
        throw new ValidationError(`Table is ${table.status.toLowerCase()}`);
      }
    }

    // Calculate item prices
    const itemsWithPrices = await this.calculateItemPrices(restaurantId, data.items);

    // Calculate totals
    const subtotal = itemsWithPrices.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = itemsWithPrices.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = subtotal + taxAmount;

    // Create order
    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber,
        displayNumber: `ORD-${orderNumber.toString().padStart(4, '0')}`,
        orderType: data.orderType,
        status: OrderStatus.PENDING,
        tableId: data.tableId,
        covers: data.covers,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        channel: 'POS',
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        notes: data.notes,
        createdById: userId,
        items: {
          create: itemsWithPrices.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            modifiersPrice: new Prisma.Decimal(item.modifiersPrice),
            totalPrice: new Prisma.Decimal(item.totalPrice),
            taxRate: new Prisma.Decimal(item.taxRate),
            taxAmount: new Prisma.Decimal(item.taxAmount),
            notes: item.notes,
            status: ItemStatus.PENDING,
            modifiers: {
              create: item.modifiers,
            },
          })),
        },
      },
      include: {
        items: {
          include: { modifiers: true },
        },
        table: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Update table status if dine-in
    if (data.orderType === 'DINE_IN' && data.tableId) {
      await prisma.restaurantTable.update({
        where: { id: data.tableId },
        data: {
          status: TableStatus.OCCUPIED,
          currentOrderId: order.id,
        },
      });
    }

    return order;
  }

  private async calculateItemPrices(
    restaurantId: string,
    items: CreateOrderItemInput[]
  ) {
    const menuItemIds = items.map((i) => i.menuItemId);

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId,
      },
    });

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

    return items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);

      if (!menuItem) {
        throw new ValidationError(`Menu item not found: ${item.menuItemId}`);
      }

      if (!menuItem.isAvailable) {
        throw new ValidationError(`${menuItem.name} is not available`);
      }

      const unitPrice = Number(menuItem.basePrice);
      const modifiersPrice = item.modifiers?.reduce((sum, m) => sum + m.price, 0) ?? 0;
      const itemTotal = (unitPrice + modifiersPrice) * item.quantity;
      const taxRate = Number(menuItem.taxRate);
      const taxAmount = menuItem.taxInclusive
        ? itemTotal - itemTotal / (1 + taxRate / 100)
        : itemTotal * (taxRate / 100);

      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        quantity: item.quantity,
        unitPrice,
        modifiersPrice,
        totalPrice: itemTotal,
        taxRate,
        taxAmount: Math.round(taxAmount * 100) / 100,
        notes: item.notes,
        modifiers:
          item.modifiers?.map((m) => ({
            modifierName: m.name,
            modifierPrice: new Prisma.Decimal(m.price),
            groupName: m.groupName,
          })) ?? [],
      };
    });
  }

  // ==================== ORDER RETRIEVAL ====================

  async getOrders(restaurantId: string, filters?: OrderFilters) {
    const statusFilter = filters?.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : undefined;

    return prisma.order.findMany({
      where: {
        restaurantId,
        ...(statusFilter && { status: { in: statusFilter } }),
        ...(filters?.orderType && { orderType: filters.orderType }),
        ...(filters?.tableId && { tableId: filters.tableId }),
        ...(filters?.fromDate && { createdAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { createdAt: { lte: filters.toDate } }),
        ...(filters?.channel && { channel: filters.channel as any }),
      },
      include: {
        items: {
          include: { modifiers: true },
        },
        table: { select: { id: true, name: true, section: true } },
        createdBy: { select: { id: true, name: true } },
        kots: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(orderId: string, restaurantId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: {
          include: { modifiers: true, kot: true },
        },
        table: true,
        createdBy: { select: { id: true, name: true } },
        kots: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        invoice: {
          include: { payments: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order');
    }

    return order;
  }

  async getActiveOrders(restaurantId: string) {
    return this.getOrders(restaurantId, {
      status: [
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.SERVED,
      ],
    });
  }

  async getOrdersByTable(tableId: string, restaurantId: string) {
    return prisma.order.findMany({
      where: {
        tableId,
        restaurantId,
        status: {
          notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        },
      },
      include: {
        items: { include: { modifiers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== ORDER UPDATES ====================

  async addItemsToOrder(
    orderId: string,
    restaurantId: string,
    items: CreateOrderItemInput[]
  ) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
    });

    if (!order) {
      throw new NotFoundError('Order');
    }

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      throw new ValidationError('Cannot modify a completed or cancelled order');
    }

    const itemsWithPrices = await this.calculateItemPrices(restaurantId, items);

    // Add items
    await prisma.orderItem.createMany({
      data: itemsWithPrices.map((item) => ({
        orderId,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        modifiersPrice: new Prisma.Decimal(item.modifiersPrice),
        totalPrice: new Prisma.Decimal(item.totalPrice),
        taxRate: new Prisma.Decimal(item.taxRate),
        taxAmount: new Prisma.Decimal(item.taxAmount),
        notes: item.notes,
        status: ItemStatus.PENDING,
      })),
    });

    // Recalculate totals
    await this.recalculateOrderTotals(orderId);

    return this.getOrderById(orderId, restaurantId);
  }

  async updateOrderItem(
    itemId: string,
    restaurantId: string,
    data: { quantity?: number; notes?: string }
  ) {
    const item = await prisma.orderItem.findFirst({
      where: { id: itemId },
      include: { order: true },
    });

    if (!item || item.order.restaurantId !== restaurantId) {
      throw new NotFoundError('Order item');
    }

    if (item.status !== ItemStatus.PENDING) {
      throw new ValidationError('Cannot modify item after it has been sent to kitchen');
    }

    if (data.quantity !== undefined && data.quantity <= 0) {
      // Delete item if quantity is 0
      await prisma.orderItem.delete({ where: { id: itemId } });
    } else if (data.quantity !== undefined) {
      const unitTotal = Number(item.unitPrice) + Number(item.modifiersPrice);
      const newTotal = unitTotal * data.quantity;
      const taxAmount = newTotal * (Number(item.taxRate) / 100);

      await prisma.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: data.quantity,
          totalPrice: new Prisma.Decimal(newTotal),
          taxAmount: new Prisma.Decimal(taxAmount),
          notes: data.notes ?? item.notes,
        },
      });
    } else if (data.notes !== undefined) {
      await prisma.orderItem.update({
        where: { id: itemId },
        data: { notes: data.notes },
      });
    }

    await this.recalculateOrderTotals(item.orderId);

    return this.getOrderById(item.orderId, restaurantId);
  }

  async cancelOrderItem(itemId: string, restaurantId: string, reason?: string) {
    const item = await prisma.orderItem.findFirst({
      where: { id: itemId },
      include: { order: true },
    });

    if (!item || item.order.restaurantId !== restaurantId) {
      throw new NotFoundError('Order item');
    }

    await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        status: ItemStatus.CANCELLED,
        notes: reason ? `${item.notes || ''} [CANCELLED: ${reason}]` : item.notes,
      },
    });

    await this.recalculateOrderTotals(item.orderId);

    return this.getOrderById(item.orderId, restaurantId);
  }

  private async recalculateOrderTotals(orderId: string) {
    const items = await prisma.orderItem.findMany({
      where: {
        orderId,
        status: { not: ItemStatus.CANCELLED },
      },
    });

    const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const taxAmount = items.reduce((sum, item) => sum + Number(item.taxAmount), 0);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        totalAmount: new Prisma.Decimal(subtotal + taxAmount),
      },
    });
  }

  // ==================== ORDER STATUS ====================

  async updateOrderStatus(
    orderId: string,
    restaurantId: string,
    status: OrderStatus
  ) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { table: true },
    });

    if (!order) {
      throw new NotFoundError('Order');
    }

    const updateData: any = { status };

    if (status === OrderStatus.CONFIRMED) {
      updateData.confirmedAt = new Date();
    } else if (status === OrderStatus.COMPLETED) {
      updateData.completedAt = new Date();

      // Free up table
      if (order.tableId) {
        await prisma.restaurantTable.update({
          where: { id: order.tableId },
          data: {
            status: TableStatus.CLEANING,
            currentOrderId: null,
          },
        });
      }
    } else if (status === OrderStatus.CANCELLED) {
      updateData.cancelledAt = new Date();

      // Free up table
      if (order.tableId) {
        await prisma.restaurantTable.update({
          where: { id: order.tableId },
          data: {
            status: TableStatus.AVAILABLE,
            currentOrderId: null,
          },
        });
      }
    }

    return prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: { include: { modifiers: true } },
        table: true,
      },
    });
  }

  async cancelOrder(orderId: string, restaurantId: string, reason?: string) {
    const order = await this.updateOrderStatus(orderId, restaurantId, OrderStatus.CANCELLED);

    if (reason) {
      await prisma.order.update({
        where: { id: orderId },
        data: { cancelReason: reason },
      });
    }

    return order;
  }

  // ==================== KOT ====================

  async createKOT(orderId: string, restaurantId: string, itemIds?: string[]) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: {
        items: {
          where: {
            status: ItemStatus.PENDING,
            ...(itemIds && { id: { in: itemIds } }),
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order');
    }

    if (order.items.length === 0) {
      throw new ValidationError('No pending items to send to kitchen');
    }

    // Get next KOT number
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { kotCounter: { increment: 1 } },
      select: { kotCounter: true },
    });

    const kotNumber = restaurant.kotCounter;

    // Create KOT
    const kot = await prisma.kOT.create({
      data: {
        orderId,
        kotNumber,
        displayNumber: `KOT-${kotNumber.toString().padStart(4, '0')}`,
        status: KOTStatus.PENDING,
      },
    });

    // Link items to KOT
    await prisma.orderItem.updateMany({
      where: {
        id: { in: order.items.map((i) => i.id) },
      },
      data: {
        kotId: kot.id,
        status: ItemStatus.SENT_TO_KITCHEN,
        sentToKitchenAt: new Date(),
      },
    });

    // Update order status
    if (order.status === OrderStatus.PENDING) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
      });
    }

    return prisma.kOT.findUnique({
      where: { id: kot.id },
      include: {
        items: { include: { modifiers: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            displayNumber: true,
            tableId: true,
            table: { select: { name: true } },
          },
        },
      },
    });
  }

  async updateKOTStatus(kotId: string, restaurantId: string, status: KOTStatus) {
    const kot = await prisma.kOT.findFirst({
      where: { id: kotId },
      include: { order: true },
    });

    if (!kot || kot.order.restaurantId !== restaurantId) {
      throw new NotFoundError('KOT');
    }

    const updateData: any = { status };

    if (status === KOTStatus.PRINTED) {
      updateData.printedAt = new Date();
      updateData.printCount = { increment: 1 };
    } else if (status === KOTStatus.ACKNOWLEDGED) {
      updateData.acknowledgedAt = new Date();

      // Update item status
      await prisma.orderItem.updateMany({
        where: { kotId },
        data: { status: ItemStatus.PREPARING },
      });
    } else if (status === KOTStatus.COMPLETED) {
      updateData.completedAt = new Date();

      // Update item status
      await prisma.orderItem.updateMany({
        where: { kotId },
        data: { status: ItemStatus.READY, preparedAt: new Date() },
      });

      // Check if all KOTs for order are complete
      const pendingKots = await prisma.kOT.count({
        where: {
          orderId: kot.orderId,
          status: { not: KOTStatus.COMPLETED },
          id: { not: kotId },
        },
      });

      if (pendingKots === 0) {
        await prisma.order.update({
          where: { id: kot.orderId },
          data: { status: OrderStatus.READY },
        });
      }
    }

    return prisma.kOT.update({
      where: { id: kotId },
      data: updateData,
      include: { items: { include: { modifiers: true } } },
    });
  }

  async getPendingKOTs(restaurantId: string) {
    return prisma.kOT.findMany({
      where: {
        order: { restaurantId },
        status: { in: [KOTStatus.PENDING, KOTStatus.PRINTED, KOTStatus.ACKNOWLEDGED, KOTStatus.PREPARING] },
      },
      include: {
        items: { include: { modifiers: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            displayNumber: true,
            orderType: true,
            tableId: true,
            table: { select: { name: true, section: true } },
            customerName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const orderService = new OrderService();
