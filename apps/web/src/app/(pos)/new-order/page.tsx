'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Search, Plus, Minus, Trash2, Send, ShoppingCart } from 'lucide-react';
import { apiClient } from '@/services/api';
import { useMenuStore } from '@/stores/menuStore';
import { useOrderStore } from '@/stores/orderStore';
import type { MenuItem } from '@/types';

export default function NewOrderPage() {
  const router = useRouter();

  const { categories, menuItems, selectedCategory, searchQuery, setCategories, setMenuItems, setSelectedCategory, setSearchQuery } = useMenuStore();
  const { cart, selectedTable, orderType, covers, addToCart, updateCartItem, removeFromCart, clearCart, setOrderType, setCovers, getCartTotal, resetOrderForm } = useOrderStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        apiClient.menu.getCategories(),
        apiClient.menu.getItems({ isAvailable: true }),
      ]);

      setCategories(catRes.data.data.categories);
      setMenuItems(itemsRes.data.data.items);
    } catch (error) {
      console.error('Failed to load menu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.isAvailable;
  });

  const handleAddItem = (item: MenuItem) => {
    addToCart(item, 1);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;

    setIsSubmitting(true);
    try {
      const orderData = {
        orderType,
        tableId: selectedTable?.id,
        covers: orderType === 'DINE_IN' ? covers : undefined,
        items: cart.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: item.modifiers,
        })),
      };

      await apiClient.orders.create(orderData);
      resetOrderForm();
      router.push('/orders');
    } catch (error) {
      console.error('Failed to create order:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Menu Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search & Categories */}
        <div className="mb-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <button
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                !selectedCategory ? 'bg-primary-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              )}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  selectedCategory === cat.id ? 'bg-primary-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  className="p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={clsx(
                      'w-4 h-4 rounded-sm border-2 flex-shrink-0',
                      item.isVeg ? 'border-green-500' : 'border-red-500'
                    )}>
                      <span className={clsx(
                        'block w-2 h-2 rounded-full m-0.5',
                        item.isVeg ? 'bg-green-500' : 'bg-red-500'
                      )} />
                    </span>
                    <Plus className="w-5 h-5 text-primary-500" />
                  </div>
                  <h4 className="font-medium text-gray-900 line-clamp-2">{item.name}</h4>
                  <p className="text-lg font-bold text-primary-600 mt-2">
                    ₹{Number(item.basePrice).toFixed(0)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-white rounded-xl border border-gray-200 flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              {selectedTable ? `Table ${selectedTable.name}` : 'New Order'}
            </h3>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-600">
                Clear
              </button>
            )}
          </div>

          {/* Order Type */}
          <div className="flex gap-2">
            {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={clsx(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                  orderType === type ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'
                )}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>

          {orderType === 'DINE_IN' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-500">Covers:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCovers(Math.max(1, covers - 1))}
                  className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-medium">{covers}</span>
                <button
                  onClick={() => setCovers(covers + 1)}
                  className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-2" />
              <p>Cart is empty</p>
              <p className="text-sm">Add items from the menu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.menuItem.name}</p>
                    <p className="text-sm text-gray-500">
                      ₹{Number(item.menuItem.basePrice).toFixed(0)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartItem(index, item.quantity - 1)}
                      className="w-7 h-7 bg-white border rounded flex items-center justify-center hover:bg-gray-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateCartItem(index, item.quantity + 1)}
                      className="w-7 h-7 bg-white border rounded flex items-center justify-center hover:bg-gray-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="w-7 h-7 text-red-500 hover:bg-red-50 rounded flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-medium text-gray-900 w-16 text-right">
                    ₹{item.totalPrice.toFixed(0)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-xl font-bold text-gray-900">
              ₹{getCartTotal().toFixed(0)}
            </span>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full btn btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5 mr-2" />
            {isSubmitting ? 'Creating Order...' : 'Send to Kitchen'}
          </button>
        </div>
      </div>
    </div>
  );
}
