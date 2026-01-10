import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Handle 401 - attempt token refresh
    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;

          useAuthStore.getState().setTokens(accessToken, newRefreshToken);

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed - logout
          useAuthStore.getState().logout();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      } else {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// API helper functions
export const apiClient = {
  // Auth
  auth: {
    login: (data: { email: string; password: string; restaurantSlug: string }) =>
      api.post('/auth/login', data),
    loginWithPin: (data: { pin: string; restaurantId: string }) =>
      api.post('/auth/login/pin', data),
    register: (data: unknown) => api.post('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
    refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  },

  // Menu
  menu: {
    getCategories: (includeInactive = false) =>
      api.get('/menu/categories', { params: { includeInactive } }),
    getCategory: (id: string) => api.get(`/menu/categories/${id}`),
    createCategory: (data: unknown) => api.post('/menu/categories', data),
    updateCategory: (id: string, data: unknown) => api.patch(`/menu/categories/${id}`, data),
    deleteCategory: (id: string) => api.delete(`/menu/categories/${id}`),
    reorderCategories: (categoryIds: string[]) =>
      api.post('/menu/categories/reorder', { categoryIds }),

    getItems: (params?: { categoryId?: string; search?: string; isAvailable?: boolean }) =>
      api.get('/menu/items', { params }),
    getItem: (id: string) => api.get(`/menu/items/${id}`),
    createItem: (data: unknown) => api.post('/menu/items', data),
    updateItem: (id: string, data: unknown) => api.patch(`/menu/items/${id}`, data),
    deleteItem: (id: string) => api.delete(`/menu/items/${id}`),
    toggleAvailability: (id: string, isAvailable: boolean) =>
      api.post(`/menu/items/${id}/availability`, { isAvailable }),
    searchItems: (q: string, limit = 10) =>
      api.get('/menu/items/search', { params: { q, limit } }),

    getModifiers: () => api.get('/menu/modifiers'),
    createModifier: (data: unknown) => api.post('/menu/modifiers', data),
    linkModifiers: (itemId: string, modifierGroupIds: string[]) =>
      api.post(`/menu/items/${itemId}/modifiers`, { modifierGroupIds }),
  },

  // Orders
  orders: {
    getAll: (params?: {
      status?: string;
      orderType?: string;
      tableId?: string;
      fromDate?: string;
      toDate?: string;
    }) => api.get('/orders', { params }),
    getActive: () => api.get('/orders/active'),
    getOne: (id: string) => api.get(`/orders/${id}`),
    create: (data: unknown) => api.post('/orders', data),
    addItems: (id: string, items: unknown[]) => api.post(`/orders/${id}/items`, { items }),
    updateItem: (itemId: string, data: { quantity?: number; notes?: string }) =>
      api.patch(`/orders/items/${itemId}`, data),
    cancelItem: (itemId: string, reason?: string) =>
      api.post(`/orders/items/${itemId}/cancel`, { reason }),
    updateStatus: (id: string, status: string) =>
      api.patch(`/orders/${id}/status`, { status }),
    cancel: (id: string, reason?: string) =>
      api.post(`/orders/${id}/cancel`, { reason }),

    // KOT
    getPendingKOTs: () => api.get('/orders/kots/pending'),
    createKOT: (orderId: string, itemIds?: string[]) =>
      api.post(`/orders/${orderId}/kot`, { itemIds }),
    updateKOTStatus: (kotId: string, status: string) =>
      api.patch(`/orders/kots/${kotId}/status`, { status }),
  },

  // Tables
  tables: {
    getAll: (params?: { section?: string; status?: string }) =>
      api.get('/tables', { params }),
    getWithOrders: () => api.get('/tables/with-orders'),
    getOne: (id: string) => api.get(`/tables/${id}`),
    getOrders: (id: string) => api.get(`/tables/${id}/orders`),
    create: (data: unknown) => api.post('/tables', data),
    createBulk: (data: {
      prefix: string;
      count: number;
      startNumber?: number;
      capacity?: number;
      section?: string;
    }) => api.post('/tables/bulk', data),
    update: (id: string, data: unknown) => api.patch(`/tables/${id}`, data),
    updateStatus: (id: string, status: string) =>
      api.patch(`/tables/${id}/status`, { status }),
    delete: (id: string) => api.delete(`/tables/${id}`),
    getSections: () => api.get('/tables/sections/list'),
  },

  // Billing
  billing: {
    getInvoices: (params?: {
      status?: string;
      fromDate?: string;
      toDate?: string;
      customerPhone?: string;
    }) => api.get('/billing/invoices', { params }),
    getInvoice: (id: string) => api.get(`/billing/invoices/${id}`),
    getInvoiceByOrder: (orderId: string) => api.get(`/billing/orders/${orderId}/invoice`),
    createInvoice: (data: unknown) => api.post('/billing/invoices', data),
    applyDiscount: (id: string, discount: number, reason?: string) =>
      api.post(`/billing/invoices/${id}/discount`, { discount, reason }),
    voidInvoice: (id: string, reason: string) =>
      api.post(`/billing/invoices/${id}/void`, { reason }),
    processPayment: (data: {
      invoiceId: string;
      amount: number;
      method: string;
      receivedAmount?: number;
      transactionId?: string;
    }) => api.post('/billing/payments', data),
    processSplitPayment: (
      invoiceId: string,
      payments: { amount: number; method: string }[]
    ) => api.post(`/billing/invoices/${invoiceId}/split-payment`, { payments }),

    // Reports
    getDailySummary: (date?: string) =>
      api.get('/billing/reports/daily', { params: { date } }),
    getSalesReport: (fromDate: string, toDate: string) =>
      api.get('/billing/reports/sales', { params: { fromDate, toDate } }),
  },

  // AI
  ai: {
    sendMessage: (message: string, conversationId?: string) =>
      api.post('/ai/message', { message, conversationId }),
    confirmAction: (actionId: string) => api.post('/ai/confirm', { actionId }),
    cancelAction: (actionId: string) => api.post('/ai/cancel', { actionId }),
  },
};

export default api;
