import { Request } from 'express';
import { User, Restaurant } from '@prisma/client';

// Extend Express Request with authenticated user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    restaurantId: string;
    role: string;
    name: string;
    email: string;
  };
  restaurant?: Restaurant;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  restaurantId: string;
  role: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

// AI Types
export interface ParsedIntent {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface AIResponse {
  message: string;
  intent: string;
  requiresConfirmation: boolean;
  preview?: {
    type: string;
    changes: unknown[];
  };
  pendingAction?: () => Promise<unknown>;
}

// Socket Events
export interface SocketEvents {
  // Order events
  'order:created': { orderId: string; tableId?: string };
  'order:updated': { orderId: string; status: string };
  'order:cancelled': { orderId: string };

  // KOT events
  'kot:created': { kotId: string; orderId: string };
  'kot:updated': { kotId: string; status: string };

  // Table events
  'table:status-changed': { tableId: string; status: string };

  // Menu events
  'menu:item-updated': { itemId: string };
  'menu:availability-changed': { itemId: string; available: boolean };
}

// Price Update Types
export interface PriceUpdatePreview {
  itemId: string;
  itemName: string;
  oldPrice: number;
  newPrice: number;
}

export interface BulkPriceUpdateParams {
  type: 'INCREMENT' | 'DECREMENT' | 'SET';
  value: number;
  isPercentage?: boolean;
}

// Order Creation Types
export interface CreateOrderItemInput {
  menuItemId: string;
  quantity: number;
  notes?: string;
  modifiers?: {
    name: string;
    price: number;
    groupName?: string;
  }[];
}

export interface CreateOrderInput {
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  tableId?: string;
  covers?: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: CreateOrderItemInput[];
  notes?: string;
}
