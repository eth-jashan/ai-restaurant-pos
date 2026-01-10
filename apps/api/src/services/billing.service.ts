import {
  PrismaClient,
  Prisma,
  OrderStatus,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
} from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';

const prisma = new PrismaClient();

export interface CreateInvoiceInput {
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerGstin?: string;
  customerAddress?: string;
  discount?: number;
  discountReason?: string;
}

export interface ProcessPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  receivedAmount?: number;
  transactionId?: string;
  notes?: string;
}

class BillingService {
  // ==================== INVOICES ====================

  async createInvoice(restaurantId: string, userId: string, data: CreateInvoiceInput) {
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, restaurantId },
      include: { invoice: true },
    });

    if (!order) {
      throw new NotFoundError('Order');
    }

    if (order.invoice) {
      throw new ValidationError('Invoice already exists for this order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new ValidationError('Cannot create invoice for cancelled order');
    }

    // Get next invoice number and fiscal year
    const now = new Date();
    const restaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { invoiceCounter: { increment: 1 } },
      select: { invoiceCounter: true, fiscalYearStart: true },
    });

    const fiscalYear = this.getFiscalYear(now, restaurant.fiscalYearStart);
    const invoiceNumber = `INV-${fiscalYear}-${restaurant.invoiceCounter.toString().padStart(5, '0')}`;

    // Calculate tax breakdown (assuming 50-50 CGST-SGST split for intra-state)
    const subtotal = Number(order.subtotal);
    const discount = data.discount ?? 0;
    const discountedSubtotal = subtotal - discount;
    const taxAmount = Number(order.taxAmount) * (discountedSubtotal / subtotal);
    const cgst = taxAmount / 2;
    const sgst = taxAmount / 2;

    // Calculate round-off
    const calculatedTotal = discountedSubtotal + taxAmount;
    const roundedTotal = Math.round(calculatedTotal);
    const roundOff = roundedTotal - calculatedTotal;

    const invoice = await prisma.invoice.create({
      data: {
        restaurantId,
        orderId: data.orderId,
        invoiceNumber,
        fiscalYear,
        customerName: data.customerName || order.customerName,
        customerPhone: data.customerPhone || order.customerPhone,
        customerEmail: data.customerEmail,
        customerGstin: data.customerGstin,
        customerAddress: data.customerAddress,
        subtotal: new Prisma.Decimal(discountedSubtotal),
        cgst: new Prisma.Decimal(cgst),
        sgst: new Prisma.Decimal(sgst),
        discount: new Prisma.Decimal(discount),
        roundOff: new Prisma.Decimal(roundOff),
        totalAmount: new Prisma.Decimal(roundedTotal),
        status: InvoiceStatus.UNPAID,
      },
      include: {
        order: {
          include: {
            items: { include: { modifiers: true } },
            table: { select: { name: true } },
          },
        },
      },
    });

    // Update order with discount if applied
    if (discount > 0) {
      await prisma.order.update({
        where: { id: data.orderId },
        data: {
          discountAmount: new Prisma.Decimal(discount),
          discountReason: data.discountReason,
        },
      });
    }

    return invoice;
  }

  private getFiscalYear(date: Date, fiscalYearStartMonth: number): string {
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();

    if (month >= fiscalYearStartMonth) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  async getInvoice(invoiceId: string, restaurantId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, restaurantId },
      include: {
        order: {
          include: {
            items: { include: { modifiers: true } },
            table: { select: { name: true } },
            createdBy: { select: { name: true } },
          },
        },
        payments: {
          include: { processedBy: { select: { name: true } } },
        },
        restaurant: {
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            email: true,
            gstin: true,
            fssaiNumber: true,
            logo: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice');
    }

    return invoice;
  }

  async getInvoiceByOrder(orderId: string, restaurantId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { orderId, restaurantId },
      include: {
        order: {
          include: {
            items: { include: { modifiers: true } },
            table: { select: { name: true } },
          },
        },
        payments: true,
      },
    });

    return invoice;
  }

  async getInvoices(
    restaurantId: string,
    filters?: {
      status?: InvoiceStatus;
      fromDate?: Date;
      toDate?: Date;
      customerPhone?: string;
    }
  ) {
    return prisma.invoice.findMany({
      where: {
        restaurantId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.fromDate && { createdAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { createdAt: { lte: filters.toDate } }),
        ...(filters?.customerPhone && {
          customerPhone: { contains: filters.customerPhone },
        }),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            displayNumber: true,
            orderType: true,
            table: { select: { name: true } },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async applyDiscount(
    invoiceId: string,
    restaurantId: string,
    discount: number,
    reason?: string
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, restaurantId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ValidationError('Cannot modify a paid invoice');
    }

    const originalSubtotal = Number(invoice.subtotal) + Number(invoice.discount);
    const newSubtotal = originalSubtotal - discount;

    if (newSubtotal < 0) {
      throw new ValidationError('Discount cannot exceed subtotal');
    }

    const taxRate = (Number(invoice.cgst) + Number(invoice.sgst)) / Number(invoice.subtotal);
    const newTax = newSubtotal * taxRate;
    const newCgst = newTax / 2;
    const newSgst = newTax / 2;

    const calculatedTotal = newSubtotal + newTax;
    const roundedTotal = Math.round(calculatedTotal);
    const roundOff = roundedTotal - calculatedTotal;

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal: new Prisma.Decimal(newSubtotal),
        cgst: new Prisma.Decimal(newCgst),
        sgst: new Prisma.Decimal(newSgst),
        discount: new Prisma.Decimal(discount),
        roundOff: new Prisma.Decimal(roundOff),
        totalAmount: new Prisma.Decimal(roundedTotal),
      },
    });
  }

  async voidInvoice(invoiceId: string, restaurantId: string, reason: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, restaurantId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new ValidationError('Invoice is already void');
    }

    // If there are payments, they would need to be refunded
    if (invoice.payments.length > 0 && invoice.status === InvoiceStatus.PAID) {
      throw new ValidationError('Cannot void a paid invoice. Process a refund instead.');
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.VOID,
        voidedAt: new Date(),
        voidReason: reason,
      },
    });
  }

  // ==================== PAYMENTS ====================

  async processPayment(restaurantId: string, userId: string, data: ProcessPaymentInput) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, restaurantId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ValidationError('Invoice is already fully paid');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new ValidationError('Cannot process payment for void invoice');
    }

    // Calculate remaining amount
    const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(invoice.totalAmount) - paidAmount;

    if (data.amount > remaining + 0.01) {
      // Small tolerance for rounding
      throw new ValidationError(`Payment amount exceeds remaining balance of ₹${remaining.toFixed(2)}`);
    }

    // For cash payments, calculate change
    let changeAmount: number | undefined;
    if (data.method === PaymentMethod.CASH && data.receivedAmount) {
      if (data.receivedAmount < data.amount) {
        throw new ValidationError('Received amount is less than payment amount');
      }
      changeAmount = data.receivedAmount - data.amount;
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: new Prisma.Decimal(data.amount),
        method: data.method,
        status: PaymentStatus.COMPLETED,
        receivedAmount: data.receivedAmount
          ? new Prisma.Decimal(data.receivedAmount)
          : undefined,
        changeAmount: changeAmount ? new Prisma.Decimal(changeAmount) : undefined,
        transactionId: data.transactionId,
        processedById: userId,
        notes: data.notes,
      },
    });

    // Check if invoice is fully paid
    const newPaidAmount = paidAmount + data.amount;
    const isFullyPaid = Math.abs(newPaidAmount - Number(invoice.totalAmount)) < 0.01;

    if (isFullyPaid) {
      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: new Date(),
        },
      });

      // Complete the order
      await prisma.order.update({
        where: { id: invoice.orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } else {
      await prisma.invoice.update({
        where: { id: data.invoiceId },
        data: { status: InvoiceStatus.PARTIAL },
      });
    }

    return {
      payment,
      changeAmount,
      remainingAmount: Number(invoice.totalAmount) - newPaidAmount,
      isFullyPaid,
    };
  }

  async processSplitPayment(
    restaurantId: string,
    userId: string,
    invoiceId: string,
    payments: { amount: number; method: PaymentMethod }[]
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, restaurantId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice');
    }

    const totalPayment = payments.reduce((sum, p) => sum + p.amount, 0);
    const invoiceTotal = Number(invoice.totalAmount);

    if (Math.abs(totalPayment - invoiceTotal) > 0.01) {
      throw new ValidationError(
        `Split payments total (₹${totalPayment.toFixed(2)}) must equal invoice total (₹${invoiceTotal.toFixed(2)})`
      );
    }

    // Process each payment
    const results = [];
    for (const p of payments) {
      const result = await this.processPayment(restaurantId, userId, {
        invoiceId,
        amount: p.amount,
        method: p.method,
      });
      results.push(result);
    }

    return results;
  }

  // ==================== REPORTS ====================

  async getDailySummary(restaurantId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get invoices for the day
    const invoices = await prisma.invoice.findMany({
      where: {
        restaurantId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { in: [InvoiceStatus.PAID, InvoiceStatus.PARTIAL] },
      },
      include: {
        payments: true,
        order: { select: { covers: true } },
      },
    });

    // Calculate totals
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalTax = invoices.reduce(
      (sum, inv) => sum + Number(inv.cgst) + Number(inv.sgst),
      0
    );
    const totalDiscount = invoices.reduce((sum, inv) => sum + Number(inv.discount), 0);
    const totalOrders = invoices.length;
    const totalCovers = invoices.reduce((sum, inv) => sum + (inv.order.covers ?? 0), 0);

    // Payment breakdown
    const paymentBreakdown = invoices
      .flatMap((inv) => inv.payments)
      .reduce(
        (acc, payment) => {
          const method = payment.method;
          acc[method] = (acc[method] ?? 0) + Number(payment.amount);
          return acc;
        },
        {} as Record<PaymentMethod, number>
      );

    return {
      date: startOfDay,
      totalRevenue,
      totalTax,
      totalDiscount,
      netRevenue: totalRevenue - totalTax,
      totalOrders,
      totalCovers,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      paymentBreakdown,
    };
  }

  async getSalesReport(
    restaurantId: string,
    fromDate: Date,
    toDate: Date
  ) {
    const invoices = await prisma.invoice.findMany({
      where: {
        restaurantId,
        createdAt: { gte: fromDate, lte: toDate },
        status: { in: [InvoiceStatus.PAID, InvoiceStatus.PARTIAL] },
      },
      include: {
        order: {
          include: {
            items: true,
          },
        },
      },
    });

    // Aggregate by item
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const invoice of invoices) {
      for (const item of invoice.order.items) {
        if (!itemSales[item.menuItemId]) {
          itemSales[item.menuItemId] = { name: item.name, quantity: 0, revenue: 0 };
        }
        itemSales[item.menuItemId].quantity += item.quantity;
        itemSales[item.menuItemId].revenue += Number(item.totalPrice);
      }
    }

    // Sort by revenue
    const topItems = Object.entries(itemSales)
      .map(([id, data]) => ({ itemId: id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    return {
      period: { from: fromDate, to: toDate },
      totalInvoices: invoices.length,
      totalRevenue: invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
      topSellingItems: topItems,
    };
  }
}

export const billingService = new BillingService();
