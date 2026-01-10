import { useLocation } from 'react-router-dom';
import { Bot, Bell, Search } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tables': 'Table Management',
  '/new-order': 'New Order',
  '/orders': 'Active Orders',
  '/menu': 'Menu Management',
  '/billing': 'Billing',
};

export default function Header() {
  const location = useLocation();
  const togglePanel = useAIStore((s) => s.togglePanel);
  const isPanelOpen = useAIStore((s) => s.isPanelOpen);

  const title = pageTitles[location.pathname] || 'OrderMind';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-64 pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Notifications */}
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* AI Assistant toggle */}
        <button
          onClick={togglePanel}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isPanelOpen
              ? 'bg-accent-500 text-white'
              : 'bg-accent-50 text-accent-700 hover:bg-accent-100'
          }`}
        >
          <Bot className="w-5 h-5" />
          <span className="font-medium">AI Assistant</span>
        </button>
      </div>
    </header>
  );
}
