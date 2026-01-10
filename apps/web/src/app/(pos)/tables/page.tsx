'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Users, Clock, Plus } from 'lucide-react';
import { apiClient } from '@/services/api';
import { useOrderStore } from '@/stores/orderStore';
import type { RestaurantTable, Order } from '@/types';

interface TableWithOrder extends RestaurantTable {
  orders?: Order[];
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  AVAILABLE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Available' },
  OCCUPIED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Occupied' },
  RESERVED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Reserved' },
  BLOCKED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Blocked' },
  CLEANING: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Cleaning' },
};

export default function TablesPage() {
  const router = useRouter();
  const setSelectedTable = useOrderStore((s) => s.setSelectedTable);

  const [tables, setTables] = useState<TableWithOrder[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      const [tablesRes, sectionsRes] = await Promise.all([
        apiClient.tables.getWithOrders(),
        apiClient.tables.getSections(),
      ]);

      setTables(tablesRes.data.data.tables);
      setSections(sectionsRes.data.data.sections);
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableClick = (table: TableWithOrder) => {
    if (table.status === 'AVAILABLE') {
      setSelectedTable(table);
      router.push('/new-order');
    } else if (table.status === 'OCCUPIED' && table.orders?.[0]) {
      router.push(`/orders?orderId=${table.orders[0].id}`);
    }
  };

  const filteredTables = selectedSection
    ? tables.filter((t) => t.section === selectedSection)
    : tables;

  const statusCounts = tables.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(statusColors).map(([status, config]) => (
          <div
            key={status}
            className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg', config.bg)}
          >
            <span className={clsx('font-medium text-sm', config.text)}>
              {config.label}
            </span>
            <span className={clsx('font-bold', config.text)}>
              {statusCounts[status] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Section Filter */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedSection(null)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedSection === null
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            All
          </button>
          {sections.map((section) => (
            <button
              key={section}
              onClick={() => setSelectedSection(section)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedSection === section
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {section}
            </button>
          ))}
        </div>
      )}

      {/* Tables Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredTables.map((table) => {
            const status = statusColors[table.status];
            const activeOrder = table.orders?.[0];

            return (
              <button
                key={table.id}
                onClick={() => handleTableClick(table)}
                disabled={table.status === 'BLOCKED'}
                className={clsx(
                  'relative p-4 rounded-xl border-2 transition-all text-left',
                  table.status === 'AVAILABLE' && 'border-green-300 bg-green-50 hover:border-green-400 hover:shadow-md',
                  table.status === 'OCCUPIED' && 'border-red-300 bg-red-50 hover:border-red-400 hover:shadow-md',
                  table.status === 'RESERVED' && 'border-yellow-300 bg-yellow-50',
                  table.status === 'BLOCKED' && 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60',
                  table.status === 'CLEANING' && 'border-blue-300 bg-blue-50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">{table.name}</span>
                    <div className="flex items-center gap-1 text-gray-500 mt-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{table.capacity}</span>
                    </div>
                  </div>
                  <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', status.bg, status.text)}>
                    {status.label}
                  </span>
                </div>

                {activeOrder && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(activeOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      ₹{Number(activeOrder.totalAmount).toFixed(0)}
                    </p>
                  </div>
                )}

                {table.section && (
                  <div className="absolute bottom-2 right-2">
                    <span className="text-xs text-gray-400">{table.section}</span>
                  </div>
                )}
              </button>
            );
          })}

          {/* Add Table Button */}
          <button className="p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-700">
            <Plus className="w-6 h-6" />
            <span className="text-sm font-medium">Add Table</span>
          </button>
        </div>
      )}
    </div>
  );
}
