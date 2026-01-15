import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { AIAssistantPanel } from '../ai/AIAssistantPanel';
import { useAIStore } from '../../stores/aiStore';

export default function MainLayout() {
  const isPanelOpen = useAIStore((s) => s.isPanelOpen);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* AI Assistant Panel */}
      <AIAssistantPanel isOpen={isPanelOpen} />
    </div>
  );
}
