'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('owner@spicegarden.com');
  const [password, setPassword] = useState('demo123');
  const [restaurantSlug, setRestaurantSlug] = useState('demo-restaurant');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.auth.login({
        email,
        password,
        restaurantSlug,
      });

      const { user, tokens } = response.data.data;
      login(user, tokens.access, tokens.refresh, tokens.expires_in || 86400);
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      setError(error.response?.data?.error?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UtensilsCrossed className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">OrderMind</h1>
          <p className="text-gray-500 mt-1">AI-Powered Restaurant POS</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Welcome back</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Restaurant ID
              </label>
              <input
                type="text"
                value={restaurantSlug}
                onChange={(e) => setRestaurantSlug(e.target.value)}
                placeholder="your-restaurant"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-3 text-base disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-2">Demo Credentials</p>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="text-gray-400">Restaurant:</span> demo-restaurant
              </p>
              <p>
                <span className="text-gray-400">Email:</span> owner@spicegarden.com
              </p>
              <p>
                <span className="text-gray-400">Password:</span> demo123
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <a href="#" className="text-primary-600 hover:text-primary-700 font-medium">
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}
