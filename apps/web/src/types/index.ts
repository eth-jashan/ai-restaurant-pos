// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN';
  restaurantId: string;
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  restaurantSlug: string;
}

export interface PinLoginCredentials {
  pin: string;
  restaurantId: string;
}

// Menu types
export interface Category {
  id: string;
  name: string;
  description?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
  _count?: {
    menuItems: number;
  };
}

export interface MenuItem {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  image?: string;
  basePrice: number;
  taxRate: number;
  taxInclusive: boolean;
  isVeg: boolean;
  isAvailable: boolean;
  preparationTime?: number;
  tags: string[];
  categoryId: string;
  category?: {
    id: string;
    name: string;
  };
  modifierLinks?: {
    modifierGroup: ModifierGroup;
  }[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  displayName?: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  minSelection: number;
  maxSelection?: number;
  isRequired: boolean;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
}

// Order types
export interface Order {
  id: string;
  orderNumber: number;
  displayNumber?: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  status: OrderStatus;
  tableId?: string;
  table?: RestaurantTable;
  covers?: number;
  customerName?: string;
  customerPhone?: string;
  channel: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  items: OrderItem[];
  kots?: KOT[];
  invoice?: Invoice;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiersPrice: number;
  totalPrice: number;
  notes?: string;
  status: 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  modifiers: OrderItemModifier[];
  kotId?: string;
}

export interface OrderItemModifier {
  id: string;
  modifierName: string;
  modifierPrice: number;
  groupName?: string;
}

export interface KOT {
  id: string;
  kotNumber: number;
  displayNumber?: string;
  status: 'PENDING' | 'PRINTED' | 'ACKNOWLEDGED' | 'PREPARING' | 'COMPLETED' | 'VOID';
  items: OrderItem[];
  createdAt: string;
}

// Table types
export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  section?: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'CLEANING';
  currentOrderId?: string;
}

// Billing types
export interface Invoice {
  id: string;
  invoiceNumber: string;
  fiscalYear: string;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  subtotal: number;
  cgst: number;
  sgst: number;
  discount: number;
  roundOff: number;
  totalAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOID' | 'REFUNDED';
  payments: Payment[];
  paidAt?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'UPI' | 'WALLET' | 'CREDIT' | 'SPLIT';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  receivedAmount?: number;
  changeAmount?: number;
  transactionId?: string;
  processedBy: {
    id: string;
    name: string;
  };
  createdAt: string;
}

// AI types
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  preview?: {
    type: string;
    changes: unknown[];
    actionId?: string;
  };
  requiresConfirmation?: boolean;
}

export interface AIResponse {
  message: string;
  intent: string;
  requiresConfirmation: boolean;
  conversationId?: string;
  preview?: {
    type: string;
    changes: unknown[];
    actionId?: string;
  };
}

// Cart types (for order creation)
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  modifiers: {
    name: string;
    price: number;
    groupName?: string;
  }[];
  totalPrice: number;
}
