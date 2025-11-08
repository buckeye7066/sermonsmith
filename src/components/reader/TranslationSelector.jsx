import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Code } from "lucide-react";
import { toast } from "sonner";

export default function TranslationSelector({ currentTranslation = "KJV", onTranslationChange, user, isPremium }) {
  const [translations, setTranslations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    loadTranslations();
  }, [user, isPremium]);

  const loadTranslations = async () => {
    try {
      const response = await base44.functions.invoke('listAvailableTranslations');
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setTranslations(response.data.translations || []);
      setIsDeveloper(response.data.is_developer || false);
    } catch (error) {
      console.error('Failed to load translations:', error);
      toast.error('Failed to load translation list');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslationChange = (translationId) => {
    const translation = translations.find(t => t.id === translationId);
    
    if (!translation) {
      return;
    }

    if (!translation.available) {
      if (translation.unavailable_reason === 'premium_required') {
        toast.error("Premium Translation", {
          description: "Upgrade to Premium to access all Bible translations"
        });
      } else if (translation.unavailable_reason?.startsWith('missing_')) {
        toast.error("Configuration Required", {
          description: "This translation requires additional setup. Contact admin."
        });
      }
      return;
    }

    onTranslationChange(translationId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading translations...</span>
      </div>
    );
  }

  // Group translations
  const freeTranslations = translations.filter(t => !t.is_premium && t.available);
  const premiumAvailable = translations.filter(t => t.is_premium && t.available);
  const premiumLocked = translations.filter(t => t.is_premium && !t.available);

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Translation:
      </label>
      <Select value={currentTranslation} onValueChange={handleTranslationChange}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select translation" />
        </SelectTrigger>
        <SelectContent className="max-h-96 overflow-y-auto">
          {/* Free Translations */}
          <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
            Free Translations
          </div>
          {freeTranslations.map((translation) => (
            <SelectItem 
              key={translation.id} 
              value={translation.id}
            >
              <div className="flex items-center justify-between w-full">
                <div>
                  <span className="font-medium">{translation.id}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {translation.name}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
          
          {/* Premium Available */}
          {premiumAvailable.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase mt-2">
                {isDeveloper ? 'Premium Translations (Developer Access)' : 'Premium Translations (Unlocked)'}
              </div>
              {premiumAvailable.map((translation) => (
                <SelectItem 
                  key={translation.id} 
                  value={translation.id}
                >
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <span className="font-medium">{translation.id}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {translation.name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {isDeveloper ? <><Code className="w-3 h-3 mr-1 inline" />Dev</> : 'Premium'}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
          
          {/* Premium Locked */}
          {premiumLocked.length > 0 && !isDeveloper && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase mt-2">
                Premium Translations (Locked)
              </div>
              {premiumLocked.map((translation) => (
                <SelectItem 
                  key={translation.id} 
                  value={translation.id}
                  disabled
                >
                  <div className="flex items-center justify-between w-full opacity-50">
                    <div>
                      <span className="font-medium">{translation.name}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {translation.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Lock className="w-3 h-3" />
                      <Badge variant="outline" className="text-xs">
                        {translation.unavailable_reason === 'premium_required' ? 'Premium' : 'Config'}
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      {isDeveloper && (
        <Badge variant="secondary" className="text-xs">
          <Code className="w-3 h-3 mr-1" />
          Developer
        </Badge>
      )}
    </div>
  );
}