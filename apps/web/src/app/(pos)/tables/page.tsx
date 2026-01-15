'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Users, Clock, Plus, X, Edit2, Trash2,
  MoreVertical, CheckCircle, Ban, Clock4, Sparkles
} from 'lucide-react';
import { apiClient } from '@/services/api';
import { useOrderStore } from '@/stores/orderStore';
import type { RestaurantTable, Order } from '@/types';

interface TableWithOrder extends RestaurantTable {
  orders?: Order[];
}

interface TableFormData {
  name: string;
  capacity: number;
  section: string;
}

const statusColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  AVAILABLE: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', label: 'Available' },
  OCCUPIED: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Occupied' },
  RESERVED: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', label: 'Reserved' },
  BLOCKED: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'Blocked' },
  CLEANING: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Cleaning' },
};

const statusActions = [
  { status: 'AVAILABLE', label: 'Mark Available', icon: CheckCircle, color: 'text-green-600' },
  { status: 'RESERVED', label: 'Mark Reserved', icon: Clock4, color: 'text-yellow-600' },
  { status: 'BLOCKED', label: 'Block Table', icon: Ban, color: 'text-gray-600' },
  { status: 'CLEANING', label: 'Mark Cleaning', icon: Sparkles, color: 'text-blue-600' },
];

export default function TablesPage() {
  const router = useRouter();
  const setSelectedTable = useOrderStore((s) => s.setSelectedTable);

  const [tables, setTables] = useState<TableWithOrder[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableWithOrder | null>(null);
  const [contextMenu, setContextMenu] = useState<{ table: TableWithOrder; x: number; y: number } | null>(null);

  // Form states
  const [formData, setFormData] = useState<TableFormData>({ name: '', capacity: 4, section: '' });
  const [bulkData, setBulkData] = useState({ prefix: 'Table', count: 5, startNumber: 1, capacity: 4, section: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTables = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleTableClick = (table: TableWithOrder) => {
    if (table.status === 'AVAILABLE') {
      setSelectedTable(table);
      router.push('/new-order');
    } else if (table.status === 'OCCUPIED' && table.orders?.[0]) {
      router.push(`/orders?orderId=${table.orders[0].id}`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, table: TableWithOrder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ table, x: e.clientX, y: e.clientY });
  };

  const handleStatusChange = async (table: TableWithOrder, newStatus: string) => {
    try {
      await apiClient.tables.updateStatus(table.id, newStatus);
      await loadTables();
      setContextMenu(null);
    } catch (error) {
      console.error('Failed to update table status:', error);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.tables.create(formData);
      await loadTables();
      setShowAddModal(false);
      setFormData({ name: '', capacity: 4, section: '' });
    } catch (error) {
      console.error('Failed to create table:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    setIsSubmitting(true);
    try {
      await apiClient.tables.update(editingTable.id, formData);
      await loadTables();
      setShowEditModal(false);
      setEditingTable(null);
      setFormData({ name: '', capacity: 4, section: '' });
    } catch (error) {
      console.error('Failed to update table:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.tables.createBulk(bulkData);
      await loadTables();
      setShowBulkModal(false);
      setBulkData({ prefix: 'Table', count: 5, startNumber: 1, capacity: 4, section: '' });
    } catch (error) {
      console.error('Failed to create tables:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (table: TableWithOrder) => {
    if (!confirm(`Are you sure you want to delete ${table.name}?`)) return;
    try {
      await apiClient.tables.delete(table.id);
      await loadTables();
      setContextMenu(null);
    } catch (error) {
      console.error('Failed to delete table:', error);
    }
  };

  const openEditModal = (table: TableWithOrder) => {
    setEditingTable(table);
    setFormData({
      name: table.name,
      capacity: table.capacity,
      section: table.section || '',
    });
    setShowEditModal(true);
    setContextMenu(null);
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
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tables</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Bulk Add
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      </div>

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
      ) : filteredTables.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No tables found. Add your first table!</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredTables.map((table) => {
            const status = statusColors[table.status];
            const activeOrder = table.orders?.[0];

            return (
              <div
                key={table.id}
                onClick={() => handleTableClick(table)}
                onContextMenu={(e) => handleContextMenu(e, table)}
                className={clsx(
                  'relative p-4 rounded-xl border-2 transition-all text-left cursor-pointer group',
                  table.status === 'AVAILABLE' && 'border-green-300 bg-green-50 hover:border-green-400 hover:shadow-md',
                  table.status === 'OCCUPIED' && 'border-red-300 bg-red-50 hover:border-red-400 hover:shadow-md',
                  table.status === 'RESERVED' && 'border-yellow-300 bg-yellow-50 hover:border-yellow-400',
                  table.status === 'BLOCKED' && 'border-gray-200 bg-gray-50',
                  table.status === 'CLEANING' && 'border-blue-300 bg-blue-50'
                )}
              >
                {/* Options button */}
                <button
                  onClick={(e) => handleContextMenu(e, table)}
                  className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/50 transition-all"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>

                <div className="flex items-start justify-between pr-6">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">{table.name}</span>
                    <div className="flex items-center gap-1 text-gray-500 mt-1">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{table.capacity}</span>
                    </div>
                  </div>
                </div>

                <span className={clsx('inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium', status.bg, status.text)}>
                  {status.label}
                </span>

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
              </div>
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-lg shadow-lg border py-2 z-50 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => openEditModal(contextMenu.table)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit Table
          </button>

          <div className="border-t my-1" />

          {statusActions
            .filter(action => action.status !== contextMenu.table.status)
            .map(action => (
              <button
                key={action.status}
                onClick={() => handleStatusChange(contextMenu.table, action.status)}
                className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2', action.color)}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </button>
            ))}

          <div className="border-t my-1" />

          <button
            onClick={() => handleDeleteTable(contextMenu.table)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Table
          </button>
        </div>
      )}

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add New Table</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Table 1, VIP 1, Patio A"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section (Optional)</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData(prev => ({ ...prev, section: e.target.value }))}
                  placeholder="e.g., Main Hall, Outdoor, VIP"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  list="sections-list"
                />
                <datalist id="sections-list">
                  {sections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {showEditModal && editingTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Edit Table</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditTable} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData(prev => ({ ...prev, section: e.target.value }))}
                  placeholder="e.g., Main Hall, Outdoor, VIP"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  list="sections-list-edit"
                />
                <datalist id="sections-list-edit">
                  {sections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Bulk Add Tables</h2>
              <button onClick={() => setShowBulkModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                  <input
                    type="text"
                    value={bulkData.prefix}
                    onChange={(e) => setBulkData(prev => ({ ...prev, prefix: e.target.value }))}
                    placeholder="Table"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Number</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkData.startNumber}
                    onChange={(e) => setBulkData(prev => ({ ...prev, startNumber: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Tables</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkData.count}
                    onChange={(e) => setBulkData(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity Each</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={bulkData.capacity}
                    onChange={(e) => setBulkData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section (Optional)</label>
                <input
                  type="text"
                  value={bulkData.section}
                  onChange={(e) => setBulkData(prev => ({ ...prev, section: e.target.value }))}
                  placeholder="e.g., Main Hall, Outdoor"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  list="sections-list-bulk"
                />
                <datalist id="sections-list-bulk">
                  {sections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  This will create: <strong>{bulkData.prefix} {bulkData.startNumber}</strong> through <strong>{bulkData.prefix} {bulkData.startNumber + bulkData.count - 1}</strong>
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : `Create ${bulkData.count} Tables`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
