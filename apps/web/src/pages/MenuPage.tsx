import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiClient } from '../services/api';
import { useMenuStore } from '../stores/menuStore';
import type { MenuItem, Category } from '../types';

export default function MenuPage() {
  const { categories, menuItems, selectedCategory, searchQuery, setCategories, setMenuItems, setSelectedCategory, setSearchQuery, updateItemAvailability } = useMenuStore();

  const [isLoading, setIsLoading] = useState(true);
  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        apiClient.menu.getCategories(true),
        apiClient.menu.getItems(),
      ]);

      setCategories(catRes.data.data.categories);
      setMenuItems(itemsRes.data.data.items);
    } catch (error) {
      console.error('Failed to load menu:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    const newState = new Set(togglingItems);
    newState.add(item.id);
    setTogglingItems(newState);

    try {
      await apiClient.menu.toggleAvailability(item.id, !item.isAvailable);
      updateItemAvailability(item.id, !item.isAvailable);
    } catch (error) {
      console.error('Failed to toggle availability:', error);
    } finally {
      newState.delete(item.id);
      setTogglingItems(new Set(newState));
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const groupedItems = filteredItems.reduce(
    (acc, item) => {
      const categoryName = item.category?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(item);
      return acc;
    },
    {} as Record<string, MenuItem[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <button className="btn btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Add Item
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setSelectedCategory(null)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            !selectedCategory ? 'bg-primary-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
          )}
        >
          All Categories
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
            {cat.name} ({cat._count?.menuItems || 0})
          </button>
        ))}
      </div>

      {/* Menu Items */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([categoryName, items]) => (
            <div key={categoryName}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{categoryName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={clsx(
                      'card p-4 transition-opacity',
                      !item.isAvailable && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <span className={clsx(
                          'w-5 h-5 rounded-sm border-2 flex-shrink-0 mt-0.5',
                          item.isVeg ? 'border-green-500' : 'border-red-500'
                        )}>
                          <span className={clsx(
                            'block w-2.5 h-2.5 rounded-full m-0.5',
                            item.isVeg ? 'bg-green-500' : 'bg-red-500'
                          )} />
                        </span>
                        <div>
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <span className="text-lg font-bold text-primary-600">
                        ₹{Number(item.basePrice).toFixed(0)}
                      </span>

                      <button
                        onClick={() => handleToggleAvailability(item)}
                        disabled={togglingItems.has(item.id)}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          item.isAvailable
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        )}
                      >
                        {item.isAvailable ? (
                          <>
                            <ToggleRight className="w-4 h-4" />
                            Available
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4" />
                            Unavailable
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
