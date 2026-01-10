'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Send, X, Bot, Loader2, Check, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAIStore } from '@/stores/aiStore';

interface Props {
  isOpen: boolean;
}

export function AIAssistantPanel({ isOpen }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isProcessing,
    pendingConfirmation,
    sendMessage,
    confirmAction,
    cancelAction,
    closePanel,
  } = useAIStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    await sendMessage(input.trim());
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-accent-500 to-accent-600">
        <div className="flex items-center gap-3 text-white">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold">AI Assistant</h3>
            <p className="text-xs text-accent-100">Online & Ready</p>
          </div>
        </div>
        <button
          onClick={closePanel}
          className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">Hi! I'm your AI Assistant</p>
            <p className="text-xs mt-2 text-gray-400 max-w-[80%] mx-auto">
              I can help you update prices, mark items unavailable, check sales, and more.
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500">Try saying:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  '"86 the paneer tikka"',
                  '"How\'s today going?"',
                  '"Increase starters by 10%"',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setInput(example.replace(/"/g, ''))}
                    className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={clsx(
                'max-w-[85%] rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'bg-accent-500 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

              {/* Preview Card */}
              {msg.preview && msg.preview.changes && (
                <div className="mt-3 bg-white rounded-xl p-4 text-gray-800 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Preview Changes
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                    {(msg.preview.changes as { itemName: string; oldPrice: number; newPrice: number }[])
                      .slice(0, 5)
                      .map((change, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0"
                        >
                          <span className="text-gray-700">{change.itemName}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-gray-400 line-through text-xs">
                              ₹{change.oldPrice}
                            </span>
                            <span className="text-green-600 font-semibold">
                              ₹{change.newPrice}
                            </span>
                          </span>
                        </div>
                      ))}
                    {msg.preview.changes.length > 5 && (
                      <p className="text-xs text-gray-400 text-center pt-2">
                        +{msg.preview.changes.length - 5} more items
                      </p>
                    )}
                  </div>
                </div>
              )}

              <p
                className={clsx(
                  'text-[10px] mt-2',
                  msg.role === 'user' ? 'text-accent-200' : 'text-gray-400'
                )}
              >
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent-500" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Confirmation Actions */}
      {pendingConfirmation && (
        <div className="px-4 py-3 border-t bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-700 mb-2 font-medium">
            Review and confirm the changes above
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmAction}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-2.5 rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply Changes
            </button>
            <button
              onClick={cancelAction}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 disabled:opacity-50 font-medium transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or command..."
            disabled={isProcessing || pendingConfirmation}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing || pendingConfirmation}
            className="p-2.5 bg-accent-500 text-white rounded-xl hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          AI can make mistakes. Please review changes before confirming.
        </p>
      </form>
    </div>
  );
}
