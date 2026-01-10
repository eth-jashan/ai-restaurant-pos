import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Clock, User, ChefHat, Check, X, Printer, MoreVertical } from 'lucide-react';
import { apiClient } from '../services/api';
import type { Order } from '../types';

const statusConfig: Record<string, { color: string; label: string; bg: string }> = {
  PENDING: { color: 'text-gray-600', label: 'Pending', bg: 'bg-gray-100' },
  CONFIRMED: { color: 'text-blue-600', label: 'Confirmed', bg: 'bg-blue-100' },
  PREPARING: { color: 'text-orange-600', label: 'Preparing', bg: 'bg-orange-100' },
  READY: { color: 'text-green-600', label: 'Ready', bg: 'bg-green-100' },
  SERVED: { color: 'text-purple-600', label: 'Served', bg: 'bg-purple-100' },
  COMPLETED: { color: 'text-gray-500', label: 'Completed', bg: 'bg-gray-100' },
  CANCELLED: { color: 'text-red-600', label: 'Cancelled', bg: 'bg-red-100' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await apiClient.orders.getActive();
      setOrders(response.data.data.orders);
      if (response.data.data.orders.length > 0) {
        setSelectedOrder(response.data.data.orders[0]);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await apiClient.orders.updateStatus(orderId, newStatus);
      loadOrders();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSendToKitchen = async (orderId: string) => {
    try {
      await apiClient.orders.createKOT(orderId);
      loadOrders();
    } catch (error) {
      console.error('Failed to create KOT:', error);
    }
  };

  const filteredOrders = statusFilter
    ? orders.filter((o) => o.status === statusFilter)
    : orders;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Orders List */}
      <div className="w-96 flex flex-col">
        {/* Status Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setStatusFilter(null)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap',
              !statusFilter ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            All ({orders.length})
          </button>
          {['PENDING', 'PREPARING', 'READY', 'SERVED'].map((status) => {
            const count = orders.filter((o) => o.status === status).length;
            const config = statusConfig[status];
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap',
                  statusFilter === status ? config.bg + ' ' + config.color : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Orders */}
        <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No orders found</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const status = statusConfig[order.status];
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={clsx(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedOrder?.id === order.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-bold text-gray-900">
                        #{order.displayNumber || order.orderNumber}
                      </span>
                      {order.table && (
                        <span className="ml-2 text-sm text-gray-500">
                          Table {order.table.name}
                        </span>
                      )}
                    </div>
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', status.bg, status.color)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>{order.items.length} items</span>
                    <span className="font-medium text-gray-900">
                      ₹{Number(order.totalAmount).toFixed(0)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Order Detail */}
      {selectedOrder ? (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Order #{selectedOrder.displayNumber || selectedOrder.orderNumber}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  {selectedOrder.table && (
                    <span>Table {selectedOrder.table.name}</span>
                  )}
                  <span>{selectedOrder.orderType.replace('_', ' ')}</span>
                  <span>
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Printer className="w-5 h-5 text-gray-500" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mt-4">
              {selectedOrder.status === 'PENDING' && (
                <button
                  onClick={() => handleSendToKitchen(selectedOrder.id)}
                  className="btn btn-primary"
                >
                  <ChefHat className="w-4 h-4 mr-2" />
                  Send to Kitchen
                </button>
              )}
              {selectedOrder.status === 'READY' && (
                <button
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'SERVED')}
                  className="btn btn-primary"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark Served
                </button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(selectedOrder.status) && (
                <button
                  onClick={() => handleStatusUpdate(selectedOrder.id, 'CANCELLED')}
                  className="btn btn-danger"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Items</h3>
            <div className="space-y-3">
              {selectedOrder.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="text-sm text-gray-500">
                        {item.modifiers.map((m) => m.modifierName).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-orange-600 mt-1">Note: {item.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">x{item.quantity}</p>
                    <p className="text-sm text-gray-500">₹{Number(item.totalPrice).toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-gray-50">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span>₹{Number(selectedOrder.taxAmount).toFixed(2)}</span>
              </div>
              {Number(selectedOrder.discountAmount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-₹{Number(selectedOrder.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span>₹{Number(selectedOrder.totalAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
          Select an order to view details
        </div>
      )}
    </div>
  );
}
