import React, { useState } from "react";
import { api } from '@/api/apiClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function GrantAccess() {
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);

  const grantAccess = async () => {
    setLoading(true);
    try {
      const response = await api.functions.invoke('grantMePremium');
      if (response.data.success) {
        setGranted(true);
        toast.success('Premium access granted!');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (error) {
      toast.error('Failed to grant access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-500" />
            Grant Premium Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          {granted ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Access Granted!</h3>
              <p className="text-gray-600">Redirecting...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                Click below to grant yourself premium access to all features.
              </p>
              <Button 
                onClick={grantAccess} 
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Granting Access...
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Grant Premium Access
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}