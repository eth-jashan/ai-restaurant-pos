'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingCart,
  Users,
  DollarSign,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { apiClient } from '@/services/api';

interface DailySummary {
  totalRevenue: number;
  totalOrders: number;
  totalCovers: number;
  averageOrderValue: number;
  netRevenue: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await apiClient.billing.getDailySummary();
      setSummary(response.data.data.summary);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);

  const stats = [
    {
      label: "Today's Revenue",
      value: summary ? formatCurrency(summary.totalRevenue) : '---',
      icon: DollarSign,
      color: 'bg-green-500',
      change: '+12%',
    },
    {
      label: 'Total Orders',
      value: summary?.totalOrders ?? '---',
      icon: ShoppingCart,
      color: 'bg-blue-500',
      change: '+8%',
    },
    {
      label: 'Covers',
      value: summary?.totalCovers ?? '---',
      icon: Users,
      color: 'bg-purple-500',
      change: '+5%',
    },
    {
      label: 'Avg Order Value',
      value: summary ? formatCurrency(summary.averageOrderValue) : '---',
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '+3%',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isLoading ? (
                    <span className="inline-block w-24 h-8 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-4 text-sm">
              <ArrowUpRight className="w-4 h-4 text-green-500" />
              <span className="text-green-600 font-medium">{stat.change}</span>
              <span className="text-gray-400">vs yesterday</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Orders</h3>
            <Link href="/orders" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Order #{1000 + i}</p>
                      <p className="text-sm text-gray-500">Table T{i}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">₹{(Math.random() * 500 + 200).toFixed(0)}</p>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                      Preparing
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Today&apos;s Timeline</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {[
                { time: '10:00 AM', event: 'Day started', orders: 0 },
                { time: '12:00 PM', event: 'Lunch rush', orders: 15 },
                { time: '02:00 PM', event: 'Post-lunch', orders: 28 },
                { time: 'Now', event: 'Current', orders: summary?.totalOrders ?? 0 },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-16 text-sm text-gray-500">{item.time}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{item.event}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{item.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
