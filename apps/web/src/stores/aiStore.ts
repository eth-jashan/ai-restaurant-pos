import { create } from 'zustand';
import { apiClient } from '@/services/api';
import type { AIMessage, AIResponse } from '@/types';

interface AIState {
  messages: AIMessage[];
  isProcessing: boolean;
  pendingConfirmation: boolean;
  pendingActionId: string | null;
  conversationId: string | null;
  isPanelOpen: boolean;

  // Actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  sendMessage: (message: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  clearMessages: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  isProcessing: false,
  pendingConfirmation: false,
  pendingActionId: null,
  conversationId: null,
  isPanelOpen: false,

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),

  sendMessage: async (message: string) => {
    const { conversationId } = get();

    // Add user message
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isProcessing: true,
    }));

    try {
      const response = await apiClient.ai.sendMessage(message, conversationId || undefined);
      const data: AIResponse = response.data.data;

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        preview: data.preview,
        requiresConfirmation: data.requiresConfirmation,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isProcessing: false,
        pendingConfirmation: data.requiresConfirmation || false,
        pendingActionId: data.preview?.actionId || null,
        conversationId: data.conversationId || state.conversationId,
      }));
    } catch (error) {
      console.error('AI Error:', error);

      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        isProcessing: false,
      }));
    }
  },

  confirmAction: async () => {
    const { pendingActionId } = get();

    if (!pendingActionId) return;

    set({ isProcessing: true });

    try {
      const response = await apiClient.ai.confirmAction(pendingActionId);
      const data = response.data.data;

      const confirmMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.success
          ? 'Done! Changes have been applied successfully.'
          : 'Something went wrong. Please try again.',
        timestamp: new Date(),
      };

      set((state) => ({
        messages: [...state.messages, confirmMessage],
        isProcessing: false,
        pendingConfirmation: false,
        pendingActionId: null,
      }));
    } catch (error) {
      console.error('Confirm action error:', error);
      set({ isProcessing: false });
    }
  },

  cancelAction: () => {
    const { pendingActionId } = get();

    if (pendingActionId) {
      apiClient.ai.cancelAction(pendingActionId).catch(console.error);
    }

    const cancelMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Action cancelled.',
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, cancelMessage],
      pendingConfirmation: false,
      pendingActionId: null,
    }));
  },

  clearMessages: () =>
    set({
      messages: [],
      pendingConfirmation: false,
      pendingActionId: null,
      conversationId: null,
    }),
}));
