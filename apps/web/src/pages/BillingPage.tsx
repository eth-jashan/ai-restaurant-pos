import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Search, Receipt, CreditCard, Banknote, Smartphone, Printer, Download } from 'lucide-react';
import { apiClient } from '../services/api';
import type { Invoice, Order } from '../types';

const statusConfig: Record<string, { color: string; label: string; bg: string }> = {
  UNPAID: { color: 'text-red-600', label: 'Unpaid', bg: 'bg-red-100' },
  PARTIAL: { color: 'text-yellow-600', label: 'Partial', bg: 'bg-yellow-100' },
  PAID: { color: 'text-green-600', label: 'Paid', bg: 'bg-green-100' },
  VOID: { color: 'text-gray-600', label: 'Void', bg: 'bg-gray-100' },
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'invoices'>('pending');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ordersRes, invoicesRes] = await Promise.all([
        apiClient.orders.getActive(),
        apiClient.billing.getInvoices(),
      ]);

      const servedOrders = ordersRes.data.data.orders.filter(
        (o: Order) => o.status === 'SERVED' && !o.invoice
      );
      setPendingOrders(servedOrders);
      setInvoices(invoicesRes.data.data.invoices);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvoice = async (orderId: string) => {
    try {
      const response = await apiClient.billing.createInvoice({ orderId });
      const invoice = response.data.data.invoice;
      setSelectedInvoice(invoice);
      setPaymentAmount(invoice.totalAmount.toString());
      loadData();
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedInvoice) return;

    try {
      await apiClient.billing.processPayment({
        invoiceId: selectedInvoice.id,
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        receivedAmount: paymentMethod === 'CASH' ? parseFloat(receivedAmount) : undefined,
      });

      setSelectedInvoice(null);
      setPaymentAmount('');
      setReceivedAmount('');
      loadData();
    } catch (error) {
      console.error('Failed to process payment:', error);
    }
  };

  const changeAmount = paymentMethod === 'CASH' && receivedAmount
    ? parseFloat(receivedAmount) - parseFloat(paymentAmount || '0')
    : 0;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Panel - Orders/Invoices List */}
      <div className="w-96 flex flex-col">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={clsx(
              'flex-1 py-2.5 rounded-lg font-medium transition-colors',
              activeTab === 'pending' ? 'bg-primary-500 text-white' : 'bg-white text-gray-700'
            )}
          >
            Pending ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={clsx(
              'flex-1 py-2.5 rounded-lg font-medium transition-colors',
              activeTab === 'invoices' ? 'bg-primary-500 text-white' : 'bg-white text-gray-700'
            )}
          >
            Invoices
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : activeTab === 'pending' ? (
            pendingOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No pending bills</p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setSelectedInvoice(null);
                  }}
                  className={clsx(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedOrder?.id === order.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold">#{order.displayNumber || order.orderNumber}</span>
                      {order.table && (
                        <span className="ml-2 text-sm text-gray-500">
                          Table {order.table.name}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-lg">
                      ₹{Number(order.totalAmount).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {order.items.length} items
                  </p>
                </button>
              ))
            )
          ) : (
            invoices.map((invoice) => {
              const status = statusConfig[invoice.status];
              return (
                <button
                  key={invoice.id}
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setSelectedOrder(null);
                    setPaymentAmount(invoice.totalAmount.toString());
                  }}
                  className={clsx(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedInvoice?.id === invoice.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold">{invoice.invoiceNumber}</span>
                    </div>
                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', status.bg, status.color)}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-500">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-bold">
                      ₹{Number(invoice.totalAmount).toFixed(0)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Invoice/Payment */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col">
        {selectedOrder && !selectedInvoice ? (
          // Generate Invoice View
          <>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                Generate Invoice
              </h2>
              <p className="text-gray-500">
                Order #{selectedOrder.displayNumber || selectedOrder.orderNumber}
              </p>
            </div>
            <div className="flex-1 p-6">
              <div className="space-y-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {item.name} x{item.quantity}
                    </span>
                    <span>₹{Number(item.totalPrice).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tax</span>
                  <span>₹{Number(selectedOrder.taxAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>₹{Number(selectedOrder.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t">
              <button
                onClick={() => handleCreateInvoice(selectedOrder.id)}
                className="w-full btn btn-primary py-3"
              >
                <Receipt className="w-5 h-5 mr-2" />
                Generate Invoice
              </button>
            </div>
          </>
        ) : selectedInvoice ? (
          // Payment View
          <>
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedInvoice.invoiceNumber}
                  </h2>
                  <p className="text-gray-500">
                    {selectedInvoice.status === 'PAID' ? 'Invoice Paid' : 'Process Payment'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary">
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </button>
                  <button className="btn btn-secondary">
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {/* Amount */}
              <div className="text-center mb-8">
                <p className="text-gray-500">Total Amount</p>
                <p className="text-4xl font-bold text-gray-900">
                  ₹{Number(selectedInvoice.totalAmount).toFixed(2)}
                </p>
              </div>

              {selectedInvoice.status !== 'PAID' && (
                <>
                  {/* Payment Method */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">Payment Method</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { method: 'CASH', icon: Banknote, label: 'Cash' },
                        { method: 'CARD', icon: CreditCard, label: 'Card' },
                        { method: 'UPI', icon: Smartphone, label: 'UPI' },
                      ].map(({ method, icon: Icon, label }) => (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method as 'CASH' | 'CARD' | 'UPI')}
                          className={clsx(
                            'p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all',
                            paymentMethod === method
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <Icon className={clsx('w-6 h-6', paymentMethod === method ? 'text-primary-600' : 'text-gray-500')} />
                          <span className={clsx('font-medium', paymentMethod === method ? 'text-primary-700' : 'text-gray-700')}>
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cash Payment */}
                  {paymentMethod === 'CASH' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Received Amount</label>
                        <input
                          type="number"
                          value={receivedAmount}
                          onChange={(e) => setReceivedAmount(e.target.value)}
                          className="input mt-1 text-xl font-bold text-center"
                          placeholder="0.00"
                        />
                      </div>
                      {changeAmount > 0 && (
                        <div className="p-4 bg-green-50 rounded-xl text-center">
                          <p className="text-sm text-green-600">Change to Return</p>
                          <p className="text-2xl font-bold text-green-700">
                            ₹{changeAmount.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedInvoice.status !== 'PAID' && (
              <div className="p-6 border-t">
                <button
                  onClick={handleProcessPayment}
                  disabled={paymentMethod === 'CASH' && parseFloat(receivedAmount) < parseFloat(paymentAmount)}
                  className="w-full btn btn-primary py-3 disabled:opacity-50"
                >
                  Complete Payment
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Select an order or invoice</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
