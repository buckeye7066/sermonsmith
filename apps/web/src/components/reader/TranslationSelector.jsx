import React, { useState, useEffect } from "react";
import { api } from '@/api/apiClient';
import { logError } from '@/lib/logError';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Loader2, Code, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import TranslationBrowser from "./TranslationBrowser";

export default function TranslationSelector({ currentTranslation = "KJV", onTranslationChange, user, isPremium }) {
  const [translations, setTranslations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentTranslationName, setCurrentTranslationName] = useState(currentTranslation);

  useEffect(() => {
    loadTranslations();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- legacy effect intentionally keeps existing trigger behavior.
  }, [user, isPremium]);

  useEffect(() => {
    // Update display name when translation changes
    const translation = translations.find(t => t.id === currentTranslation);
    if (translation) {
      setCurrentTranslationName(translation.shortName || translation.id);
    }
  }, [currentTranslation, translations]);

  const loadTranslations = async () => {
    try {
      const result = await api.functions.invoke('listAvailableTranslations');

      if (result.ok === false) {
        throw new Error(result.error || 'Failed to load translations');
      }

      const data = result.data || result;

      setTranslations(data.translations || []);
      setIsDeveloper(data.is_developer || false);
      
      // Set initial name
      const translation = (data.translations || []).find(t => t.id === currentTranslation);
      if (translation) {
        setCurrentTranslationName(translation.shortName || translation.id);
      }
    } catch (error) {
      const msg = logError('Failed to load translations', error, {
        endpoint: 'listAvailableTranslations',
        component: 'TranslationSelector',
        currentTranslation,
      });
      toast.error(`Failed to load translation list: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslationChange = (translationId) => {
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

  const stats = translations.length > 0 ? {
    total: translations.length,
    languages: [...new Set(translations.map(t => t.languageCode))].length
  } : null;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        onClick={() => setShowBrowser(true)}
        className="flex items-center gap-2"
      >
        <Globe className="w-4 h-4 text-indigo-600" />
        <span className="font-medium">{currentTranslationName}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </Button>
      
      {stats && (
        <Badge variant="secondary" className="text-xs hidden md:flex">
          {stats.total} translation{stats.total === 1 ? '' : 's'} • {stats.languages} language{stats.languages === 1 ? '' : 's'}
        </Badge>
      )}
      
      {isDeveloper && (
        <Badge variant="secondary" className="text-xs">
          <Code className="w-3 h-3 mr-1" />
          Developer
        </Badge>
      )}

      <TranslationBrowser
        open={showBrowser}
        onClose={() => setShowBrowser(false)}
        currentTranslation={currentTranslation}
        onTranslationChange={handleTranslationChange}
      />
    </div>
  );
}