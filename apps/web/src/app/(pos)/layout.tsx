'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { AIAssistantPanel } from '@/components/ai/AIAssistantPanel';
import { useAuthStore, useAuthHydration } from '@/stores/authStore';
import { useAIStore } from '@/stores/aiStore';

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthHydration();
  const isPanelOpen = useAIStore((s) => s.isPanelOpen);

  useEffect(() => {
    // Only redirect after hydration is complete
    if (hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Show loading state while hydrating
  if (!hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <AIAssistantPanel isOpen={isPanelOpen} />
    </div>
  );
}
