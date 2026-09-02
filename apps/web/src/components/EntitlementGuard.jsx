import React from 'react';
import { Link } from 'react-router';
import { Crown, Loader2 } from 'lucide-react';
import { usePremiumAccess } from '@/components/hooks/usePremiumAccess';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/utils';

export default function EntitlementGuard({ entitlement, children }) {
  const { hasEntitlement, loading } = usePremiumAccess();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!hasEntitlement(entitlement)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-xl border-purple-200">
          <CardContent className="space-y-4 pt-8 text-center">
            <Crown className="mx-auto h-12 w-12 text-purple-600" />
            <h1 className="text-2xl font-bold">Premium feature</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Your current plan does not include this feature.
            </p>
            <Link to={createPageUrl('Pricing')}>
              <Button>View Premium</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}
