import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Loader2 } from 'lucide-react';

/**
 * Client-side gate for admin/developer-only pages.
 *
 * The API enforces authorization server-side (the real protection), but the
 * admin pages used to render their full shell — search boxes, user tables,
 * action buttons — to *any* signed-in account and only failed once the data
 * request 401/403'd. Exposing the admin scaffolding to non-admins is a weak
 * signal at best and confusing at worst. This guard refuses to mount the
 * page's UI unless the current user is actually an admin (or dev), matching
 * the same role check used to show admin items in the sidebar
 * (see usePremiumAccess: role === 'admin' || role === 'dev').
 */
export default function AdminGuard({ children }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const isAdmin = !!user && (user.role === 'admin' || user.role === 'dev');

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h2 className="text-2xl font-bold mb-2">Admin access required</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {user
                  ? "Your account doesn't have permission to view this page."
                  : 'Please sign in with an administrator account to continue.'}
              </p>
              {!user && api.auth && api.auth.redirectToLogin && (
                <Button onClick={() => api.auth.redirectToLogin(window.location.href)}>
                  Sign In
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return children;
}
