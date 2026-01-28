import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
      const response = await base44.functions.invoke('listAvailableTranslations');
      
      // Handle unified envelope
      const result = response.data;
      
      if (result.ok === false) {
        throw new Error(result.error || 'Failed to load translations');
      }

      // Data is inside result.data for envelope format
      const data = result.data || result;

      setTranslations(data.translations || []);
      setIsDeveloper(data.is_developer || false);
      
      // Set initial name
      const translation = (data.translations || []).find(t => t.id === currentTranslation);
      if (translation) {
        setCurrentTranslationName(translation.shortName || translation.id);
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
      toast.error('Failed to load translation list');
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
          {stats.total}+ translations • {stats.languages}+ languages
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